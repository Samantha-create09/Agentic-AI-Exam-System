
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
            <p className="dashboard-eyebrow">
              ASSESSMENT ANALYTICS
            </p>

            <h1>Examination results</h1>

            <p>
              Review student submissions, scores, and performance
              after response retrieval and grading are connected.
            </p>
          </section>

          <section className="dashboard-stats">
            <article className="dashboard-stat">
              <span className="dashboard-stat-icon">↥</span>
              <div>
                <p>Total responses</p>
                <h2>—</h2>
                <small>Awaiting integration</small>
              </div>
            </article>

            <article className="dashboard-stat">
              <span className="dashboard-stat-icon">%</span>
              <div>
                <p>Average score</p>
                <h2>—</h2>
                <small>Calculated from real results</small>
              </div>
            </article>

            <article className="dashboard-stat">
              <span className="dashboard-stat-icon">★</span>
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
                <p>
                  Open a published form to view its responses
                  in Google Forms.
                </p>
              </div>
            </div>

            {publishedExams.length === 0 ? (
              <div className="dashboard-empty">
                <div className="dashboard-empty-icon">▤</div>
                <h3>No published exams available</h3>
                <p>
                  Publish an exam first. Its response link will
                  be available here when saved.
                </p>
                <Link
                  to="/generate-questions"
                  className="dashboard-primary-button"
                >
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
                      <div className="published-exam-icon">▤</div>

                      <div className="published-exam-title">
                        <h3>
                          {exam.title ||
                            exam.formTitle ||
                            `Published exam ${index + 1}`}
                        </h3>
                        <p>
                          Google Forms response management
                        </p>
                      </div>
                    </div>

                    <div className="published-exam-links">
                      <div>
                        <span>Student form</span>
                        <p>Open the exam students received.</p>
                        {exam.formUrl && (
                          <a
                            href={exam.formUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open student form ↗
                          </a>
                        )}
                      </div>

                      <div>
                        <span>Responses and scores</span>
                        <p>
                          Open the form editor and select its
                          Responses tab to view current submissions.
                        </p>
                        {exam.editUrl && (
                          <a
                            href={exam.editUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open responses in Google Forms ↗
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
                The page does not yet fetch individual submissions
                or calculate grades. The next backend step is to
                retrieve Google Form responses, match each response
                to the answer key, and save the scored results.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Results;
