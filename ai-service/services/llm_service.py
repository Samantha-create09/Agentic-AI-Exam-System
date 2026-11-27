import json
import os
import re
import threading
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types

_ENV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"
)
load_dotenv(dotenv_path=_ENV_PATH)
load_dotenv()


class GeminiQuotaError(Exception):
    """Gemini quota has been exhausted."""

    def __init__(self, message, retry_after_seconds=None):
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


class GeminiTemporaryError(Exception):
    """Gemini is temporarily unavailable."""

    def __init__(self, message, retry_after_seconds=None):
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


_COOLDOWN_LOCK = threading.Lock()
_MODEL_COOLDOWNS: dict[str, float] = {}


class LLMService:
    LIGHT_TASKS = {"concept_extraction", "concept_assessment", "light"}
    HEAVY_TASKS = {"question_generation", "question_retry", "paper_retry", "heavy"}
    DEFAULT_QUOTA_COOLDOWN_SECONDS = 60

    def __init__(self):
        self.mode = os.getenv("LLM_MODE", "gemini").lower()
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")

        legacy_model = os.getenv("GEMINI_MODEL", "").strip()
        self.legacy_model = legacy_model or None

        self.light_model = (
            os.getenv("GEMINI_LIGHT_MODEL", "").strip()
            or legacy_model
            or "gemini-3.5-flash-lite"
        )
        self.heavy_model = (
            os.getenv("GEMINI_HEAVY_MODEL", "").strip()
            or legacy_model
            or "gemini-3.8-flash"
        )
        self.fallback_model = (
            os.getenv("GEMINI_FALLBACK_MODEL", "").strip()
            or "gemini-3.5-flash-lite"
        )
        self.gemini_model = self.heavy_model

        self.max_retries = int(os.getenv("GEMINI_MAX_RETRIES", "3"))
        self.retry_delay = float(os.getenv("GEMINI_RETRY_DELAY", "2"))
        self.default_cooldown_seconds = int(
            os.getenv(
                "GEMINI_QUOTA_COOLDOWN_SECONDS",
                str(self.DEFAULT_QUOTA_COOLDOWN_SECONDS),
            )
        )

        self.request_timeout_ms = int(
            os.getenv("GEMINI_REQUEST_TIMEOUT_MS", "60000")
        )

        if self.mode != "gemini":
            raise ValueError(f"Unsupported LLM_MODE: {self.mode}")

        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is missing from ai-service/.env")

        # Structured JSON output requires the v1beta API version.
        # Set a 60s per-request timeout (in ms) and disable hidden SDK retries
        # so failed calls fail over immediately without hanging.
        self.client = genai.Client(
            api_key=self.gemini_api_key,
            http_options=types.HttpOptions(
                api_version="v1beta",
                timeout=self.request_timeout_ms,
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )

    @staticmethod
    def _error_text(error):
        parts = [
            str(error),
            str(getattr(error, "message", "")),
            str(getattr(error, "details", "")),
        ]

        response_json = getattr(error, "response_json", None)
        if response_json:
            parts.append(str(response_json))

        return " ".join(parts)

    @classmethod
    def _retry_after_seconds(cls, error):
        """
        Return a retry delay only if the provider supplied one.
        Do not guess a daily quota reset time.
        """
        text = cls._error_text(error)
        patterns = [
            r"retryDelay['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)s",
            r"retry_delay['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)",
            r"retry after\s+(\d+(?:\.\d+)?)\s*seconds?",
            r"retry-after['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)",
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return max(0, int(float(match.group(1))))

        return None

    @classmethod
    def _classify_error(cls, error):
        text = cls._error_text(error).lower()

        # Any 429 / resource exhaustion / quota limit is handled via per-model
        # cooldown and single fallback rather than a retry loop.
        quota_phrases = [
            "quota exceeded",
            "quota_exceeded",
            "quota exhausted",
            "quota has been exhausted",
            "temporarily exhausted the available quota",
            "daily quota",
            "requests per day",
            "tokens per day",
            "requests per minute",
            "tokens per minute",
            "rate limit",
            "billing limit",
            "free tier quota",
            "insufficient quota",
            "limit: 0",
            "resource_exhausted",
            "429",
        ]

        temporary_phrases = [
            "503",
            "502",
            "500",
            "504",
            "temporarily unavailable",
            "unavailable",
            "overloaded",
            "timeout",
            "timed out",
            "readtimeout",
            "connecttimeout",
            "deadline exceeded",
            "connection reset",
            "service unavailable",
        ]

        if any(term in text for term in quota_phrases):
            return "quota"

        if any(term in text for term in temporary_phrases):
            return "temporary"

        return "other"

    @classmethod
    def _cooldown_remaining(cls, model_name):
        now = time.time()
        with _COOLDOWN_LOCK:
            until = _MODEL_COOLDOWNS.get(model_name)
            if until is None:
                return 0
            if now >= until:
                _MODEL_COOLDOWNS.pop(model_name, None)
                return 0
            return max(1, int(until - now))

    @classmethod
    def _set_cooldown(cls, model_name, duration_seconds):
        until = time.time() + max(1, int(duration_seconds))
        with _COOLDOWN_LOCK:
            existing = _MODEL_COOLDOWNS.get(model_name, 0)
            _MODEL_COOLDOWNS[model_name] = max(existing, until)

    @classmethod
    def clear_cooldowns(cls):
        """Clear all per-model cooldowns (useful for tests)."""
        with _COOLDOWN_LOCK:
            _MODEL_COOLDOWNS.clear()

    def _resolve_models(self, task=None, model=None):
        if model:
            return model, None

        normalized_task = (task or "").strip().lower()
        if normalized_task in self.LIGHT_TASKS:
            return self.light_model, None

        if normalized_task in self.HEAVY_TASKS:
            fallback = (
                self.fallback_model
                if self.fallback_model and self.fallback_model != self.heavy_model
                else None
            )
            return self.heavy_model, fallback

        primary = self.legacy_model or self.heavy_model
        fallback = (
            self.fallback_model
            if self.fallback_model and self.fallback_model != primary
            else None
        )
        return primary, fallback

    @staticmethod
    def _build_quota_error(model_name, retry_after, detail=""):
        if retry_after is not None:
            message = (
                f"Gemini model '{model_name}' has temporarily exhausted the "
                f"available quota. Suggested retry delay: approximately "
                f"{retry_after} seconds."
            )
        else:
            message = (
                f"Gemini model '{model_name}' quota has been exhausted. "
                "Check your Google AI Studio usage and quota limits before retrying."
            )
        if detail:
            message = f"{message} ({detail})"
        return GeminiQuotaError(message, retry_after_seconds=retry_after)

    def _invoke_model(self, model_name, prompt, schema_name, schema, allow_retries=True):
        attempts = self.max_retries if allow_retries else 1
        last_error = None

        for attempt in range(attempts):
            try:
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=schema,
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(
                            disable=True
                        ),
                    ),
                )

                if not response.text:
                    raise ValueError(
                        f"Gemini returned an empty response for {schema_name}."
                    )

                try:
                    result = json.loads(response.text)
                except json.JSONDecodeError as error:
                    raise ValueError(
                        f"Gemini returned invalid JSON for {schema_name}: {error}"
                    ) from error

                if not isinstance(result, dict):
                    raise ValueError(
                        f"Gemini returned an invalid JSON object for {schema_name}."
                    )

                return result

            except ValueError:
                raise

            except Exception as error:
                last_error = error
                error_type = self._classify_error(error)
                retry_after = self._retry_after_seconds(error)

                if error_type == "quota":
                    cooldown = (
                        retry_after
                        if retry_after is not None and retry_after > 0
                        else self.default_cooldown_seconds
                    )
                    self._set_cooldown(model_name, cooldown)
                    raise self._build_quota_error(
                        model_name,
                        retry_after,
                        detail=str(error),
                    ) from error

                if error_type == "other":
                    raise RuntimeError(
                        f"Gemini request failed while generating {schema_name} "
                        f"with model '{model_name}': {error}"
                    ) from error

                if attempt < attempts - 1:
                    wait_seconds = (
                        retry_after
                        if retry_after is not None
                        else self.retry_delay * (2 ** attempt)
                    )
                    time.sleep(min(wait_seconds, 60))

        retry_after = self._retry_after_seconds(last_error)
        raise GeminiTemporaryError(
            f"Gemini model '{model_name}' remained temporarily unavailable after "
            f"{attempts} attempts while generating {schema_name}. Please try again later.",
            retry_after_seconds=retry_after,
        ) from last_error

    def generate_json(
        self,
        instructions,
        input_text,
        schema_name,
        schema,
        task=None,
        model=None,
    ):
        prompt = (
            f"{instructions}\n\n"
            "Return valid JSON matching the supplied schema.\n\n"
            f"INPUT MATERIAL:\n{input_text}"
        )

        primary_model, fallback_model = self._resolve_models(task=task, model=model)
        primary_cooldown = self._cooldown_remaining(primary_model)

        if primary_cooldown > 0:
            if fallback_model and self._cooldown_remaining(fallback_model) == 0:
                return self._invoke_model(
                    fallback_model,
                    prompt,
                    schema_name,
                    schema,
                    allow_retries=False,
                )
            raise self._build_quota_error(primary_model, primary_cooldown)

        try:
            # When a fallback model exists (e.g. heavy -> flash-lite), fail over
            # immediately on 429/503/timeout without sleeping or looping retries.
            return self._invoke_model(
                primary_model,
                prompt,
                schema_name,
                schema,
                allow_retries=(fallback_model is None),
            )
        except (GeminiQuotaError, GeminiTemporaryError):
            if fallback_model and self._cooldown_remaining(fallback_model) == 0:
                return self._invoke_model(
                    fallback_model,
                    prompt,
                    schema_name,
                    schema,
                    allow_retries=False,
                )
            raise
