import { useMemo, useState } from "react";

const BACKEND_URL = "http://localhost:5000";

const questionTypeFields = [
    {
        key: "mcq",
        label: "Multiple Choice Questions (MCQ)"
    },
    {
        key: "trueFalse",
        label: "True / False"
    },
    {
        key: "fillBlank",
        label: "Fill in the Blanks"
    },
    {
        key: "shortAnswer",
        label: "Short Factual Answer"
    }
];

const bloomFields = [
    {
        key: "remember",
        label: "Remember"
    },
    {
        key: "understand",
        label: "Understand"
    },
    {
        key: "apply",
        label: "Apply"
    },
    {
        key: "analyze",
        label: "Analyze"
    },
    {
        key: "evaluate",
        label: "Evaluate"
    },
    {
        key: "create",
        label: "Create"
    }
];

function GenerateQuestions() {

    const [file, setFile] = useState(null);

    const [difficulty, setDifficulty] =
        useState("Medium");

    const [counts, setCounts] = useState({

        mcq: 0,

        trueFalse: 0,

        fillBlank: 0,

        shortAnswer: 0
    });

    const [bloomCounts, setBloomCounts] = useState({

        remember: 0,

        understand: 0,

        apply: 0,

        analyze: 0,

        evaluate: 0,

        create: 0
    });

    const [questions, setQuestions] =
        useState([]);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState("");

    // ======================================
    // Total question count
    // ======================================

    const totalQuestions = useMemo(() => {

        return (
            counts.mcq +
            counts.trueFalse +
            counts.fillBlank +
            counts.shortAnswer
        );

    }, [counts]);

    // ======================================
    // Total Bloom count
    // ======================================

    const bloomTotal = useMemo(() => {

        return (
            bloomCounts.remember +
            bloomCounts.understand +
            bloomCounts.apply +
            bloomCounts.analyze +
            bloomCounts.evaluate +
            bloomCounts.create
        );

    }, [bloomCounts]);

    const bloomMatches =
        bloomTotal === totalQuestions;

    // ======================================
    // Dropdown values 0 - 20
    // ======================================

    const countOptions =
        Array.from(
            { length: 21 },
            (_, index) => index
        );

    // ======================================
    // Question type dropdown
    // ======================================

    const handleCountChange = (
        key,
        value
    ) => {

        setCounts({
            ...counts,
            [key]: Number(value)
        });
    };

    // ======================================
    // Bloom dropdown
    // ======================================

    const handleBloomChange = (
        key,
        value
    ) => {

        setBloomCounts({
            ...bloomCounts,
            [key]: Number(value)
        });
    };

    // ======================================
    // Generate Questions
    // ======================================

    const handleGenerate = async (event) => {

        event.preventDefault();

        setError("");
        setSuccess("");
        setQuestions([]);

        if (!file) {

            setError(
                "Please select a PDF file."
            );

            return;
        }

        if (totalQuestions === 0) {

            setError(
                "Please select at least one question."
            );

            return;
        }

        if (!bloomMatches) {

            setError(
                `Bloom total (${bloomTotal}) must equal total questions (${totalQuestions}).`
            );

            return;
        }

        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );

        formData.append(
            "mcq_count",
            counts.mcq
        );

        formData.append(
            "true_false_count",
            counts.trueFalse
        );

        formData.append(
            "fill_blank_count",
            counts.fillBlank
        );

        formData.append(
            "short_answer_count",
            counts.shortAnswer
        );

        formData.append(
            "difficulty",
            difficulty
        );

        formData.append(
            "remember_count",
            bloomCounts.remember
        );

        formData.append(
            "understand_count",
            bloomCounts.understand
        );

        formData.append(
            "apply_count",
            bloomCounts.apply
        );

        formData.append(
            "analyze_count",
            bloomCounts.analyze
        );

        formData.append(
            "evaluate_count",
            bloomCounts.evaluate
        );

        formData.append(
            "create_count",
            bloomCounts.create
        );

        try {

            setLoading(true);

            const response =
                await fetch(
                    `${BACKEND_URL}/api/generate-questions`,
                    {
                        method: "POST",
                        body: formData
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.error ||
                    data.detail ||
                    data.message ||
                    "Question generation failed."
                );
            }

            if (!data.success) {

                setError(
                    data.message ||
                    "Question generation failed."
                );

                if (data.questions) {

                    setQuestions(
                        data.questions
                    );
                }

                return;
            }

            setQuestions(
                data.questions || []
            );

            setSuccess(
                `Successfully generated ${data.questions.length} questions.`
            );

        } catch (err) {

            console.error(err);

            setError(
                err.message ||
                "Could not connect to backend."
            );

        } finally {

            setLoading(false);
        }
    };

    return (

        <div
            style={{
                padding: "30px",
                maxWidth: "1100px",
                margin: "0 auto"
            }}
        >

            <h1>
                Generate Questions
            </h1>

            <p>
                Upload study material and configure
                the exact question distribution.
            </p>

            <form
                onSubmit={handleGenerate}
            >

                {/* ================================= */}
                {/* PDF */}
                {/* ================================= */}

                <div
                    style={{
                        marginBottom: "25px"
                    }}
                >

                    <label>
                        <strong>
                            Study Material PDF
                        </strong>
                    </label>

                    <br />

                    <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(event) =>
                            setFile(
                                event.target.files[0]
                            )
                        }
                    />

                    {file && (
                        <p>
                            Selected:
                            {" "}
                            {file.name}
                        </p>
                    )}

                </div>


                {/* ================================= */}
                {/* QUESTION TYPES */}
                {/* ================================= */}

                <h2>
                    Question Distribution
                </h2>

                {questionTypeFields.map(
                    (field) => (

                        <div
                            key={field.key}
                            style={{
                                marginBottom: "12px"
                            }}
                        >

                            <label>
                                {field.label}
                            </label>

                            <select
                                value={
                                    counts[field.key]
                                }
                                onChange={(event) =>
                                    handleCountChange(
                                        field.key,
                                        event.target.value
                                    )
                                }
                                style={{
                                    marginLeft: "15px",
                                    padding: "7px",
                                    minWidth: "100px"
                                }}
                            >

                                {countOptions.map(
                                    (number) => (

                                        <option
                                            key={number}
                                            value={number}
                                        >
                                            {number}
                                        </option>
                                    )
                                )}

                            </select>

                        </div>
                    )
                )}


                {/* ================================= */}
                {/* TOTAL */}
                {/* ================================= */}

                <div
                    style={{
                        marginTop: "20px",
                        marginBottom: "25px",
                        padding: "15px",
                        border: "1px solid #ddd",
                        borderRadius: "8px"
                    }}
                >

                    <strong>
                        Total Questions:
                    </strong>

                    {" "}

                    {totalQuestions}

                </div>


                {/* ================================= */}
                {/* DIFFICULTY */}
                {/* ================================= */}

                <h2>
                    Difficulty
                </h2>

                <select
                    value={difficulty}
                    onChange={(event) =>
                        setDifficulty(
                            event.target.value
                        )
                    }
                    style={{
                        padding: "8px",
                        minWidth: "150px",
                        marginBottom: "25px"
                    }}
                >

                    <option value="Low">
                        Low
                    </option>

                    <option value="Medium">
                        Medium
                    </option>

                    <option value="High">
                        High
                    </option>

                </select>


                {/* ================================= */}
                {/* BLOOM */}
                {/* ================================= */}

                <h2>
                    Bloom's Taxonomy Distribution
                </h2>

                <p>
                    The Bloom total must exactly equal
                    the total number of questions.
                </p>

                {bloomFields.map(
                    (field) => (

                        <div
                            key={field.key}
                            style={{
                                marginBottom: "12px"
                            }}
                        >

                            <label>
                                {field.label}
                            </label>

                            <select
                                value={
                                    bloomCounts[field.key]
                                }
                                onChange={(event) =>
                                    handleBloomChange(
                                        field.key,
                                        event.target.value
                                    )
                                }
                                style={{
                                    marginLeft: "15px",
                                    padding: "7px",
                                    minWidth: "100px"
                                }}
                            >

                                {countOptions.map(
                                    (number) => (

                                        <option
                                            key={number}
                                            value={number}
                                        >
                                            {number}
                                        </option>
                                    )
                                )}

                            </select>

                        </div>
                    )
                )}


                {/* ================================= */}
                {/* BLOOM TOTAL STATUS */}
                {/* ================================= */}

                <div
                    style={{
                        marginTop: "20px",
                        marginBottom: "25px",
                        padding: "15px",
                        border: "1px solid #ddd",
                        borderRadius: "8px"
                    }}
                >

                    <strong>
                        Bloom Total:
                    </strong>

                    {" "}

                    {bloomTotal}

                    {" / "}

                    {totalQuestions}

                    <br />

                    {bloomMatches ? (

                        <span>
                            ✓ Bloom distribution matches.
                        </span>

                    ) : (

                        <span>
                            ⚠ Bloom total must equal
                            total questions.
                        </span>
                    )}

                </div>


                {/* ================================= */}
                {/* ERROR */}
                {/* ================================= */}

                {error && (

                    <div
                        style={{
                            padding: "12px",
                            marginBottom: "15px"
                        }}
                    >
                        {error}
                    </div>
                )}


                {/* ================================= */}
                {/* SUCCESS */}
                {/* ================================= */}

                {success && (

                    <div
                        style={{
                            padding: "12px",
                            marginBottom: "15px"
                        }}
                    >
                        {success}
                    </div>
                )}


                {/* ================================= */}
                {/* GENERATE BUTTON */}
                {/* ================================= */}

                <button
                    type="submit"
                    disabled={
                        loading ||
                        !file ||
                        totalQuestions === 0 ||
                        !bloomMatches
                    }
                    style={{
                        padding: "12px 24px",
                        cursor:
                            loading ||
                            !file ||
                            totalQuestions === 0 ||
                            !bloomMatches
                                ? "not-allowed"
                                : "pointer"
                    }}
                >

                    {loading
                        ? "Generating..."
                        : "Generate Questions"}

                </button>

            </form>


            {/* ================================= */}
            {/* GENERATED QUESTIONS */}
            {/* ================================= */}

            {questions.length > 0 && (

                <div
                    style={{
                        marginTop: "40px"
                    }}
                >

                    <h2>
                        Generated Questions
                    </h2>

                    {questions.map(
                        (question, index) => (

                            <div
                                key={index}
                                style={{
                                    padding: "20px",
                                    marginBottom: "15px",
                                    border:
                                        "1px solid #ddd",
                                    borderRadius: "8px"
                                }}
                            >

                                <h3>
                                    Question{" "}
                                    {index + 1}
                                </h3>

                                <p>
                                    <strong>
                                        {question.question}
                                    </strong>
                                </p>

                                <p>
                                    Type:
                                    {" "}
                                    {question.type}
                                </p>

                                <p>
                                    Bloom:
                                    {" "}
                                    {question.bloomLevel}
                                </p>

                                <p>
                                    Difficulty:
                                    {" "}
                                    {question.difficulty}
                                </p>

                                <p>
                                    Marks:
                                    {" "}
                                    {question.marks}
                                </p>

                                {question.type ===
                                    "MCQ" && (

                                    <ol type="A">

                                        {question.options.map(
                                            (option, optionIndex) => (

                                                <li
                                                    key={
                                                        optionIndex
                                                    }
                                                >
                                                    {option}
                                                </li>
                                            )
                                        )}

                                    </ol>
                                )}

                                <p>
                                    <strong>
                                        Correct Answer:
                                    </strong>
                                    {" "}
                                    {question.correctAnswer}
                                </p>

                                <p>
                                    <strong>
                                        Concept:
                                    </strong>
                                    {" "}
                                    {question.concept}
                                </p>

                            </div>
                        )
                    )}

                </div>
            )}

        </div>
    );
}

export default GenerateQuestions;