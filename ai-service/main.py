import json
import os
import random
from typing import Literal

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from agents.concept_agent import ConceptAgent
from agents.question_agent import QuestionAgent
from agents.balance_agent import BalanceAgent
from agents.validation_agent import ValidationAgent

from services.pdf_service import extract_text_from_pdf
from services.google_forms_service import GoogleFormsService


load_dotenv()


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Agentic AI Exam System",
    description="Multi-agent AI system for academic question generation",
    version="1.0.0"
)


# ============================================================
# AGENTS
# ============================================================

concept_agent = ConceptAgent()
question_agent = QuestionAgent()
balance_agent = BalanceAgent()
validation_agent = ValidationAgent()


# ============================================================
# UPLOAD DIRECTORY
# ============================================================

UPLOAD_DIR = "uploads"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


# ============================================================
# GOOGLE FORM QUESTION MODEL
# ============================================================

class QuestionModel(BaseModel):

    question: str

    type: Literal[
        "MCQ",
        "TRUE_FALSE",
        "FILL_BLANK",
        "SHORT_ANSWER"
    ]

    options: list[str] = Field(
        default_factory=list
    )

    correctAnswer: str

    acceptedAnswers: list[str] = Field(
        default_factory=list
    )

    marks: int = 1

    bloomLevel: Literal[
        "Remember",
        "Understand",
        "Apply",
        "Analyze",
        "Evaluate",
        "Create"
    ]

    difficulty: Literal[
        "Low",
        "Medium",
        "High"
    ]

    concept: str

    explanation: str


class GoogleFormRequest(BaseModel):

    title: str

    description: str = ""

    questions: list[QuestionModel]


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message":
            "Agentic AI Exam System AI Service is running"
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy"
    }


# ============================================================
# BASIC TEST
# ============================================================

@app.get("/api/test")
def test():

    return {
        "message":
            "FastAPI AI service is working"
    }


# ============================================================
# BUILD CONCEPTS
#
# This endpoint is kept as a testing/debugging endpoint.
# The normal question-generation workflow runs Agent 1
# internally.
# ============================================================

