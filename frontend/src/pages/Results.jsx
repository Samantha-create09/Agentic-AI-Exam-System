import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";

const readSession = (key, fallback) => {
  try {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

function Results() {
  const [publishedExams, setPublishedExams] = useState([]);

  useEffect(() => {
    const saved = readSession("publishedExams", []);
    const latest = readSession("publishedForm", null);

    let exams = Array.isArray(saved) ? [...saved] : [];

    if (
      latest?.formUrl &&
      !exams.some((exam) => exam.formUrl === latest.formUrl)
    ) {
      exams.unshift(latest);
    }

    setPublishedExams(exams);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <div className="topbar">
          <div className="topbar-title">Results</div>

          <div className="user-area">
            <strong>Teacher</strong>
            <div className="avatar">T</div>
          </div>
        </div>

        <div className="content dashboard-home">
          <section className="page-heading">
            <p className="dashboard-eyebrow">Assessment Analytics</p>
            <h1>Examination results</h1>
            <p>
              Review student submissions, scores, and performance after response retrieval
              and grading are connected.
            </p>
          </section>

          <section className="dashboard-stats">
            <article className="dashboard-stat">
              <span className="dashboard-stat-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <div>
                <p>Total responses</p>
                <h2>—</h2>
                <small>Awaiting integration</small>
              </div>
            </article>

            <article className="dashboard-stat">
              <span className="dashboard-stat-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="19" y1="5" x2="5" y2="19" />
                  <circle cx="6.5" cy="6.5" r="2.5" />
                  <circle cx="17.5" cy="17.5" r="2.5" />
                </svg>
              </span>
              <div>
                <p>Average score</p>
                <h2>—</h2>
                <small>Calculated from real results</small>
              </div>
            </article>

            <article className="dashboard-stat">
              <span className="dashboard-stat-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </span>
              <div>
                <p>Highest score</p>
                <h2>—</h2>
                <small>Calculated from real results</small>
              </div>
            </article>
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div>
                <h2>Choose an exam</h2>
                <p>Open a published form to view its responses in Google Forms.</p>
              </div>
            </div>

            {publishedExams.length === 0 ? (
              <div className="dashboard-empty">
                <div className="dashboard-empty-icon" aria-hidden="true">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <h3>No published exams available</h3>
                <p>
                  Publish an exam first. Its response link will be available here when saved.
                </p>
                <Link to="/generate-questions" className="dashboard-primary-button">
                  Create an exam
                </Link>
              </div>
            ) : (
              <div className="published-exam-list">
                {publishedExams.map((exam, index) => (
                  <article
                    className="published-exam-card"
                    key={exam.formUrl || exam.editUrl || index}
                  >
                    <div className="published-exam-heading">
                      <div className="published-exam-icon" aria-hidden="true">
                        <svg
                          width="19"
                          height="19"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>

                      <div className="published-exam-title">
                        <h3>
                          {exam.title ||
                            exam.formTitle ||
                            `Published exam ${index + 1}`}
                        </h3>
                        <p>Google Forms response management</p>
                      </div>
                    </div>

                    <div className="published-exam-links">
                      <div>
                        <span>Student form</span>
                        <p>Open the exam students received.</p>
                        {exam.formUrl && (
                          <a href={exam.formUrl} target="_blank" rel="noreferrer">
                            Open student form
                          </a>
                        )}
                      </div>

                      <div>
                        <span>Responses and scores</span>
                        <p>
                          Open the form editor and select its Responses tab to view current submissions.
                        </p>
                        {exam.editUrl && (
                          <a href={exam.editUrl} target="_blank" rel="noreferrer">
                            Open responses in Google Forms
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-section">
            <div className="results-next-step">
              <h2>Automated results are the next integration</h2>
              <p>
                The page does not yet fetch individual submissions or calculate grades.
                The next backend step is to retrieve Google Form responses, match each
                response to the answer key, and save the scored results.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Results;
