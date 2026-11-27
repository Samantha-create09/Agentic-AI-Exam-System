import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import WorkflowStepper from "../components/WorkflowStepper";

const API_URL = "http://localhost:5000";

const BLOOM_FIELDS = [
    "Remember", "Understand", "Apply",
    "Analyze", "Evaluate", "Create"
];

function getTypePillClass(type) {
    if (type === "TRUE_FALSE") return "pill pill-teal";
    if (type === "FILL_BLANK" || type === "SHORT_ANSWER") return "pill pill-amber";
    return "pill pill-indigo";
}

function formatTypeLabel(type) {
    return (type || "").replaceAll("_", " ");
}

async function api(url, body) {
    const response = await fetch(`${API_URL}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        let message = data.message || data.detail || "Request failed.";
        if (data.error === "GEMINI_QUOTA_EXHAUSTED" && data.retry_at) {
            const retryDate = new Date(data.retry_at);
            if (!Number.isNaN(retryDate.getTime())) {
                message = `Gemini quota exhausted. Estimated retry time: ${retryDate.toLocaleString()}.`;
            }
        }
        throw new Error(message);
    }

    return data;
}

function loadJson(key, fallback) {
    try {
        return JSON.parse(sessionStorage.getItem(key) || "null") ?? fallback;
    } catch {
        return fallback;
    }
}

function updateItem(items, index, changes) {
    return items.map((item, i) =>
        i === index ? { ...item, ...changes, marks: 1 } : item
    );
}

export default function ReviewQuestions() {
    const navigate = useNavigate();

    const generationId = sessionStorage.getItem("generationId");
    const settings = loadJson("generationSettings", {});
    const selectedConceptIds = loadJson("selectedConceptIds", []);
    const selectedSubtopicIds = loadJson("selectedSubtopicIds", []);

    const [questions, setQuestions] = useState(
        loadJson("generatedQuestions", [])
    );
    const [loading, setLoading] = useState(false);
    const [retryingQuestion, setRetryingQuestion] = useState(null);
    const [retryingPaper, setRetryingPaper] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [publishedResult, setPublishedResult] = useState(null);
    const [feedback, setFeedback] = useState({});
    const [paperFeedback, setPaperFeedback] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [paperRetryCount, setPaperRetryCount] = useState(0);
    const [individualRetryTotal, setIndividualRetryTotal] = useState(0);
    const [retryCounts, setRetryCounts] = useState({});
    const hasTriggeredGenerateRef = useRef(false);

    const totalMarks = useMemo(
        () => questions.reduce((sum, q) => sum + Number(q.marks || 1), 0),
        [questions]
    );

    useEffect(() => {
        if (!generationId) {
            setError("Generation session not found. Please start again.");
            return;
        }

        fetch(`${API_URL}/api/generation/${encodeURIComponent(generationId)}`)
            .then(response => response.json())
            .then(data => {
                if (!data.success) return;

                if (Array.isArray(data.questions) && data.questions.length) {
                    setQuestions(data.questions);
                    sessionStorage.setItem(
                        "generatedQuestions",
                        JSON.stringify(data.questions)
                    );
                }

                setRetryCounts(data.individual_retry_counts || {});
                setIndividualRetryTotal(data.individual_retry_total || 0);
                setPaperRetryCount(data.paper_retry_count || 0);
            })
            .catch(err => console.error("Could not restore retry status:", err));

        // If arriving from Step 2, generate the paper once (guarded against StrictMode double-mount).
        if (
            !hasTriggeredGenerateRef.current &&
            new URLSearchParams(window.location.search).get("stage") === "generate"
        ) {
            hasTriggeredGenerateRef.current = true;
            generatePaper();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function generatePaper() {
        setLoading(true);
        setError("");
        setPublishedResult(null);
        try {
            const bloomDistribution = {
                Remember: Number(settings.remember_count || 0),
                Understand: Number(settings.understand_count || 0),
                Apply: Number(settings.apply_count || 0),
                Analyze: Number(settings.analyze_count || 0),
                Evaluate: Number(settings.evaluate_count || 0),
                Create: Number(settings.create_count || 0)
            };

            const data = await api("/api/generate-questions", {
                generation_id: generationId,
                selected_concept_ids: selectedConceptIds,
                selected_subtopic_ids: selectedSubtopicIds,
                mcq_count: Number(settings.mcq_count || 0),
                true_false_count: Number(settings.true_false_count || 0),
                statement_mcq_count: Number(settings.statement_mcq_count || 0),
                fill_blank_count: Number(settings.fill_blank_count || 0),
                short_answer_count: Number(settings.short_answer_count || 0),
                difficulty: settings.difficulty || "Medium",
                bloom_distribution: bloomDistribution
            });

            if (!data.success) {
                throw new Error(
                    data.message || "The generated paper did not pass validation."
                );
            }

            setQuestions(data.questions || []);
            sessionStorage.setItem(
                "generatedQuestions",
                JSON.stringify(data.questions || [])
            );
            sessionStorage.setItem("generationSummary", JSON.stringify({
                balance: data.balance,
                validation: data.validation,
                pipeline: data.pipeline,
                totalQuestions: data.totalQuestions
            }));
            window.history.replaceState({}, "", "/review-questions");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function saveQuestions(next) {
        setQuestions(next);
        sessionStorage.setItem("generatedQuestions", JSON.stringify(next));
    }

    function changeQuestion(index, field, value) {
        saveQuestions(updateItem(questions, index, { [field]: value }));
    }

    async function retryOne(question) {
        setError("");
        setNotice("");

        if (!feedback[question.question_id]?.trim()) {
            setError("Enter feedback explaining what should be improved.");
            return;
        }

        setRetryingQuestion(question.question_id);
        try {
            const data = await api("/api/retry-question", {
                generation_id: generationId,
                question_id: question.question_id,
                feedback: feedback[question.question_id]
            });

            saveQuestions(data.questions);
            setRetryCounts(current => ({
                ...current,
                [question.question_id]: data.retry.question_retry_count
            }));
            setIndividualRetryTotal(data.retry.paper_individual_retry_count);
            setNotice(
                `Question replaced. ${data.retry.question_retries_remaining} retries remain for this question; ${data.retry.paper_individual_retries_remaining} individual retries remain for the paper.`
            );
            setFeedback(current => ({
                ...current,
                [question.question_id]: ""
            }));
        } catch (err) {
            setError(err.message);
        } finally {
            setRetryingQuestion(null);
        }
    }

    async function retryWholePaper() {
        setError("");
        setNotice("");
        setPublishedResult(null);
        setRetryingPaper(true);
        try {
            const data = await api("/api/retry-paper", {
                generation_id: generationId,
                feedback: paperFeedback
            });
            saveQuestions(data.questions);
            setPaperRetryCount(1);
            setNotice("The paper has been regenerated from the cached selected material.");
        } catch (err) {
            setError(err.message);
        } finally {
            setRetryingPaper(false);
        }
    }

    async function publish() {
        setError("");
        setNotice("");

        if (!questions.length) {
            setError("There are no questions to publish.");
            return;
        }

        setPublishing(true);
        try {
            const examTitle = sessionStorage.getItem("examTitle") || "Examination";
            const data = await api("/api/deploy-google-form", {
                title: examTitle,
                description: sessionStorage.getItem("examSubject") || "",
                questions: questions.map(q => ({
                    question: q.question,
                    type: q.type,
                    options: q.options || [],
                    correctAnswer: q.correctAnswer || "",
                    acceptedAnswers: q.acceptedAnswers || [],
                    marks: 1,
                    bloomLevel: q.bloomLevel,
                    difficulty: q.difficulty,
                    concept: q.concept || "",
                    explanation: q.explanation || ""
                }))
            });

            const form = data.form || {};
            const formUrl = form.formUrl || form.responderUri || "";
            const publishedExam = {
                ...form,
                formUrl,
                editUrl: form.editUrl || "",
                title: form.title || examTitle,
                formTitle: form.title || examTitle,
                questionCount: form.questionCount ?? questions.length,
                publishedAt: new Date().toISOString()
            };

            if (formUrl) {
                sessionStorage.setItem("publishedForm", JSON.stringify(publishedExam));
                const existing = loadJson("publishedExams", []);
                const list = Array.isArray(existing) ? existing : [];
                const deduped = [
                    publishedExam,
                    ...list.filter(item => item?.formUrl && item.formUrl !== formUrl)
                ];
                sessionStorage.setItem("publishedExams", JSON.stringify(deduped));
                setPublishedResult(publishedExam);
            }

            setNotice(
                formUrl
                    ? `Google Form created: ${formUrl}`
                    : "Google Form created successfully."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setPublishing(false);
        }
    }

    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <div className="topbar">
                    <div className="topbar-title">Review &amp; Publish</div>

                    <div className="user-area">
                        <strong>Teacher</strong>
                        <div className="avatar">T</div>
                    </div>
                </div>

                <div className="content">
                    <WorkflowStepper
                        currentStep={publishedResult ? 4 : 3}
                        published={Boolean(publishedResult)}
                    />

                    {loading ? (
                        <div className="workflow-page review-page">
                            <div className="processing-card">
                                <div className="loader" />
                                <h2>Generating your examination</h2>
                                <p>
                                    Agent 2 is generating questions from your approved syllabus pages.
                                    Agents 3 and 4 are verifying balance and format.
                                </p>
                            </div>
                        </div>
                    ) : !generationId ? (
                        <div className="workflow-page review-page">
                            <div className="workflow-card">
                                <h2>Generation session not found</h2>
                                <p className="workflow-step">
                                    Please upload and analyse your study material first.
                                </p>
                                <div className="workflow-actions">
                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={() => navigate("/generate-questions")}
                                    >
                                        Back to Step 1
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="workflow-page review-page">
                            <header className="workflow-header">
                                <div>
                                    <p className="eyebrow">Step 3 &amp; 4</p>
                                    <h1>Review &amp; Publish Paper</h1>
                                    <p className="workflow-step">
                                        Inspect, edit, or regenerate questions before deploying your quiz to Google Forms.
                                    </p>
                                </div>
                            </header>

                            <div className="workflow-card">
                                <div className="review-summary-bar">
                                    <div className="review-stat-pills">
                                        <span className="stat-pill">
                                            Questions: <strong>{questions.length}</strong>
                                        </span>
                                        <span className="stat-pill">
                                            Total marks: <strong>{totalMarks}</strong>
                                        </span>
                                    </div>
                                    <span className="pill pill-gold">
                                        {sessionStorage.getItem("examTitle") || "Examination Paper"}
                                    </span>
                                </div>

                                {questions.map((question, index) => (
                                    <article className="question-card" key={question.question_id || index}>
                                        <div className="question-card-top">
                                            <h2>Question {index + 1}</h2>
                                            <div className="badge-group">
                                                <span className={getTypePillClass(question.type)}>
                                                    {formatTypeLabel(question.type)}
                                                </span>
                                                <span className="pill pill-indigo">
                                                    {question.bloomLevel}
                                                </span>
                                                <span className="pill pill-gold">1 mark</span>
                                            </div>
                                        </div>

                                        <label>
                                            Question text
                                            <textarea
                                                rows={3}
                                                value={question.question}
                                                onChange={e => changeQuestion(index, "question", e.target.value)}
                                            />
                                        </label>

                                        {["MCQ", "TRUE_FALSE", "STATEMENT_MCQ"].includes(question.type) && (
                                            <label>
                                                Options (one per line)
                                                <textarea
                                                    rows={4}
                                                    value={(question.options || []).join("\n")}
                                                    onChange={e => changeQuestion(
                                                        index,
                                                        "options",
                                                        e.target.value.split("\n").map(x => x.trim()).filter(Boolean)
                                                    )}
                                                />
                                            </label>
                                        )}

                                        <div className="form-grid">
                                            <label>
                                                Correct answer
                                                <input
                                                    value={question.correctAnswer || ""}
                                                    onChange={e => changeQuestion(index, "correctAnswer", e.target.value)}
                                                />
                                            </label>
                                            <label>
                                                Bloom level
                                                <select
                                                    value={question.bloomLevel}
                                                    onChange={e => changeQuestion(index, "bloomLevel", e.target.value)}
                                                >
                                                    {BLOOM_FIELDS.map(level => <option key={level}>{level}</option>)}
                                                </select>
                                            </label>
                                        </div>

                                        {["FILL_BLANK", "SHORT_ANSWER"].includes(question.type) && (
                                            <label>
                                                Accepted answers (comma-separated)
                                                <input
                                                    value={(question.acceptedAnswers || []).join(", ")}
                                                    onChange={e => changeQuestion(
                                                        index,
                                                        "acceptedAnswers",
                                                        e.target.value.split(",").map(x => x.trim()).filter(Boolean)
                                                    )}
                                                />
                                            </label>
                                        )}

                                        <div className="question-meta-row">
                                            <div>
                                                <strong>Concept:</strong> {question.concept || "Not specified"}
                                            </div>
                                            <div>
                                                <strong>Source:</strong>{" "}
                                                {question.source
                                                    ? `${(question.source.files || []).join(", ")} · pp. ${(question.source.pages || []).join(", ")}`
                                                    : "Source metadata unavailable"}
                                            </div>
                                        </div>

                                        <div className="retry-box">
                                            <label>
                                                Teacher feedback for single-question retry
                                                <textarea
                                                    rows={2}
                                                    value={feedback[question.question_id] || ""}
                                                    onChange={e => setFeedback(current => ({
                                                        ...current,
                                                        [question.question_id]: e.target.value
                                                    }))}
                                                    placeholder="Explain what is incorrect or should be improved..."
                                                />
                                            </label>

                                            <button
                                                type="button"
                                                className="secondary-button"
                                                disabled={
                                                    retryingQuestion === question.question_id ||
                                                    (retryCounts[question.question_id] || 0) >= 2 ||
                                                    individualRetryTotal >= 10
                                                }
                                                onClick={() => retryOne(question)}
                                            >
                                                {retryingQuestion === question.question_id
                                                    ? "Retrying..."
                                                    : "Retry this question"}
                                            </button>

                                            {(
                                                (retryCounts[question.question_id] || 0) > 0 ||
                                                individualRetryTotal >= 10
                                            ) && (
                                                <p className="retry-warning">
                                                    Limit: 2 retries per question; 10 individual retries per paper.
                                                    {(retryCounts[question.question_id] || 0) >= 2
                                                        ? " This question has no retries remaining."
                                                        : ` ${2 - (retryCounts[question.question_id] || 0)} question retries remaining.`}
                                                    {individualRetryTotal >= 10
                                                        ? " The paper has no individual retries remaining."
                                                        : ""}
                                                </p>
                                            )}
                                        </div>
                                    </article>
                                ))}

                                <div className="paper-retry-card">
                                    <h2>Retry the entire paper</h2>
                                    <p className="retry-warning">
                                        You can regenerate the entire paper once using your cached selected material.
                                    </p>
                                    <textarea
                                        rows={3}
                                        value={paperFeedback}
                                        onChange={e => setPaperFeedback(e.target.value)}
                                        placeholder="Optional feedback for the complete paper..."
                                    />
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        disabled={paperRetryCount >= 1 || retryingPaper}
                                        onClick={retryWholePaper}
                                    >
                                        {retryingPaper ? "Regenerating paper..." : "Retry entire paper once"}
                                    </button>
                                    {paperRetryCount >= 1 && (
                                        <p className="retry-warning">
                                            The whole-paper retry limit has been reached. No further paper retries are available.
                                        </p>
                                    )}
                                </div>

                                {error && <div className="error-box" role="alert">{error}</div>}
                                {notice && !publishedResult && <div className="notice-box">{notice}</div>}

                                {publishedResult && (
                                    <div className="published-banner">
                                        <strong>Google Form quiz published and saved</strong>
                                        <div className="published-banner-links">
                                            {publishedResult.formUrl && (
                                                <a
                                                    href={publishedResult.formUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Open Student Form
                                                </a>
                                            )}
                                            {publishedResult.editUrl && (
                                                <a
                                                    href={publishedResult.editUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Open Form Editor
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="publish-action-bar">
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => navigate("/select-concepts")}
                                    >
                                        Back to concept selection
                                    </button>
                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={publish}
                                        disabled={publishing || !questions.length}
                                    >
                                        {publishing ? "Publishing to Google Forms..." : "Publish to Google Forms"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
