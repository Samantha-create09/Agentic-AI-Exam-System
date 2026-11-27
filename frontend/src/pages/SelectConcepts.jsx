import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import WorkflowStepper from "../components/WorkflowStepper";

const API_URL = "http://localhost:5000";

async function api(url, body) {
    const response = await fetch(`${API_URL}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || data.detail || "Request failed.");
    }
    return data;
}

function groupSources(sources) {
    const byFile = new Map();
    for (const source of sources || []) {
        const file = source?.file || "Uploaded material";
        if (!byFile.has(file)) {
            byFile.set(file, new Set());
        }
        for (const page of source?.pages || []) {
            byFile.get(file).add(Number(page));
        }
    }

    return Array.from(byFile.entries()).map(([file, pageSet]) => ({
        file,
        pages: Array.from(pageSet).filter(n => !Number.isNaN(n)).sort((a, b) => a - b)
    }));
}

function formatSourceLabel(source) {
    if (!source.pages.length) return source.file;
    const prefix = source.pages.length === 1 ? "p." : "pp.";
    return `${source.file} (${prefix} ${source.pages.join(", ")})`;
}

export default function SelectConcepts() {
    const navigate = useNavigate();
    const generationId = sessionStorage.getItem("generationId");

    const graph = useMemo(() => {
        try {
            return JSON.parse(sessionStorage.getItem("conceptGraph") || "{}");
        } catch {
            return {};
        }
    }, []);

    const [concepts, setConcepts] = useState(graph.concepts || []);
    const [selectedConcepts, setSelectedConcepts] = useState([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState([]);
    const [collapsedConcepts, setCollapsedConcepts] = useState({});
    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [adding, setAdding] = useState(false);
    const [matches, setMatches] = useState([]);
    const [assessment, setAssessment] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const allParentsSelected =
        concepts.length > 0 && selectedConcepts.length === concepts.length;
    const hasAnySelection =
        selectedConcepts.length > 0 || selectedSubtopics.length > 0;

    function toggleConcept(id) {
        setSelectedConcepts(current =>
            current.includes(id)
                ? current.filter(item => item !== id)
                : [...current, id]
        );
    }

    function toggleSubtopic(id) {
        setSelectedSubtopics(current =>
            current.includes(id)
                ? current.filter(item => item !== id)
                : [...current, id]
        );
    }

    function toggleExpand(id) {
        setCollapsedConcepts(current => ({
            ...current,
            [id]: !current[id]
        }));
    }

    function handleSelectAllOrClear() {
        setError("");
        if (allParentsSelected) {
            setSelectedConcepts([]);
            setSelectedSubtopics([]);
        } else {
            setSelectedConcepts(concepts.map(c => c.id));
        }
    }

    function clearSelection() {
        setError("");
        setSelectedConcepts([]);
        setSelectedSubtopics([]);
    }

    async function searchConcept(event) {
        event.preventDefault();
        setError("");
        setNotice("");
        setMatches([]);
        setAssessment(null);

        if (query.trim().length < 2) {
            setError("Enter a concept name with at least two characters.");
            return;
        }

        setSearching(true);
        try {
            const data = await api("/api/search-concept", {
                generation_id: generationId,
                query: query.trim()
            });
            setMatches(data.matches || []);
            setAssessment(data.assessment || null);

            if (!data.matches?.length) {
                setNotice("No matching passages were found. Upload more relevant study material.");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSearching(false);
        }
    }

    async function addConcept() {
        setError("");
        setAdding(true);
        try {
            const data = await api("/api/add-concept", {
                generation_id: generationId,
                query: query.trim(),
                matches,
                assessment
            });
            setConcepts(current => {
                if (current.some(c => c.id === data.concept.id)) return current;
                return [...current, data.concept];
            });
            setNotice("Concept added. You can now select it.");
            setQuery("");
            setMatches([]);
            setAssessment(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setAdding(false);
        }
    }

    function continueToGeneration() {
        setError("");
        if (!selectedConcepts.length && !selectedSubtopics.length) {
            setError("Select at least one concept or subtopic.");
            return;
        }

        sessionStorage.setItem("selectedConceptIds", JSON.stringify(selectedConcepts));
        sessionStorage.setItem("selectedSubtopicIds", JSON.stringify(selectedSubtopics));
        sessionStorage.setItem("conceptGraph", JSON.stringify({
            ...graph,
            concepts
        }));
        navigate("/review-questions?stage=generate");
    }

    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <div className="topbar">
                    <div className="topbar-title">Select Concepts</div>

                    <div className="user-area">
                        <strong>Teacher</strong>
                        <div className="avatar">T</div>
                    </div>
                </div>

                <div className="content">
                    <WorkflowStepper currentStep={2} />

                    {!generationId ? (
                        <div className="workflow-page">
                            <div className="workflow-card">
                                <h2>Analysis session not found</h2>
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
                        <div className="workflow-page select-concepts-page">
                            <header className="workflow-header">
                                <div>
                                    <p className="eyebrow">Step 2 of 4</p>
                                    <h1>Select Concepts</h1>
                                    <p className="workflow-step">
                                        Choose the verified syllabus topics and subtopics from which questions will be generated.
                                    </p>
                                </div>
                            </header>

                            <div className="workflow-card">
                                <section>
                                    <div className="section-heading concept-toolbar">
                                        <div>
                                            <h2>Detected concepts and subtopics</h2>
                                            <p>Select a whole concept, or pick individual subtopics.</p>
                                        </div>

                                        {concepts.length > 0 && (
                                            <div className="concept-toolbar-actions">
                                                <button
                                                    type="button"
                                                    className="secondary-button"
                                                    onClick={handleSelectAllOrClear}
                                                >
                                                    {allParentsSelected ? "Clear Selection" : "Select All"}
                                                </button>
                                                {hasAnySelection && !allParentsSelected && (
                                                    <button
                                                        type="button"
                                                        className="secondary-button"
                                                        onClick={clearSelection}
                                                    >
                                                        Clear Selection
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {concepts.length === 0 && <p>No concepts were extracted.</p>}

                                    <div className="concept-list">
                                        {concepts.map(concept => {
                                            const subtopics = concept.subtopics || [];
                                            const isExpanded = !collapsedConcepts[concept.id];
                                            const groupedSources = groupSources(concept.sources);

                                            return (
                                                <article className="concept-card" key={concept.id}>
                                                    <div className="concept-card-header">
                                                        <label className="concept-parent">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedConcepts.includes(concept.id)}
                                                                onChange={() => toggleConcept(concept.id)}
                                                            />
                                                            <strong>{concept.name}</strong>
                                                        </label>

                                                        {subtopics.length > 0 && (
                                                            <button
                                                                type="button"
                                                                className="concept-toggle-btn"
                                                                onClick={() => toggleExpand(concept.id)}
                                                                aria-expanded={isExpanded}
                                                            >
                                                                <svg
                                                                    width="15"
                                                                    height="15"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.75"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    aria-hidden="true"
                                                                >
                                                                    {isExpanded ? (
                                                                        <polyline points="6 9 12 15 18 9" />
                                                                    ) : (
                                                                        <polyline points="9 18 15 12 9 6" />
                                                                    )}
                                                                </svg>
                                                                {isExpanded
                                                                    ? `Hide subtopics (${subtopics.length})`
                                                                    : `Show subtopics (${subtopics.length})`}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {groupedSources.length > 0 && (
                                                        <div className="concept-sources">
                                                            {groupedSources.map(source => (
                                                                <span className="source-badge" key={source.file}>
                                                                    Sources: {formatSourceLabel(source)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {concept.description && (
                                                        <p className="concept-description">{concept.description}</p>
                                                    )}

                                                    {subtopics.length > 0 && isExpanded && (
                                                        <div className="concept-subtopics">
                                                            {subtopics.map(sub => (
                                                                <label className="concept-subtopic" key={sub.id}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedSubtopics.includes(sub.id)}
                                                                        onChange={() => toggleSubtopic(sub.id)}
                                                                    />
                                                                    <div className="concept-subtopic-body">
                                                                        <strong>{sub.name}</strong>
                                                                        {sub.description && (
                                                                            <small>{sub.description}</small>
                                                                        )}
                                                                    </div>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section>
                                    <h2>Add a missing concept</h2>
                                    <p className="workflow-step" style={{ marginBottom: "16px" }}>
                                        Search the already extracted PDF pages. The AI will check
                                        whether those passages adequately explain the concept.
                                    </p>
                                    <form onSubmit={searchConcept}>
                                        <div className="form-grid">
                                            <input
                                                value={query}
                                                onChange={e => setQuery(e.target.value)}
                                                placeholder="e.g. Middleware architecture"
                                            />
                                            <button className="secondary-button" disabled={searching}>
                                                {searching ? "Checking material..." : "Search uploaded material"}
                                            </button>
                                        </div>
                                    </form>

                                    {assessment && (
                                        <div className="concept-evidence">
                                            <h3>Evidence assessment: {assessment.status}</h3>
                                            <p>{assessment.explanation}</p>

                                            {assessment.covered_aspects?.length > 0 && (
                                                <>
                                                    <strong>Covered aspects</strong>
                                                    <ul>
                                                        {assessment.covered_aspects.map(x => (
                                                            <li key={x}>{x}</li>
                                                        ))}
                                                    </ul>
                                                </>
                                            )}
                                            {assessment.missing_aspects?.length > 0 && (
                                                <>
                                                    <strong>Missing aspects</strong>
                                                    <ul>
                                                        {assessment.missing_aspects.map(x => (
                                                            <li key={x}>{x}</li>
                                                        ))}
                                                    </ul>
                                                </>
                                            )}

                                            {matches.map((match, index) => (
                                                <div className="source-excerpt" key={`${match.file}-${index}`}>
                                                    <strong>{match.file} · Page {match.pages.join(", ")}</strong>
                                                    <p>{match.excerpt}</p>
                                                </div>
                                            ))}

                                            {assessment.status === "adequate" && (
                                                <button
                                                    type="button"
                                                    className="secondary-button"
                                                    onClick={addConcept}
                                                    disabled={adding}
                                                >
                                                    {adding ? "Adding..." : "Add evidence-supported concept"}
                                                </button>
                                            )}

                                            {assessment.status === "partial" && (
                                                <p className="field-error">
                                                    The material only partly explains this concept.
                                                    Upload additional material before using it.
                                                </p>
                                            )}

                                            {assessment.status === "unsupported" && (
                                                <p className="field-error">
                                                    This concept is not supported by the uploaded material.
                                                    It cannot be used for question generation.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </section>

                                {notice && <div className="notice-box">{notice}</div>}
                                {error && <div className="error-box" role="alert">{error}</div>}

                                <div className="total-line">
                                    <span>
                                        Selected concepts: <strong>{selectedConcepts.length}</strong>
                                        {" · "}Selected subtopics: <strong>{selectedSubtopics.length}</strong>
                                    </span>
                                </div>

                                <div className="workflow-actions">
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => navigate("/generate-questions")}
                                    >
                                        Back to Step 1
                                    </button>
                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={continueToGeneration}
                                    >
                                        Continue to question generation
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