@app.post("/api/build-concepts")
async def build_concepts(
    file: UploadFile = File(...)
):

    file_path = None

    try:

        if not file.filename.lower().endswith(".pdf"):

            raise HTTPException(
                status_code=400,
                detail="Only PDF files are allowed."
            )

        file_path = os.path.join(
            UPLOAD_DIR,
            file.filename
        )

        content = await file.read()

        with open(
            file_path,
            "wb"
        ) as output_file:

            output_file.write(content)

        text = extract_text_from_pdf(
            file_path
        )

        if not text.strip():

            raise HTTPException(
                status_code=400,
                detail="No readable text found in PDF."
            )

        concept_graph = (
            concept_agent.extract_concepts(
                text
            )
        )

        return {

            "success": True,

            "agent":
                "Agent 1 - Concept Graph Builder",

            "message":
                "Concept graph generated successfully.",

            "conceptGraph":
                concept_graph
        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if (
            file_path
            and os.path.exists(file_path)
        ):

            os.remove(file_path)


# ============================================================
# QUESTION GENERATION
#
# FINAL PIPELINE:
#
# PDF
#   ↓
# PDF extraction
#   ↓
# Agent 1 - Concept Graph
#   ↓
# Agent 2 - Question Generation
#   ↓
# Agent 3 - Balance Check
#   ↓
# Agent 4 - Validation
#   ↓
# Shuffle
#   ↓
# Final Questions
# ============================================================

@app.post("/api/generate-questions")
async def generate_questions(

    file: UploadFile = File(...),

    mcq_count: int = Form(0),

    true_false_count: int = Form(0),

    fill_blank_count: int = Form(0),

    short_answer_count: int = Form(0),

    difficulty: Literal[
        "Low",
        "Medium",
        "High"
    ] = Form("Medium"),

    remember_count: int = Form(0),

    understand_count: int = Form(0),

    apply_count: int = Form(0),

    analyze_count: int = Form(0),

    evaluate_count: int = Form(0),

    create_count: int = Form(0)
):

    file_path = None

    try:

        # ====================================================
        # VALIDATE PDF
        # ====================================================

        if not file.filename.lower().endswith(".pdf"):

            raise HTTPException(
                status_code=400,
                detail="Only PDF files are allowed."
            )


        # ====================================================
        # VALIDATE COUNTS
        # ====================================================

        counts = [

            mcq_count,
            true_false_count,
            fill_blank_count,
            short_answer_count,

            remember_count,
            understand_count,
            apply_count,
            analyze_count,
            evaluate_count,
            create_count
        ]

        if any(
            count < 0
            for count in counts
        ):

            raise HTTPException(
                status_code=400,
                detail="Question counts cannot be negative."
            )


        # ====================================================
        # TOTAL QUESTIONS
        # ====================================================

        total_questions = (

            mcq_count
            + true_false_count
            + fill_blank_count
            + short_answer_count
        )


        if total_questions == 0:

            raise HTTPException(
                status_code=400,
                detail=
                    "At least one question must be requested."
            )


        # ====================================================
        # BLOOM DISTRIBUTION
        # ====================================================

        bloom_distribution = {

            "Remember":
                remember_count,

            "Understand":
                understand_count,

            "Apply":
                apply_count,

            "Analyze":
                analyze_count,

            "Evaluate":
                evaluate_count,

            "Create":
                create_count
        }


        bloom_total = sum(
            bloom_distribution.values()
        )


        if bloom_total != total_questions:

            raise HTTPException(

                status_code=400,

                detail=(
                    f"Bloom total ({bloom_total}) "
                    f"must equal total questions "
                    f"({total_questions})."
                )
            )


        # ====================================================
        # QUESTION TYPE DISTRIBUTION
        # ====================================================

        type_distribution = {

            "MCQ":
                mcq_count,

            "TRUE_FALSE":
                true_false_count,

            "FILL_BLANK":
                fill_blank_count,

            "SHORT_ANSWER":
                short_answer_count
        }


        # ====================================================
        # SAVE TEMPORARY PDF
        # ====================================================

        file_path = os.path.join(
            UPLOAD_DIR,
            file.filename
        )

        content = await file.read()

        with open(
            file_path,
            "wb"
        ) as output_file:

            output_file.write(content)


        # ====================================================
        # PDF → TEXT
        #
        # This is internal.
        # No separate extract endpoint is needed.
        # ====================================================

        text = extract_text_from_pdf(
            file_path
        )

        if not text.strip():

            raise HTTPException(
                status_code=400,
                detail="No readable text found in PDF."
            )


        # ====================================================
        # AGENT 1
        # CONCEPT GRAPH BUILDER
        # ====================================================

        concept_graph = (
            concept_agent.extract_concepts(
                text
            )
        )


        # ====================================================
        # AGENT PIPELINE STATUS
        # ====================================================

        pipeline = {

            "agent1_concept_graph":
                "completed",

            "agent2_question_generation":
                "pending",

            "agent3_balance_check":
                "pending",

            "agent4_validation":
                "pending"
        }


        # ====================================================
        # RETRY LOOP
        # ====================================================

        MAX_ATTEMPTS = 3

        last_questions = []

        last_balance = None

        last_validation = None


        for attempt in range(
            1,
            MAX_ATTEMPTS + 1
        ):


            # =================================================
            # AGENT 2
            # QUESTION GENERATION
            # =================================================

            questions = (
                question_agent.generate_questions(

                    text=text,

                    mcq_count=mcq_count,

                    true_false_count=
                        true_false_count,

                    fill_blank_count=
                        fill_blank_count,

                    short_answer_count=
                        short_answer_count,

                    difficulty=difficulty,

                    bloom_distribution=
                        bloom_distribution,

                    concept_graph=
                        json.dumps(
                            concept_graph,
                            indent=2
                        )
                )
            )


            pipeline[
                "agent2_question_generation"
            ] = "completed"


            # =================================================
            # SYSTEM ENFORCEMENT:
            # EVERY QUESTION = 1 MARK
            # =================================================

            for question in questions:

                question["marks"] = 1


            last_questions = questions


            # =================================================
            # AGENT 3
            # BALANCE CHECK
            # =================================================

            balance_result = (
                balance_agent.check_balance(

                    questions=questions,

                    expected_bloom_distribution=
                        bloom_distribution,

                    expected_type_distribution=
                        type_distribution
                )
            )


            last_balance = balance_result


            if balance_result["valid"]:

                pipeline[
                    "agent3_balance_check"
                ] = "passed"

            else:

                pipeline[
                    "agent3_balance_check"
                ] = "failed"


            # =================================================
            # AGENT 4
            # VALIDATION
            # =================================================

            validation_result = (
                validation_agent.validate_questions(
                    questions
                )
            )


            last_validation = validation_result


            if validation_result["valid"]:

                pipeline[
                    "agent4_validation"
                ] = "passed"

            else:

                pipeline[
                    "agent4_validation"
                ] = "failed"


            # =================================================
            # FINAL SUCCESS CONDITION
            # =================================================

            if (

                balance_result["valid"]

                and

                validation_result["valid"]

            ):


                # =============================================
                # RANDOMIZE QUESTION ORDER
                # =============================================

                random.shuffle(
                    questions
                )


                # =============================================
                # NUMBER QUESTIONS
                # =============================================

                for index, question in enumerate(
                    questions
                ):

                    question["number"] = (
                        index + 1
                    )

                    question["marks"] = 1


                # =============================================
                # SUCCESS RESPONSE
                #
                # NOTE:
                # Concept graph is NOT returned.
                # It was used internally by Agent 2.
                # =============================================

                return {

                    "success": True,

                    "message":
                        "Question generation completed successfully.",

                    "attempts":
                        attempt,

                    "totalQuestions":
                        total_questions,

                    "difficulty":
                        difficulty,

                    "questionTypeDistribution":
                        type_distribution,

                    "bloomDistribution":
                        bloom_distribution,

                    "pipeline":
                        pipeline,

                    "balance":
                        balance_result,

                    "validation":
                        validation_result,

                    "questions":
                        questions
                }


        # ====================================================
        # FAILED AFTER ALL RETRIES
        # ====================================================

        return {

            "success": False,

            "message":
                "Question generation failed quality checks after 3 attempts.",

            "attempts":
                MAX_ATTEMPTS,

            "totalQuestions":
                total_questions,

            "questionTypeDistribution":
                type_distribution,

            "bloomDistribution":
                bloom_distribution,

            "pipeline":
                pipeline,

            "balance":
                last_balance,

            "validation":
                last_validation,

            "questions":
                last_questions
        }


    except HTTPException:
        raise


    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


    finally:

        # ====================================================
        # DELETE TEMPORARY PDF
        # ====================================================

        if (
            file_path
            and os.path.exists(file_path)
        ):

            os.remove(file_path)


# ============================================================
# GOOGLE FORMS
# AGENT 5
# ============================================================

@app.post("/api/deploy-google-form")
async def deploy_google_form(
    request: GoogleFormRequest
):

    try:

        # Convert Pydantic models to dictionaries
        questions = [

            question.model_dump()

            for question in request.questions
        ]


        # ====================================================
        # SAFETY CHECK
        # ====================================================

        for question in questions:

            question["marks"] = 1


        # ====================================================
        # GOOGLE FORMS SERVICE
        # ====================================================

        google_forms_service = (
            GoogleFormsService()
        )


        result = (
            google_forms_service.deploy_quiz(

                title=request.title,

                questions=questions,

                description=request.description
            )
        )


        return {

            "success": True,

            "message":
                "Google Form quiz created successfully.",

            "form":
                result
        }


    except Exception as error:

        print(
            "Google Forms error:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )