import json
import os
import re
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types

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


class LLMService:

    def __init__(self):
        self.mode = os.getenv("LLM_MODE", "gemini").lower()
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.gemini_model = os.getenv(
            "GEMINI_MODEL",
            "gemini-2.5-flash"
        )

        self.max_retries = int(
            os.getenv("GEMINI_MAX_RETRIES", "3")
        )

        self.retry_delay = float(
            os.getenv("GEMINI_RETRY_DELAY", "2")
        )

        if self.mode != "gemini":
            raise ValueError(
                f"Unsupported LLM_MODE: {self.mode}"
            )

        if not self.gemini_api_key:
            raise ValueError(
                "GEMINI_API_KEY is missing from ai-service/.env"
            )

        # IMPORTANT:
        # Structured JSON output requires the v1beta API version
        # for the configuration currently used by this project.
        self.client = genai.Client(
            api_key=self.gemini_api_key,
            http_options=types.HttpOptions(
                api_version="v1beta"
            )
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

        # Permanent or longer-period quota exhaustion.
        quota_phrases = [
    "quota exceeded",
    "quota_exceeded",
    "quota exhausted",
    "quota has been exhausted",
    "temporarily exhausted the available quota",
    "daily quota",
    "requests per day",
    "tokens per day",
    "billing limit",
    "free tier quota",
    "insufficient quota",
    "limit: 0",
]

        # Temporary errors, including per-minute rate limits.
        temporary_phrases = [
            "429",
            "resource_exhausted",
            "rate limit",
            "requests per minute",
            "tokens per minute",
            "503",
            "502",
            "500",
            "504",
            "temporarily unavailable",
            "overloaded",
            "timeout",
            "deadline exceeded",
            "connection reset",
            "service unavailable",
        ]

        if any(term in text for term in quota_phrases):
            return "quota"

       # Resource exhaustion without a clear daily-quota message can
       # represent a short-term rate limit. Do not assume it is a
       # permanent daily quota.
        if "resource_exhausted" in text or "429" in text:
            return "temporary"

        if any(term in text for term in temporary_phrases):
            return "temporary"

        return "other"

    def generate_json(
        self,
        instructions,
        input_text,
        schema_name,
        schema
    ):
        prompt = (
            f"{instructions}\n\n"
            "Return valid JSON matching the supplied schema.\n\n"
            f"INPUT MATERIAL:\n{input_text}"
        )

        last_error = None

        for attempt in range(self.max_retries):
            try:
                response = self.client.models.generate_content(
                    model=self.gemini_model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=schema
                    )
                )

                if not response.text:
                    raise ValueError(
                        f"Gemini returned an empty response "
                        f"for {schema_name}."
                    )

                try:
                    result = json.loads(response.text)
                except json.JSONDecodeError as error:
                    raise ValueError(
                        f"Gemini returned invalid JSON for "
                        f"{schema_name}: {error}"
                    ) from error

                if not isinstance(result, dict):
                    raise ValueError(
                        f"Gemini returned an invalid JSON object "
                        f"for {schema_name}."
                    )

                return result

            except ValueError:
                raise

            except Exception as error:
                last_error = error
                error_type = self._classify_error(error)
                retry_after = self._retry_after_seconds(error)

                if error_type == "quota":
                    if retry_after is not None:
                        message = (
                            "Gemini has temporarily exhausted the "
                            "available quota. Google supplied a retry "
                            f"delay of approximately {retry_after} seconds. "
                            "Please try again after that interval."
                        )
                    else:
                        message = (
                            "Gemini's available API quota has been "
                            "exhausted. Google did not provide a reliable "
                            "reset time, so we cannot tell you exactly "
                            "when generation will be available again. "
                            "Please check your Google AI Studio usage "
                            "and quota limits before retrying."
                        )

                    raise GeminiQuotaError(
                        message,
                        retry_after_seconds=retry_after
                    ) from error

                if error_type == "other":
                    raise RuntimeError(
                        f"Gemini request failed while generating "
                        f"{schema_name}: {error}"
                    ) from error

                if attempt < self.max_retries - 1:
                    # Use Google's delay if supplied. Otherwise use
                    # a short bounded backoff for temporary failures.
                    wait_seconds = (
                        retry_after
                        if retry_after is not None
                        else self.retry_delay * (2 ** attempt)
                    )

                    time.sleep(min(wait_seconds, 60))

        retry_after = self._retry_after_seconds(last_error)

        raise GeminiTemporaryError(
            f"Gemini remained temporarily unavailable after "
            f"{self.max_retries} attempts while generating "
            f"{schema_name}. Please try again later.",
            retry_after_seconds=retry_after
        ) from last_error