import json
import os
import time

import requests

from dotenv import load_dotenv
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow


load_dotenv()


class GoogleFormsService:

    SCOPES = [
        "https://www.googleapis.com/auth/forms.body"
    ]

    BASE_URL = (
        "https://forms.googleapis.com/v1"
    )

    def __init__(self):

        self.base_dir = os.path.dirname(
            os.path.dirname(
                os.path.abspath(__file__)
            )
        )

        self.credentials_file = os.path.join(
            self.base_dir,
            "credentials.json"
        )

        self.token_file = os.path.join(
            self.base_dir,
            "token.json"
        )

        self.session = requests.Session()

        self.credentials = self._get_credentials()


    # ============================================================
    # GOOGLE OAUTH
    # ============================================================

    def _get_credentials(self):

        credentials = None

        if os.path.exists(
            self.token_file
        ):

            credentials = (
                Credentials.from_authorized_user_file(
                    self.token_file,
                    self.SCOPES
                )
            )

            if (
                credentials
                and credentials.scopes is not None
                and not set(self.SCOPES).issubset(set(credentials.scopes))
            ):
                raise RuntimeError(
                    "Google OAuth token in ai-service/token.json is missing the required "
                    "Google Forms scope (https://www.googleapis.com/auth/forms.body). "
                    "Re-authorize Google Forms permissions to update ai-service/token.json."
                )

        if (
            not credentials
            or not credentials.valid
        ):

            if (
                credentials
                and credentials.expired
                and credentials.refresh_token
            ):

                try:
                    credentials.refresh(
                        Request()
                    )
                except RefreshError as exc:
                    raise RuntimeError(
                        "Google OAuth token in ai-service/token.json has expired or been "
                        "revoked (invalid_grant). Re-authorize your Google account to "
                        "generate a fresh ai-service/token.json before deploying."
                    ) from exc

            elif os.path.exists(self.token_file):

                raise RuntimeError(
                    "Google OAuth token in ai-service/token.json is invalid and cannot be "
                    "refreshed automatically. Re-authorize your Google account to update "
                    "ai-service/token.json."
                )

            else:

                if not os.path.exists(
                    self.credentials_file
                ):

                    raise FileNotFoundError(
                        "credentials.json was not found at: "
                        + self.credentials_file
                    )

                flow = (
                    InstalledAppFlow
                    .from_client_secrets_file(
                        self.credentials_file,
                        self.SCOPES
                    )
                )

                credentials = (
                    flow.run_local_server(
                        port=0,
                        access_type="offline",
                        prompt="consent",
                    )
                )


            with open(
                self.token_file,
                "w",
                encoding="utf-8"
            ) as token:

                token.write(
                    credentials.to_json()
                )


        return credentials


    # ============================================================
    # AUTHORIZATION HEADER
    # ============================================================

    def _headers(self):

        if (
            not self.credentials
            or not self.credentials.valid
        ):

            if (
                self.credentials
                and self.credentials.expired
                and self.credentials.refresh_token
            ):

                try:
                    self.credentials.refresh(
                        Request()
                    )
                except RefreshError as exc:
                    raise RuntimeError(
                        "Google OAuth token in ai-service/token.json has expired or been "
                        "revoked (invalid_grant). Re-authorize your Google account to "
                        "generate a fresh ai-service/token.json before deploying."
                    ) from exc

                with open(
                    self.token_file,
                    "w",
                    encoding="utf-8"
                ) as token:

                    token.write(
                        self.credentials.to_json()
                    )

            else:

                raise RuntimeError(
                    "Google authentication is not valid."
                )


        return {
            "Authorization":
                f"Bearer {self.credentials.token}",

            "Content-Type":
                "application/json",

            "Accept":
                "application/json"
        }


    # ============================================================
    # HTTP REQUEST WITH RETRIES
    # ============================================================

    def _request(
        self,
        method,
        url,
        payload=None,
        retries=3
    ):

        last_error = None


        for attempt in range(
            retries
        ):

            try:

                response = self.session.request(

                    method=method,

                    url=url,

                    headers=self._headers(),

                    json=payload,

                    timeout=60

                )


                if response.status_code >= 400:

                    try:

                        error_data = (
                            response.json()
                        )

                    except Exception:

                        error_data = (
                            response.text
                        )

                    raise RuntimeError(

                        "Google Forms API error "
                        f"{response.status_code}: "
                        f"{error_data}"

                    )


                if not response.text:

                    return {}


                return response.json()


            except (
                requests.exceptions.SSLError,
                requests.exceptions.ConnectionError,
                requests.exceptions.Timeout
            ) as error:

                last_error = error

                if attempt < retries - 1:

                    time.sleep(
                        2 ** attempt
                    )

                else:

                    raise RuntimeError(
                        "Could not connect to Google "
                        "Forms API after multiple attempts. "
                        f"Original error: {error}"
                    )


        raise RuntimeError(
            str(last_error)
        )


    # ============================================================
    # CREATE FORM
    # ============================================================

    def _create_form(
        self,
        title
    ):

        payload = {

            "info": {

                "title":
                    title

            }

        }

        return self._request(

            "POST",

            f"{self.BASE_URL}/forms",

            payload

        )


    # ============================================================
    # BUILD GOOGLE FORMS QUESTION
    # ============================================================

    def _build_question_item(self, question):


        # Google Forms API item titles cannot contain newline characters.
        question_text = " ".join(
            str(question.get("question", "")).splitlines()
        ).strip()

        question_type = str(
            question.get("type", "")
        ).upper()

        # Every question carries exactly one mark.
        marks = 1

        accepted_answers = question.get(
            "acceptedAnswers",
            []
        )

        if not isinstance(accepted_answers, list):
            accepted_answers = []

        correct_answer = str(
            question.get("correctAnswer", "")
        ).strip()

        correct_values = []

        # --------------------------------------------------------
        # ACCEPTED ANSWERS FOR TEXT QUESTIONS
        # --------------------------------------------------------

        if question_type in [
            "FILL_BLANK",
            "SHORT_ANSWER"
        ]:

            values = []

            if correct_answer:
                values.append(correct_answer)

            for answer in accepted_answers:

                answer = str(answer).strip()

                if answer:
                    values.append(answer)

            seen = set()

            for value in values:

                normalized = value.casefold()

                if normalized not in seen:
                    seen.add(normalized)
                    correct_values.append(value)

        else:

            if correct_answer:
                correct_values = [correct_answer]

        # --------------------------------------------------------
        # GOOGLE FORMS GRADING
        # --------------------------------------------------------

        grading = {
            "pointValue": marks,
            "correctAnswers": {
                "answers": [
                    {"value": value}
                    for value in correct_values
                ]
            }
        }

        # --------------------------------------------------------
        # REGULAR MCQ + STATEMENT-BASED TRUE/FALSE MCQ
        # --------------------------------------------------------

        if question_type in [
            "MCQ",
            "STATEMENT_MCQ"
        ]:

            raw_options = question.get("options", [])

            if not isinstance(raw_options, list):
                raise ValueError(
                    f"{question_type} options must be a list."
                )

            options = [str(opt).strip() for opt in raw_options]

            if len(options) != 4:
                raise ValueError(
                    f"{question_type} must have exactly four options."
                )

            if len(set(options)) != 4:
                raise ValueError(
                    f"{question_type} options must be unique."
                )

            if correct_answer not in options:
                raise ValueError(
                    f"{question_type} correct answer must match one of its options."
                )

            if question_type == "STATEMENT_MCQ":

                expected_options = [
                    "Both statements are true.",
                    "Both statements are false.",
                    "Statement I is true, but Statement II is false.",
                    "Statement I is false, but Statement II is true."
                ]

                if options != expected_options:
                    raise ValueError(
                        "Statement-based MCQ must use the four standard answer options."
                    )

                question_lower = question_text.casefold()

                if (
                    "statement i:" not in question_lower
                    or "statement ii:" not in question_lower
                ):
                    raise ValueError(
                        "Statement-based MCQ must contain Statement I and Statement II."
                    )

            return {
                "item": {
                    "title": question_text,
                    "questionItem": {
                        "question": {
                            "required": True,
                            "grading": grading,
                            "choiceQuestion": {
                                "type": "RADIO",
                                "options": [
                                    {"value": str(option)}
                                    for option in options
                                ]
                            }
                        }
                    }
                }
            }

        # --------------------------------------------------------
        # NORMAL TRUE / FALSE
        # --------------------------------------------------------

        if question_type == "TRUE_FALSE":

            normalized_tf = correct_answer.strip().rstrip(".").capitalize()
            if normalized_tf not in ["True", "False"]:
                raise ValueError(
                    "True/False answer must be True or False."
                )

            tf_grading = {
                "pointValue": marks,
                "correctAnswers": {
                    "answers": [{"value": normalized_tf}]
                }
            }

            return {
                "item": {
                    "title": question_text,
                    "questionItem": {
                        "question": {
                            "required": True,
                            "grading": tf_grading,
                            "choiceQuestion": {
                                "type": "RADIO",
                                "options": [
                                    {"value": "True"},
                                    {"value": "False"}
                                ]
                            }
                        }
                    }
                }
            }

        # --------------------------------------------------------
        # FILL IN THE BLANK
        # --------------------------------------------------------

        if question_type == "FILL_BLANK":

            if not correct_values:
                raise ValueError(
                    "Fill-in-the-blank requires at least one correct answer."
                )

            return {
                "item": {
                    "title": question_text,
                    "questionItem": {
                        "question": {
                            "required": True,
                            "grading": grading,
                            "textQuestion": {
                                "paragraph": False
                            }
                        }
                    }
                }
            }

        # --------------------------------------------------------
        # SHORT ANSWER
        # --------------------------------------------------------

        if question_type == "SHORT_ANSWER":

            if not correct_values:
                raise ValueError(
                    "Short answer requires at least one correct answer."
                )

            return {
                "item": {
                    "title": question_text,
                    "questionItem": {
                        "question": {
                            "required": True,
                            "grading": grading,
                            "textQuestion": {
                                "paragraph": False
                            }
                        }
                    }
                }
            }

        raise ValueError(
            f"Unsupported question type: {question_type}"
        )

    # ============================================================
    # UPDATE FORM
    # ============================================================

    def _update_form(
        self,
        form_id,
        title,
        description,
        questions
    ):

        requests_list = []


        # --------------------------------------------------------
        # DESCRIPTION
        # --------------------------------------------------------

        if description:

            requests_list.append({

                "updateFormInfo": {

                    "info": {

                        "description":
                            description

                    },

                    "updateMask":
                        "description"

                }

            })


        # --------------------------------------------------------
        # CONVERT TO QUIZ
        # --------------------------------------------------------

        requests_list.append({

            "updateSettings": {

                "settings": {

                    "quizSettings": {

                        "isQuiz":
                            True

                    }

                },

                "updateMask":
                    "quizSettings.isQuiz"

            }

        })


        # --------------------------------------------------------
        # QUESTIONS
        # --------------------------------------------------------

        for index, question in enumerate(
            questions
        ):

            question_request = (
                self._build_question_item(
                    question
                )
            )


            question_request[
                "location"
            ] = {

                "index":
                    index

            }


            requests_list.append(
                {
                    "createItem":
                        question_request
                }
            )


        payload = {

            "includeFormInResponse":
                True,

            "requests":
                requests_list

        }


        return self._request(

            "POST",

            f"{self.BASE_URL}/forms/"
            f"{form_id}:batchUpdate",

            payload

        )


    # ============================================================
    # PUBLISH FORM
    # ============================================================

    def _publish_form(
        self,
        form_id
    ):

        payload = {

            "publishSettings": {

                "publishState": {

                    "isPublished":
                        True,

                    "isAcceptingResponses":
                        True

                }

            },

            "updateMask":
                "publishState"

        }


        return self._request(

            "POST",

            f"{self.BASE_URL}/forms/"
            f"{form_id}:setPublishSettings",

            payload

        )


    # ============================================================
    # PUBLIC METHOD
    # ============================================================

    def deploy_quiz(
        self,
        title,
        questions,
        description=""
    ):

        if not title.strip():

            raise ValueError(
                "Google Form title is required."
            )


        if not isinstance(
            questions,
            list
        ):

            raise ValueError(
                "questions must be a list."
            )


        if len(questions) == 0:

            raise ValueError(
                "At least one question is required."
            )


        # --------------------------------------------------------
        # Validate all questions before creating the form
        # --------------------------------------------------------

        for index, question in enumerate(
            questions,
            start=1
        ):

            if not isinstance(
                question,
                dict
            ):

                raise ValueError(
                    f"Question {index} is not "
                    "a valid object."
                )


            if not question.get(
                "question"
            ):

                raise ValueError(
                    f"Question {index} has no "
                    "question text."
                )


            if question.get(
                "marks",
                1
            ) != 1:

                raise ValueError(
                    f"Question {index} does not "
                    "have exactly 1 mark."
                )


        # --------------------------------------------------------
        # CREATE
        # --------------------------------------------------------

        created_form = (
            self._create_form(
                title
            )
        )


        form_id = created_form.get(
            "formId"
        )


        if not form_id:

            raise RuntimeError(
                "Google did not return a formId."
            )


        # --------------------------------------------------------
        # ADD QUIZ SETTINGS + QUESTIONS
        # --------------------------------------------------------

        updated_form = (
            self._update_form(

                form_id=form_id,

                title=title,

                description=description,

                questions=questions

            )
        )


        # --------------------------------------------------------
        # PUBLISH
        # --------------------------------------------------------

        publish_result = (
            self._publish_form(
                form_id
            )
        )


        # --------------------------------------------------------
        # GET FINAL FORM DETAILS
        # --------------------------------------------------------

        final_form = self._request(

            "GET",

            f"{self.BASE_URL}/forms/"
            f"{form_id}"

        )


        return {

            "formId":
                form_id,

            "formUrl":
                final_form.get(
                    "responderUri"
                ),

            "editUrl":
                f"https://docs.google.com/forms/d/"
                f"{form_id}/edit",

            "title":
                title,

            "questionCount":
                len(questions),

            "published":
                True,

            "acceptingResponses":
                True

        }