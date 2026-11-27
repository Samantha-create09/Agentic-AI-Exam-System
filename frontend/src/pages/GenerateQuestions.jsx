import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import WorkflowStepper from "../components/WorkflowStepper";

const API_URL = "http://localhost:5000";

const typeFields = [
    ["mcq_count", "Regular MCQ"],
    ["true_false_count", "True / False"],
    ["statement_mcq_count", "Statement MCQ"],
    ["fill_blank_count", "Fill in the Blank"],
    ["short_answer_count", "Short Answer"]
];

const bloomFields = [
    ["remember_count", "Remember"],
    ["understand_count", "Understand"],
    ["apply_count", "Apply"],
    ["analyze_count", "Analyze"],
    ["evaluate_count", "Evaluate"],
    ["create_count", "Create"]
];

const initial = {
    mcq_count: 2,
    true_false_count: 1,
    statement_mcq_count: 1,
    fill_blank_count: 1,
    short_answer_count: 0,
    difficulty: "Medium",
    remember_count: 1,
    understand_count: 2,
    apply_count: 1,
    analyze_count: 1,
    evaluate_count: 0,
    create_count: 0
};

async function readResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        let message = data.message || data.detail || "Request failed.";
        if (data.error === "GEMINI_QUOTA_EXHAUSTED" && data.retry_at) {
            const date = new Date(data.retry_at);
            if (!Number.isNaN(date.getTime())) {
                message = `Gemini quota exhausted. Estimated retry time: ${date.toLocaleString()}.`;
            }
        }
        throw new Error(message);
    }
    return data;
}

