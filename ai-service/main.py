
import os
import re
import uuid
import random
from datetime import datetime, timedelta
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from agents.concept_agent import ConceptAgent
from agents.question_agent import QuestionAgent
from agents.balance_agent import BalanceAgent
from agents.validation_agent import ValidationAgent
from services.pdf_service import extract_text_from_pdf, extract_text_from_pdfs
from services.google_forms_service import GoogleFormsService
from services.llm_service import GeminiQuotaError, GeminiTemporaryError
from services.storage_service import storage_service


load_dotenv()

app = FastAPI(
    title="Agentic AI Exam System",
    description="Four-step Agentic AI examination workflow",
    version="2.0.0"
)

MAX_FILES = 5
MAX_FILE_SIZE = 25 * 1024 * 1024
MAX_TOTAL_SIZE = 100 * 1024 * 1024
MAX_COMBINED_PAGES = 500

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

concept_agent = ConceptAgent()
question_agent = QuestionAgent()
balance_agent = BalanceAgent()
validation_agent = ValidationAgent()


@app.exception_handler(GeminiQuotaError)
async def quota_handler(request, exc):
    delay = getattr(exc, "retry_after_seconds", None)
    retry_at = None
    message = (
        "Gemini's available quota has been exhausted. "
        "Google did not provide a reliable reset time. "
        "Check your Google AI Studio quota before trying again."
    )
    if delay and delay > 0:
        retry_at = datetime.now().astimezone() + timedelta(seconds=delay)
        hours, remainder = divmod(int(delay), 3600)
        minutes, seconds = divmod(remainder, 60)
        message = (
            "Gemini's available quota has been exhausted. "
            f"Estimated retry delay: {hours} hours, {minutes} minutes, "
            f"{seconds} seconds. Approximate retry time: "
            f"{retry_at.strftime('%d %b %Y, %I:%M %p %Z')}."
        )
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": "GEMINI_QUOTA_EXHAUSTED",
            "message": message,
            "detail": str(exc),
            "retry_after_seconds": delay,
            "retry_at": retry_at.isoformat() if retry_at else None
        }
    )


@app.exception_handler(GeminiTemporaryError)
async def temporary_handler(request, exc):
    delay = getattr(exc, "retry_after_seconds", None)
    message = "Gemini is temporarily unavailable. Please try again later."
    if delay:
        message += f" Suggested delay: approximately {int(delay)} seconds."
    return JSONResponse(
        status_code=503,
        content={
            "success": False,
            "error": "GEMINI_TEMPORARILY_UNAVAILABLE",
            "message": message,
            "detail": str(exc),
            "retry_after_seconds": delay
        }
    )


class GenerateRequest(BaseModel):
    generation_id: str
    selected_concept_ids: list[str]
    selected_subtopic_ids: list[str] = Field(default_factory=list)
    mcq_count: int = 0
    true_false_count: int = 0
    statement_mcq_count: int = 0
    fill_blank_count: int = 0
    short_answer_count: int = 0
    difficulty: Literal["Low", "Medium", "High"] = "Medium"
    bloom_distribution: dict[str, int]


class ConceptSearchRequest(BaseModel):
    generation_id: str
    query: str

class AddConceptRequest(BaseModel):
    generation_id: str
    query: str
    matches: list[dict]
    assessment: dict

class QuestionRetryRequest(BaseModel):
    generation_id: str
    question_id: str
    feedback: str


class PaperRetryRequest(BaseModel):
    generation_id: str
    feedback: str = ""


class QuestionModel(BaseModel):
    question: str
    type: Literal[
        "MCQ", "TRUE_FALSE", "STATEMENT_MCQ", "FILL_BLANK", "SHORT_ANSWER"
    ]
    options: list[str] = Field(default_factory=list)
    correctAnswer: str
    acceptedAnswers: list[str] = Field(default_factory=list)
    marks: int = 1
    bloomLevel: Literal[
        "Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"
    ]
    difficulty: Literal["Low", "Medium", "High"]
    concept: str
    explanation: str
    number: int | None = None
    question_id: str | None = None
    source: dict | None = None


