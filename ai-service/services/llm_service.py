import json
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types


load_dotenv()


class LLMService:

    def __init__(self):

        self.mode = os.getenv(
            "LLM_MODE",
            "gemini"
        ).lower()

        self.gemini_api_key = os.getenv(
            "GEMINI_API_KEY"
        )

        self.gemini_model = os.getenv(
            "GEMINI_MODEL",
            "gemini-2.5-flash"
        )


        # ========================================
        # GEMINI
        # ========================================

        if self.mode == "gemini":

            if not self.gemini_api_key:

                raise ValueError(
                    "GEMINI_API_KEY is not configured "
                    "in ai-service/.env"
                )


            self.client = genai.Client(
                api_key=self.gemini_api_key
            )


    def generate_json(
        self,
        instructions,
        input_text,
        schema_name,
        schema
    ):

        if self.mode == "gemini":

            return self._generate_with_gemini(
                instructions,
                input_text,
                schema
            )


        raise ValueError(
            f"Unsupported LLM_MODE: {self.mode}"
        )


    def _generate_with_gemini(
        self,
        instructions,
        input_text,
        schema
    ):

        prompt = f"""
{instructions}

IMPORTANT:
Return only the requested JSON.
Do not use Markdown.
Do not use ```json.
Do not add explanations outside the JSON.

STUDY MATERIAL / INPUT:

{input_text}
"""


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
                "Gemini returned an empty response."
            )


        try:

            return json.loads(
                response.text
            )

        except json.JSONDecodeError as error:

            raise ValueError(
                "Gemini returned invalid JSON."
            ) from error