export default function GenerateQuestions() {
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [values, setValues] = useState(initial);
    const [title, setTitle] = useState(sessionStorage.getItem("examTitle") || "");
    const [subject, setSubject] = useState(sessionStorage.getItem("examSubject") || "");
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const totalQuestions = useMemo(
        () => typeFields.reduce((sum, [key]) => sum + Number(values[key]), 0),
        [values]
    );
    const totalBloom = useMemo(
        () => bloomFields.reduce((sum, [key]) => sum + Number(values[key]), 0),
        [values]
    );

    function update(key, value) {
        setValues(current => ({ ...current, [key]: value }));
    }

    function processFiles(chosenList) {
        setError("");
        const merged = [...files];

        for (const file of chosenList) {
            if (!file.name.toLowerCase().endsWith(".pdf")) {
                setError(`${file.name} is not a PDF.`);
                return;
            }
            if (file.size > 25 * 1024 * 1024) {
                setError(`${file.name} exceeds 25 MB.`);
                return;
            }
            if (!merged.some(f => f.name === file.name && f.size === file.size)) {
                merged.push(file);
            }
        }

        if (merged.length > 5) {
            setError("You can upload a maximum of 5 PDFs.");
            return;
        }
        if (merged.reduce((sum, f) => sum + f.size, 0) > 100 * 1024 * 1024) {
            setError("Combined PDF size cannot exceed 100 MB.");
            return;
        }
        setFiles(merged);
    }

    function selectFiles(event) {
        processFiles(Array.from(event.target.files || []));
        event.target.value = "";
    }

    function handleDrop(event) {
        event.preventDefault();
        setDragging(false);
        processFiles(Array.from(event.dataTransfer?.files || []));
    }

    async function analyse(event) {
        event.preventDefault();
        setError("");

        if (!title.trim()) return setError("Enter an exam title.");
        if (!files.length) return setError("Upload at least one PDF.");
        if (totalQuestions < 1) return setError("Select at least one question.");
        if (totalBloom !== totalQuestions) {
            return setError(`Bloom total (${totalBloom}) must equal question total (${totalQuestions}).`);
        }

        setLoading(true);
        try {
            const form = new FormData();
            files.forEach(file => form.append("files", file));

            const response = await fetch(`${API_URL}/api/analyze-material`, {
                method: "POST",
                body: form
            });
            const data = await readResponse(response);

            if (!data.generation_id || !data.conceptGraph) {
                throw new Error("Material analysis response is incomplete.");
            }

            sessionStorage.setItem("generationId", data.generation_id);
            sessionStorage.setItem("conceptGraph", JSON.stringify(data.conceptGraph));
            sessionStorage.setItem("generationSettings", JSON.stringify(values));
            sessionStorage.setItem("examTitle", title.trim());
            sessionStorage.setItem("examSubject", subject.trim());
            sessionStorage.setItem("sourceFiles", JSON.stringify(data.sourceFiles || []));

            navigate("/select-concepts");
        } catch (err) {
            setError(err.message || "Material analysis failed.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <div className="topbar">
                    <div className="topbar-title">Create Exam</div>

                    <div className="user-area">
                        <strong>Teacher</strong>
                        <div className="avatar">T</div>
                    </div>
                </div>

                <div className="content">
                    <WorkflowStepper currentStep={1} />

                    <div className="workflow-page generate-page">
                        <header className="workflow-header">
                            <div>
                                <p className="eyebrow">Step 1 of 4</p>
                                <h1>Configure &amp; Upload Material</h1>
                                <p className="workflow-step">
                                    Provide exam metadata, upload course PDFs, and set your question blueprint.
                                </p>
                            </div>
                        </header>

                        <div className="workflow-card">
                            <form onSubmit={analyse}>
                                <section>
                                    <div className="section-title-row">
                                        <span className="section-number">01</span>
                                        <h2>Exam details</h2>
                                    </div>
                                    <div className="form-grid">
                                        <label>
                                            Exam title
                                            <input
                                                placeholder="e.g. Unit 3 Middleware Assessment"
                                                value={title}
                                                onChange={e => setTitle(e.target.value)}
                                                required
                                            />
                                        </label>
                                        <label>
                                            Subject
                                            <input
                                                placeholder="e.g. Distributed Computing"
                                                value={subject}
                                                onChange={e => setSubject(e.target.value)}
                                            />
                                        </label>
                                    </div>
                                </section>

                                <section>
                                    <div className="section-title-row">
                                        <span className="section-number">02</span>
                                        <h2>Study material</h2>
                                    </div>

                                    <label
                                        className={`upload-dropzone${dragging ? " dragging" : ""}`}
                                        onDragOver={e => {
                                            e.preventDefault();
                                            setDragging(true);
                                        }}
                                        onDragLeave={() => setDragging(false)}
                                        onDrop={handleDrop}
                                    >
                                        <span className="upload-dropzone-icon" aria-hidden="true">
                                            <svg
                                                width="22"
                                                height="22"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.75"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="17 8 12 3 7 8" />
                                                <line x1="12" y1="3" x2="12" y2="15" />
                                            </svg>
                                        </span>
                                        <strong>Drop PDF files here or click to browse</strong>
                                        <span>PDF only · Maximum 5 files · 25 MB each · 100 MB combined</span>
                                        <input
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            multiple
                                            onChange={selectFiles}
                                        />
                                    </label>

                                    {files.map((file, index) => (
                                        <div className="selected-file" key={`${file.name}-${index}`}>
                                            <div className="selected-file-meta">
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="#3B49DF"
                                                    strokeWidth="1.75"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    aria-hidden="true"
                                                >
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                </svg>
                                                <span>
                                                    {file.name} · {(file.size / 1048576).toFixed(2)} MB
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="secondary-button"
                                                onClick={() =>
                                                    setFiles(current => current.filter((_, i) => i !== index))
                                                }
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </section>

                                <section>
                                    <div className="section-title-row">
                                        <span className="section-number">03</span>
                                        <h2>Question types</h2>
                                    </div>
                                    <div className="count-grid">
                                        {typeFields.map(([key, label]) => (
                                            <label key={key}>
                                                {label}
                                                <select
                                                    value={values[key]}
                                                    onChange={e => update(key, Number(e.target.value))}
                                                >
                                                    {Array.from({ length: 51 }, (_, n) => (
                                                        <option value={n} key={n}>
                                                            {n}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="total-line">
                                        <span>Total questions (1 mark each)</span>
                                        <strong>{totalQuestions}</strong>
                                    </div>
                                </section>

                                <section>
                                    <div className="section-title-row">
                                        <span className="section-number">04</span>
                                        <h2>Difficulty</h2>
                                    </div>
                                    <div className="form-grid">
                                        <label>
                                            Target difficulty level
                                            <select
                                                value={values.difficulty}
                                                onChange={e => update("difficulty", e.target.value)}
                                            >
                                                <option>Low</option>
                                                <option>Medium</option>
                                                <option>High</option>
                                            </select>
                                        </label>
                                    </div>
                                </section>

                                <section>
                                    <div className="section-title-row">
                                        <span className="section-number">05</span>
                                        <h2>Bloom&apos;s Taxonomy distribution</h2>
                                    </div>
                                    <div className="count-grid bloom-grid">
                                        {bloomFields.map(([key, label]) => (
                                            <label key={key}>
                                                {label}
                                                <select
                                                    value={values[key]}
                                                    onChange={e => update(key, Number(e.target.value))}
                                                >
                                                    {Array.from({ length: 51 }, (_, n) => (
                                                        <option value={n} key={n}>
                                                            {n}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        ))}
                                    </div>
                                    <div className={totalBloom === totalQuestions ? "match-badge" : "field-error"}>
                                        Bloom total: {totalBloom} / {totalQuestions}
                                    </div>
                                </section>

                                {error && (
                                    <div className="error-box" role="alert">
                                        {error}
                                    </div>
                                )}

                                <div className="workflow-actions">
                                    <span />
                                    <button className="primary-button" type="submit" disabled={loading}>
                                        {loading
                                            ? "Analysing uploaded material..."
                                            : "Analyse material and continue"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