class GoogleFormRequest(BaseModel):
    title: str
    description: str = ""
    questions: list[QuestionModel]


def _save_uploads(uploaded_files):
    if not uploaded_files:
        raise HTTPException(400, "Please upload at least one PDF.")
    if len(uploaded_files) > MAX_FILES:
        raise HTTPException(400, f"Maximum {MAX_FILES} PDF files allowed.")

    paths = []
    total = 0
    try:
        for file in uploaded_files:
            name = file.filename or "upload.pdf"
            if not name.lower().endswith(".pdf"):
                raise HTTPException(400, f"Only PDF files are allowed: {name}")
            content = file.file.read()
            if not content:
                raise HTTPException(400, f"The PDF is empty: {name}")
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(400, f"{name} exceeds 25 MB.")
            total += len(content)
            if total > MAX_TOTAL_SIZE:
                raise HTTPException(400, "Combined PDF size exceeds 100 MB.")

            path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}.pdf")
            with open(path, "wb") as output:
                output.write(content)
            paths.append(path)
        return paths
    except Exception:
        _cleanup(paths)
        raise


def _cleanup(paths):
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
        except OSError:
            pass


def _get_record(generation_id):
    record = storage_service.get_generation(generation_id)
    if not record:
        raise HTTPException(404, "Generation session not found.")
    return record


def _selected_text(record, concept_ids, subtopic_ids=None):
    concept_ids = set(concept_ids or [])
    subtopic_ids = set(subtopic_ids or [])
    graph = record["concept_graph"]

    selected_concepts = []
    selected_names = []
    source_keys = set()

    for concept in graph.get("concepts", []):
        parent_selected = concept["id"] in concept_ids
        selected_subtopics = [
            sub for sub in concept.get("subtopics", [])
            if sub["id"] in subtopic_ids
        ]

        if parent_selected:
            selected_concepts.append(concept)
            selected_names.append(concept["name"])
            for source in concept.get("sources", []):
                for page in source.get("pages", []):
                    source_keys.add((source["file"], page))

        elif selected_subtopics:
            selected_concepts.append(concept)
            for sub in selected_subtopics:
                selected_names.append(sub["name"])
                for source in sub.get("sources", []):
                    for page in source.get("pages", []):
                        source_keys.add((source["file"], page))

    if not selected_concepts:
        raise HTTPException(400, "Select at least one concept or subtopic.")

    pages = concept_agent.split_pages(record["extracted_text"])
    selected_pages = [
        page for page in pages
        if (page["file"], page["page"]) in source_keys
    ]

    if not selected_pages:
        raise HTTPException(
            400,
            "No source pages were found for the selected concepts. "
            "Please re-analyse the uploaded material."
        )

    text = "\n\n".join(
        f"--- File: {p['file']} | Page {p['page']} ---\n{p['text']}"
        for p in selected_pages
    )

    return text, selected_concepts, selected_pages, selected_names

def _validate_counts(request):
    type_counts = {
        "MCQ": request.mcq_count,
        "TRUE_FALSE": request.true_false_count,
        "STATEMENT_MCQ": request.statement_mcq_count,
        "FILL_BLANK": request.fill_blank_count,
        "SHORT_ANSWER": request.short_answer_count
    }
    if any(v < 0 for v in type_counts.values()):
        raise HTTPException(400, "Question counts cannot be negative.")

    total = sum(type_counts.values())
    if total < 1:
        raise HTTPException(400, "Request at least one question.")

    bloom = {
        level: int(request.bloom_distribution.get(level, 0))
        for level in question_agent.BLOOM_LEVELS
    }
    if any(v < 0 for v in bloom.values()) or sum(bloom.values()) != total:
        raise HTTPException(
            400, "Bloom counts must be non-negative and equal total questions."
        )
    return type_counts, bloom, total


def _run_quality_checks(questions, type_counts, bloom):
    balance = balance_agent.check_balance(
        questions=questions,
        expected_bloom_distribution=bloom,
        expected_type_distribution=type_counts
    )
    validation = validation_agent.validate_questions(questions)
    return balance, validation


