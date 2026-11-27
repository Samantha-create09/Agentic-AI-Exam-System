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

function Dashboard() {
  const [publishedExams, setPublishedExams] = useState([]);
  const [questionsCount, setQuestionsCount] = useState(0);

  useEffect(() => {
    const savedExams = readSession("publishedExams", []);
    const latestForm = readSession("publishedForm", null);
    const savedQuestions = readSession("generatedQuestions", []);

    let exams = Array.isArray(savedExams) ? savedExams : [];

    if (
      latestForm &&
      !exams.some(
        (exam) => exam.formUrl && exam.formUrl === latestForm.formUrl
      )
    ) {
      exams = [latestForm, ...exams];
    }

    setPublishedExams(exams);
    setQuestionsCount(
      Array.isArray(savedQuestions) ? savedQuestions.length : 0
    );
  }, []);

  const totalExams = publishedExams.length;

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <div className="topbar">
          <div className="topbar-title">Dashboard</div>

          <div className="user-area">
            <strong>Teacher</strong>
            <div className="avatar">T</div>
          </div>
        </div>

        <div className="content dashboard-home">
          <section className="page-heading">
            <p className="dashboard-eyebrow">Agentic AI Exam System</p>
            <h1>Welcome back, Teacher</h1>
            <p>
              Generate balanced question papers from study material, review them,
              publish Google Forms quizzes, and monitor assessment results.
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <div>
                <p>Published exams</p>
                <h2>{totalExams}</h2>
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
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <div>
                <p>Questions in current paper</p>
                <h2>{questionsCount}</h2>
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
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </span>
              <div>
                <p>Student responses</p>
                <h2>—</h2>
                <small>View in Google Forms</small>
              </div>
            </article>
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div>
                <h2>Exam workflow</h2>
                <p>Move through the four steps of creating and deploying an exam.</p>
              </div>
            </div>

            <div className="dashboard-workflow">
              <Link to="/generate-questions" className="dashboard-action">
                <span className="dashboard-action-number">01</span>
                <span className="dashboard-action-icon" aria-hidden="true">
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
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </span>
                <h3>Generate questions</h3>
                <p>
                  Upload study material PDFs and configure your question type and
                  Bloom&apos;s taxonomy counts.
                </p>
                <span className="dashboard-action-link">Start generating</span>
              </Link>

              <Link to="/review-questions" className="dashboard-action">
                <span className="dashboard-action-number">02</span>
                <span className="dashboard-action-icon" aria-hidden="true">
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
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <h3>Review questions</h3>
                <p>
                  Inspect generated items, edit answers, and retry individual
                  questions before publishing.
                </p>
                <span className="dashboard-action-link">Review paper</span>
              </Link>

              <Link to="/published-exams" className="dashboard-action">
                <span className="dashboard-action-number">03</span>
                <span className="dashboard-action-icon" aria-hidden="true">
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
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </span>
                <h3>Published exams</h3>
                <p>
                  Open student quiz links and manage your published Google Forms.
                </p>
                <span className="dashboard-action-link">View published exams</span>
              </Link>

              <Link to="/results" className="dashboard-action">
                <span className="dashboard-action-number">04</span>
                <span className="dashboard-action-icon" aria-hidden="true">
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
                </span>
                <h3>Results</h3>
                <p>
                  Open form response tabs and inspect student scores once submissions arrive.
                </p>
                <span className="dashboard-action-link">View results</span>
              </Link>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div>
                <h2>Recently published</h2>
                <p>Your saved Google Forms quizzes.</p>
              </div>

              <Link to="/published-exams" className="dashboard-text-link">
                View all
              </Link>
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
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <h3>No published exams yet</h3>
                <p>
                  Your Google Forms will appear here after you publish your first exam.
                </p>
                <Link to="/generate-questions" className="dashboard-primary-button">
                  Create an exam
                </Link>
              </div>
            ) : (
              <div className="dashboard-recent-list">
                {publishedExams.slice(0, 3).map((exam, index) => (
                  <div
                    className="dashboard-recent-row"
                    key={exam.formUrl || exam.editUrl || index}
                  >
                    <div className="dashboard-recent-icon" aria-hidden="true">
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

                    <div className="dashboard-recent-details">
                      <strong>
                        {exam.title || exam.name || `Published exam ${index + 1}`}
                      </strong>
                      <span>
                        {exam.publishedAt
                          ? `Published ${new Date(exam.publishedAt).toLocaleDateString()}`
                          : "Google Form"}
                      </span>
                    </div>

                    {exam.formUrl && (
                      <a
                        href={exam.formUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="dashboard-text-link"
                      >
                        Open form
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
