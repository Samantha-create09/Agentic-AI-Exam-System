
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:5000";

const BLOOM_FIELDS = [
    "Remember", "Understand", "Apply",
    "Analyze", "Evaluate", "Create"
];

const TYPE_FIELDS = [
    "MCQ", "TRUE_FALSE", "STATEMENT_MCQ",
    "FILL_BLANK", "SHORT_ANSWER"
];

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
    const [feedback, setFeedback] = useState({});
    const [paperFeedback, setPaperFeedback] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [paperRetryCount, setPaperRetryCount] = useState(0);
    const [individualRetryTotal, setIndividualRetryTotal] = useState(0);
    const [retryCounts, setRetryCounts] = useState({});

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

        // If arriving from Step 2, generate the paper now.
        if (new URLSearchParams(window.location.search).get("stage") === "generate") {
            generatePaper();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function generatePaper() {
        setLoading(true);
        setError("");
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

    async function retryOne(question, index) {
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
            const data = await api("/api/deploy-google-form", {
                title: sessionStorage.getItem("examTitle") || "Examination",
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

            setNotice(
                data.form?.responderUri
                    ? `Google Form created: ${data.form.responderUri}`
                    : "Google Form created successfully."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setPublishing(false);
        }
    }

    if (loading) {
        return (
            <main className="workflow-page">
                <div className="processing-card">
                    <div className="loader" />
                    <h2>Generating your examination</h2>
                    <p>Agent 2 is generating from the approved source pages. Agents 3 and 4 will check the result.</p>
                </div>
            </main>
        );
    }

    return (
        <div className="workflow-page">
            <header className="workflow-header">
                <div>
                    <p className="eyebrow">Agentic AI Exam System</p>
                    <h1>Review Questions</h1>
                    <p>Step 3 of 4 — Review, edit and improve the generated paper.</p>
                </div>
            </header>

            <main className="workflow-card">
                <div className="total-line">
                    <span>Total questions: <strong>{questions.length}</strong></span>
                    <span>Total marks: <strong>{totalMarks}</strong></span>
                </div>

                {questions.map((question, index) => (
                    <article className="question-card" key={question.question_id || index}>
                        <div className="section-heading">
                            <h2>Question {index + 1}</h2>
                            <span>{question.type} · 1 mark</span>
                        </div>

                        <label>
                            Question
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

                        <p>
                            <strong>Concept:</strong> {question.concept || "Not specified"}
                        </p>
                        <p>
                            <strong>Source:</strong>{" "}
                            {question.source
                                ? `${(question.source.files || []).join(", ")} · pages ${(question.source.pages || []).join(", ")}`
                                : "Source metadata unavailable"}
                        </p>

                        <label>
                            Teacher feedback for retry
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
                            onClick={() => retryOne(question, index)}
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
                    </article>
                ))}

                <section>
                    <h2>Retry the entire paper</h2>
                    <p className="retry-warning">
                        You can retry the entire paper once. This uses the cached selected source material.
                    </p>
                    <textarea
                        rows={3}
                        value={paperFeedback}
                        onChange={e => setPaperFeedback(e.target.value)}
                        placeholder="Optional feedback for the complete paper..."
                    />
                    <button
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
                </section>

                {error && <div className="error-box" role="alert">{error}</div>}
                {notice && <div className="notice-box">{notice}</div>}

                <button className="primary-button" onClick={publish} disabled={publishing || !questions.length}>
                    {publishing ? "Publishing..." : "Publish to Google Forms"}
                </button>

                <button className="secondary-button"
                    onClick={() => navigate("/select-concepts")}>
                    Back to concept selection
                </button>
            </main>
        </div>
    );
}