def _attach_sources(questions, concept_names, pages):
    fallback_source = {
        "files": sorted({p["file"] for p in pages}),
        "pages": sorted({p["page"] for p in pages})
    }

    for question in questions:
        if not question.get("concept"):
            question["concept"] = (
                concept_names[0] if concept_names else "Selected concept"
            )

        if not question.get("source"):
            question["source"] = fallback_source.copy()

        question["question_id"] = (
            question.get("question_id") or str(uuid.uuid4())
        )
        question["marks"] = 1

    return questions

@app.get("/")
def root():
    return {"message": "Agentic AI Exam System AI Service is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/api/test")
def test():
    return {"message": "FastAPI AI service is working"}


# STEP 1: Upload, extract and analyse once.
@app.post("/api/analyze-material")
async def analyze_material(files: list[UploadFile] = File(...)):
    paths = []
    try:
        paths = _save_uploads(files)
        text, total_pages = extract_text_from_pdfs(
            paths, max_pages=MAX_COMBINED_PAGES
        )
        if not text.strip():
            raise HTTPException(400, "No readable PDF text was extracted.")

        graph = concept_agent.extract_concepts(text)
        saved = storage_service.create_generation({
            "extracted_text": text,
            "concept_graph": graph,
            "total_pdf_pages": total_pages,
            "source_files": [f.filename for f in files],
            "questions": [],
            "settings": {},
            "selected_concept_ids": [],
            "selected_subtopic_ids": []
        })
        return {
            "success": True,
            "generation_id": saved["generation_id"],
            "totalPdfPages": total_pages,
            "sourceFiles": saved["source_files"],
            "conceptGraph": graph,
            "message": "Study material analysed and cached successfully."
        }
    except HTTPException:
        raise
    except (GeminiQuotaError, GeminiTemporaryError):
        raise
    except Exception as exc:
        print("Material analysis error:", exc)
        raise HTTPException(500, str(exc))
    finally:
        _cleanup(paths)


# STEP 2: Search cached material and assess evidence.
@app.post("/api/search-concept")
def search_concept(request: ConceptSearchRequest):
    record = _get_record(request.generation_id)
    excerpts = concept_agent.search_material(
        record["extracted_text"], request.query, limit=10
    )
    assessment = concept_agent.assess_concept(request.query, excerpts)
    return {
        "success": True,
        "query": request.query,
        "matches": excerpts,
        "assessment": assessment,
        "can_select": assessment.get("status") == "adequate"
    }

@app.post("/api/add-concept")
def add_concept(request: AddConceptRequest):
    record = _get_record(request.generation_id)

    if request.assessment.get("status") != "adequate":
        raise HTTPException(
            400,
            "This concept cannot be added because the uploaded material "
            "does not adequately explain it."
        )

    name = request.query.strip()
    if not name:
        raise HTTPException(400, "Concept name is required.")

    graph = record["concept_graph"]
    existing = next(
        (c for c in graph.get("concepts", [])
         if c["name"].casefold() == name.casefold()),
        None
    )
    if existing:
        return {"success": True, "concept": existing, "message": "Concept already exists."}

    sources = []
    for match in request.matches:
        source = {
            "file": match.get("file", "Uploaded material"),
            "pages": match.get("pages", [])
        }
        if source not in sources:
            sources.append(source)

    concept = {
        "id": str(uuid.uuid4()),
        "name": name,
        "description": request.assessment.get("explanation", ""),
        "sources": sources,
        "subtopics": [],
        "teacher_added": True,
        "evidence_status": "adequate"
    }

    graph.setdefault("concepts", []).append(concept)
    storage_service.update_generation(
        request.generation_id,
        {"concept_graph": graph}
    )

    return {
        "success": True,
        "concept": concept,
        "message": "Evidence-supported concept added."
    }

# STEP 3: Generate from teacher-selected concepts only.
@app.post("/api/generate-questions")
def generate_questions(request: GenerateRequest):
    record = _get_record(request.generation_id)
    type_counts, bloom, total = _validate_counts(request)

    selected_text, concepts, pages, names = _selected_text(
        record,
        request.selected_concept_ids,
        request.selected_subtopic_ids
    )

    questions = question_agent.generate_questions(
        text=selected_text,
        mcq_count=type_counts["MCQ"],
        true_false_count=type_counts["TRUE_FALSE"],
        statement_mcq_count=type_counts["STATEMENT_MCQ"],
        fill_blank_count=type_counts["FILL_BLANK"],
        short_answer_count=type_counts["SHORT_ANSWER"],
        difficulty=request.difficulty,
        bloom_distribution=bloom,
        concept_graph={"selected_concepts": names}
    )

    questions = _attach_sources(questions, names, pages)
    random.shuffle(questions)
    for number, question in enumerate(questions, 1):
        question["number"] = number

    balance, validation = _run_quality_checks(questions, type_counts, bloom)
    if not balance.get("valid") or not validation.get("valid"):
        return {
            "success": False,
            "generation_id": request.generation_id,
            "message": "Generated questions did not pass local quality checks. Review the reported issues.",
            "balance": balance,
            "validation": validation,
            "questions": questions
        }

    storage_service.update_generation(request.generation_id, {
        "questions": questions,
        "settings": {
            "type_counts": type_counts,
            "bloom_distribution": bloom,
            "difficulty": request.difficulty,
            "total_questions": total
        },
        "selected_concept_ids": request.selected_concept_ids,
        "selected_subtopic_ids": request.selected_subtopic_ids,
        "selected_source_text": selected_text,
        "selected_source_pages": pages,
        "selected_concept_names": names,
        "status": "questions_generated"
    })

    return {
        "success": True,
        "generation_id": request.generation_id,
        "message": "Questions generated and validated.",
        "totalQuestions": len(questions),
        "totalPdfPages": record["total_pdf_pages"],
        "conceptGraph": record["concept_graph"],
        "questions": questions,
        "balance": balance,
        "validation": validation,
        "pipeline": {
            "agent1_concept_graph": "completed",
            "agent2_question_generation": "completed",
            "agent3_balance_check": "passed",
            "agent4_validation": "passed"
        }
    }


# STEP 3: Replace one question using only its saved source pages.
@app.post("/api/retry-question")
def retry_question(request: QuestionRetryRequest):
    record = _get_record(request.generation_id)
    questions = record.get("questions", [])
    index = next(
        (i for i, q in enumerate(questions)
         if q.get("question_id") == request.question_id),
        None
    )
    if index is None:
        raise HTTPException(404, "Question not found in this paper.")

    try:
        retry_info = storage_service.reserve_question_retry(
            request.generation_id, request.question_id
        )
    except ValueError as exc:
        raise HTTPException(429, str(exc))

    original = questions[index]
    question_source = original.get("source") or {}
    source_files = set(question_source.get("files", []))
    source_pages = set(question_source.get("pages", []))

    matching_pages = [
        page for page in record.get("selected_source_pages", [])
        if page["file"] in source_files
        and page["page"] in source_pages
    ]

    if not matching_pages:
        raise HTTPException(
            409,
            "The original question's source pages are unavailable. "
            "The question cannot be retried safely."
        )

    source_text = "\n\n".join(
        f"--- File: {page['file']} | Page {page['page']} ---\n{page['text']}"
        for page in matching_pages
    )

    type_key = original["type"]
    bloom_key = original["bloomLevel"]
    counts = {t: int(t == type_key) for t in question_agent.QUESTION_TYPES}
    bloom = {b: int(b == bloom_key) for b in question_agent.BLOOM_LEVELS}

    replacement_list = question_agent.generate_questions(
        text=source_text,
        mcq_count=counts["MCQ"],
        true_false_count=counts["TRUE_FALSE"],
        statement_mcq_count=counts["STATEMENT_MCQ"],
        fill_blank_count=counts["FILL_BLANK"],
        short_answer_count=counts["SHORT_ANSWER"],
        difficulty=original.get("difficulty", "Medium"),
        bloom_distribution=bloom,
        concept_graph={"selected_concepts": [original.get("concept", "")]},
        retry_reason=(
            "Replace this previous question; do not repeat it.\n"
            f"Previous question: {original['question']}\n"
            f"Teacher feedback: {request.feedback}"
        )
    )
    replacement = replacement_list[0]
    replacement["question_id"] = request.question_id
    replacement["source"] = original.get("source")
    replacement["number"] = original.get("number")
    replacement["marks"] = 1

    questions[index] = replacement
    storage_service.update_generation(request.generation_id, {
        "questions": questions
    })

    return {
        "success": True,
        "question": replacement,
        "questions": questions,
        "retry": retry_info
    }


# STEP 3: Regenerate the whole paper once, using cached selected material.
@app.post("/api/retry-paper")
def retry_paper(request: PaperRetryRequest):
    record = _get_record(request.generation_id)
    try:
        retry_info = storage_service.reserve_paper_retry(request.generation_id)
    except ValueError as exc:
        raise HTTPException(429, str(exc))

    settings = record.get("settings", {})
    if not settings:
        raise HTTPException(409, "Generation settings are missing.")

    source_text = record.get("selected_source_text", "")
    pages = record.get("selected_source_pages", [])
    names = record.get("selected_concept_names", [])
    counts = settings["type_counts"]
    bloom = settings["bloom_distribution"]

    questions = question_agent.generate_questions(
        text=source_text,
        mcq_count=counts["MCQ"],
        true_false_count=counts["TRUE_FALSE"],
        statement_mcq_count=counts["STATEMENT_MCQ"],
        fill_blank_count=counts["FILL_BLANK"],
        short_answer_count=counts["SHORT_ANSWER"],
        difficulty=settings["difficulty"],
        bloom_distribution=bloom,
        concept_graph={"selected_concepts": names},
        retry_reason=request.feedback
    )
    questions = _attach_sources(questions, names, pages)
    random.shuffle(questions)
    for number, question in enumerate(questions, 1):
        question["number"] = number

    balance, validation = _run_quality_checks(questions, counts, bloom)
    storage_service.update_generation(request.generation_id, {
        "questions": questions,
        "status": "questions_generated"
    })

    return {
        "success": True,
        "generation_id": request.generation_id,
        "questions": questions,
        "balance": balance,
        "validation": validation,
        "retry": retry_info
    }


# Legacy endpoint retained for older single-PDF callers.
@app.post("/api/build-concepts")
async def build_concepts(file: UploadFile = File(...)):
    paths = []
    try:
        paths = _save_uploads([file])
        text = extract_text_from_pdf(paths[0])
        graph = concept_agent.extract_concepts(text)
        return {"success": True, "conceptGraph": graph}
    finally:
        _cleanup(paths)


# Existing Google Forms deployment endpoint retained.
@app.post("/api/deploy-google-form")
def deploy_google_form(request: GoogleFormRequest):
    if not request.title.strip():
        raise HTTPException(400, "Google Form title is required.")
    if not request.questions:
        raise HTTPException(400, "At least one question is required.")

    questions = [q.model_dump() for q in request.questions]
    for q in questions:
        q["marks"] = 1

    service = GoogleFormsService()
    result = service.deploy_quiz(
        title=request.title.strip(),
        questions=questions,
        description=request.description
    )
    return {
        "success": True,
        "message": "Google Form quiz created successfully.",
        "form": result
    }

@app.get("/api/generation/{generation_id}")
def get_generation_status(generation_id: str):
    record = _get_record(generation_id)

    return {
        "success": True,
        "generation_id": generation_id,
        "questions": record.get("questions", []),
        "individual_retry_counts": record.get("individual_retry_counts", {}),
        "individual_retry_total": record.get("individual_retry_total", 0),
        "paper_retry_count": record.get("paper_retry_count", 0),
        "status": record.get("status")
    }