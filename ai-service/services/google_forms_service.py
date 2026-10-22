import os

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build


# ============================================================
# GOOGLE FORMS API
# ============================================================

SCOPES = [
    "https://www.googleapis.com/auth/forms.body"
]

DISCOVERY_DOC = (
    "https://forms.googleapis.com/"
    "$discovery/rest?version=v1"
)

CREDENTIALS_FILE = "credentials.json"

TOKEN_FILE = "token.json"


class GoogleFormsService:

    def __init__(self):

        self.credentials = (
            self._get_credentials()
        )

        self.service = build(

            "forms",

            "v1",

            credentials=self.credentials,

            discoveryServiceUrl=
                DISCOVERY_DOC,

            static_discovery=False
        )


    # ========================================================
    # AUTHENTICATION
    # ========================================================

    def _get_credentials(self):

        credentials = None


        # ----------------------------------------------------
        # Existing token
        # ----------------------------------------------------

        if os.path.exists(
            TOKEN_FILE
        ):

            credentials = (
                Credentials.from_authorized_user_file(

                    TOKEN_FILE,

                    SCOPES
                )
            )


        # ----------------------------------------------------
        # Refresh or perform OAuth
        # ----------------------------------------------------

        if (
            not credentials
            or not credentials.valid
        ):

            if (
                credentials
                and credentials.expired
                and credentials.refresh_token
            ):

                credentials.refresh(
                    Request()
                )

            else:

                if not os.path.exists(
                    CREDENTIALS_FILE
                ):

                    raise FileNotFoundError(

                        "credentials.json was not found in "
                        "ai-service. Put the downloaded Google "
                        "OAuth Desktop client JSON file here."
                    )


                flow = (
                    InstalledAppFlow
                    .from_client_secrets_file(

                        CREDENTIALS_FILE,

                        SCOPES
                    )
                )


                credentials = (
                    flow.run_local_server(
                        port=0
                    )
                )


            # ------------------------------------------------
            # Save token
            # ------------------------------------------------

            with open(
                TOKEN_FILE,
                "w"
            ) as token:

                token.write(
                    credentials.to_json()
                )


        return credentials


    # ========================================================
    # CREATE GOOGLE FORM QUIZ
    # ========================================================

    def deploy_quiz(
        self,
        title,
        questions,
        description=""
    ):

        if not title.strip():

            raise ValueError(
                "Google Form title cannot be empty."
            )


        if not questions:

            raise ValueError(
                "At least one question is required."
            )


        # ====================================================
        # VALIDATE QUESTION OBJECTS
        # ====================================================

        for index, question in enumerate(
            questions
        ):

            if not isinstance(
                question,
                dict
            ):

                raise ValueError(
                    f"Question {index + 1} is not a valid object."
                )


            if not question.get(
                "question"
            ):

                raise ValueError(
                    f"Question {index + 1} has no question text."
                )


            if question.get(
                "marks"
            ) != 1:

                question["marks"] = 1


        # ====================================================
        # CREATE EMPTY FORM
        #
        # Google Forms API creates the form first.
        # Questions/settings are added afterward.
        # ====================================================

        create_body = {

            "info": {

                "title":
                    title,

                "documentTitle":
                    title
            }
        }


        form = (
            self.service
            .forms()
            .create(
                body=create_body,

                # New API-created forms after June 30, 2026
                # are unpublished by default, so we explicitly
                # publish them after construction.
                unpublished=True
            )
            .execute()
        )


        form_id = form.get(
            "formId"
        )


        if not form_id:

            raise RuntimeError(
                "Google Forms API did not return a formId."
            )


        # ====================================================
        # UPDATE DESCRIPTION + MAKE QUIZ
        # ====================================================

        requests = []


        if description.strip():

            requests.append({

                "updateFormInfo": {

                    "info": {

                        "description":
                            description
                    },

                    "updateMask":
                        "description"
                }
            })


        # ----------------------------------------------------
        # Convert to quiz
        # ----------------------------------------------------

        requests.append({

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


        # ====================================================
        # CREATE QUESTIONS
        # ====================================================

        for index, question in enumerate(
            questions
        ):

            question_type = question.get(
                "type"
            )


            question_text = question.get(
                "question"
            )


            correct_answer = str(
                question.get(
                    "correctAnswer",
                    ""
                )
            )


            accepted_answers = (
                question.get(
                    "acceptedAnswers",
                    []
                )
            )


            # =================================================
            # MCQ
            # =================================================

            if question_type == "MCQ":

                options = [

                    {
                        "value":
                            str(option)
                    }

                    for option in question.get(
                        "options",
                        []
                    )
                ]


                if len(options) != 4:

                    raise ValueError(

                        f"MCQ question {index + 1} "
                        "must contain exactly 4 options."
                    )


                form_question = {

                    "required":
                        True,

                    "grading": {

                        "pointValue":
                            1,

                        "correctAnswers": {

                            "answers": [

                                {
                                    "value":
                                        correct_answer
                                }

                            ]
                        }
                    },

                    "choiceQuestion": {

                        "type":
                            "RADIO",

                        "options":
                            options,

                        "shuffle":
                            False
                    }
                }


            # =================================================
            # TRUE / FALSE
            # =================================================

            elif question_type == "TRUE_FALSE":

                form_question = {

                    "required":
                        True,

                    "grading": {

                        "pointValue":
                            1,

                        "correctAnswers": {

                            "answers": [

                                {
                                    "value":
                                        correct_answer
                                }

                            ]
                        }
                    },

                    "choiceQuestion": {

                        "type":
                            "RADIO",

                        "options": [

                            {
                                "value":
                                    "True"
                            },

                            {
                                "value":
                                    "False"
                            }

                        ],

                        "shuffle":
                            False
                    }
                }


            # =================================================
            # FILL IN THE BLANK
            # =================================================

            elif question_type == "FILL_BLANK":

                answers = []

                for answer in accepted_answers:

                    answers.append({

                        "value":
                            str(answer)
                    })


                if not answers:

                    answers = [

                        {
                            "value":
                                correct_answer
                        }

                    ]


                form_question = {

                    "required":
                        True,

                    "grading": {

                        "pointValue":
                            1,

                        "correctAnswers": {

                            "answers":
                                answers
                        }
                    },

                    "textQuestion": {

                        "paragraph":
                            False
                    }
                }


            # =================================================
            # SHORT ANSWER
            # =================================================

            elif question_type == "SHORT_ANSWER":

                answers = []

                if accepted_answers:

                    for answer in accepted_answers:

                        answers.append({

                            "value":
                                str(answer)
                        })

                else:

                    answers.append({

                        "value":
                            correct_answer
                    })


                form_question = {

                    "required":
                        True,

                    "grading": {

                        "pointValue":
                            1,

                        "correctAnswers": {

                            "answers":
                                answers
                        }
                    },

                    "textQuestion": {

                        "paragraph":
                            False
                    }
                }


            else:

                raise ValueError(

                    f"Unsupported question type: "
                    f"{question_type}"
                )


            # =================================================
            # ADD QUESTION TO REQUEST
            # =================================================

            requests.append({

                "createItem": {

                    "item": {

                        "title":
                            question_text,

                        "questionItem": {

                            "question":
                                form_question
                        }
                    },

                    "location": {

                        "index":
                            index
                    }
                }
            })


        # ====================================================
        # SEND ALL FORM UPDATES
        # ====================================================

        batch_result = (

            self.service
            .forms()
            .batchUpdate(

                formId=form_id,

                body={

                    "requests":
                        requests,

                    "includeFormInResponse":
                        True
                }
            )
            .execute()
        )


        # ====================================================
        # PUBLISH FORM
        # ====================================================

        publish_result = (

            self.service
            .forms()
            .setPublishSettings(

                formId=form_id,

                body={

                    "publishSettings": {

                        "publishState": {

                            "isPublished":
                                True,

                            "isAcceptingResponses":
                                True
                        }
                    }
                }
            )
            .execute()
        )


        # ====================================================
        # GET FINAL FORM
        # ====================================================

        final_form = (

            self.service
            .forms()
            .get(
                formId=form_id
            )
            .execute()
        )


        responder_uri = (
            final_form.get(
                "responderUri"
            )
        )


        edit_url = (
            f"https://docs.google.com/forms/d/"
            f"{form_id}/edit"
        )


        return {

            "formId":
                form_id,

            "title":
                title,

            "description":
                description,

            "questionCount":
                len(questions),

            "editUrl":
                edit_url,

            "responderUrl":
                responder_uri,

            "published":
                True,

            "acceptingResponses":
                True
        }