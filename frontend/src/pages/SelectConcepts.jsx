
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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

    const settings = useMemo(() => {
        try {
            return JSON.parse(sessionStorage.getItem("generationSettings") || "{}");
        } catch {
            return {};
        }
    }, []);

    const [concepts, setConcepts] = useState(graph.concepts || []);
    const [selectedConcepts, setSelectedConcepts] = useState([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState([]);
    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [adding, setAdding] = useState(false);
    const [matches, setMatches] = useState([]);
    const [assessment, setAssessment] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    if (!generationId) {
        return (
            <main className="workflow-page">
                <div className="workflow-card">
                    <h2>Analysis session not found</h2>
                    <p>Please upload and analyse your study material first.</p>
                    <button className="primary-button"
                        onClick={() => navigate("/generate-questions")}>
                        Back to Step 1
                    </button>
                </div>
            </main>
        );
    }

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
        if (!selectedConcepts.length) {
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
        <div className="workflow-page">
            <header className="workflow-header">
                <div>
                    <p className="eyebrow">Agentic AI Exam System</p>
                    <h1>Select concepts</h1>
                    <p>Step 2 of 4 — Choose the topics from which questions may be generated.</p>
                </div>
            </header>

            <main className="workflow-card">
                <section>
                    <h2>Detected concepts and subtopics</h2>
                    <p>Select a whole concept, or select individual subtopics.</p>

                    {concepts.length === 0 && <p>No concepts were extracted.</p>}

                    {concepts.map(concept => (
                        <article className="concept-card" key={concept.id}>
                            <label className="concept-parent">
                                <input
                                    type="checkbox"
                                    checked={selectedConcepts.includes(concept.id)}
                                    onChange={() => toggleConcept(concept.id)}
                                />
                                <strong>{concept.name}</strong>
                            </label>
                            {concept.description && <p>{concept.description}</p>}
                            <small>
                                Sources: {(concept.sources || []).map(s =>
                                    `${s.file} (page ${s.pages.join(", ")})`
                                ).join("; ")}
                            </small>

                            {(concept.subtopics || []).map(sub => (
                                <label className="concept-subtopic" key={sub.id}>
                                    <input
                                        type="checkbox"
                                        checked={selectedSubtopics.includes(sub.id)}
                                        onChange={() => toggleSubtopic(sub.id)}
                                    />
                                    <span>
                                        <strong>{sub.name}</strong>
                                        {sub.description && <small>{sub.description}</small>}
                                    </span>
                                </label>
                            ))}
                        </article>
                    ))}
                </section>

                <section>
                    <h2>Add a missing concept</h2>
                    <p>
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
                                    <ul>{assessment.covered_aspects.map(x => <li key={x}>{x}</li>)}</ul>
                                </>
                            )}
                            {assessment.missing_aspects?.length > 0 && (
                                <>
                                    <strong>Missing aspects</strong>
                                    <ul>{assessment.missing_aspects.map(x => <li key={x}>{x}</li>)}</ul>
                                </>
                            )}

                            {matches.map((match, index) => (
                                <div className="source-excerpt" key={`${match.file}-${index}`}>
                                    <strong>{match.file} · Page {match.pages.join(", ")}</strong>
                                    <p>{match.excerpt}</p>
                                </div>
                            ))}

                            {assessment.status === "adequate" && (
                                <button type="button" className="secondary-button"
                                    onClick={addConcept} disabled={adding}>
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
                    Selected concepts: <strong>{selectedConcepts.length}</strong>
                    {" · "}Selected subtopics: <strong>{selectedSubtopics.length}</strong>
                </div>

                <button className="primary-button" onClick={continueToGeneration}>
                    Continue to question generation
                </button>
            </main>
        </div>
    );
}