
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

    // Include the latest published form if it is not in the list yet.
    let exams = Array.isArray(savedExams) ? savedExams : [];

    if (
      latestForm &&
      !exams.some(
        (exam) =>
          exam.formUrl &&
          exam.formUrl === latestForm.formUrl
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
            <p className="dashboard-eyebrow">
              AGENTIC AI EXAM SYSTEM
            </p>

            <h1>Welcome back, Teacher</h1>

            <p>
              Generate questions from study material, review them,
              publish exams, and manage student results.
            </p>
          </section>

          <section className="dashboard-stats">
            <article className="dashboard-stat">
              <span className="dashboard-stat-icon">▣</span>
              <div>
                <p>Published exams</p>
                <h2>{totalExams}</h2>
              </div>
            </article>

            <article className="dashboard-stat">
              <span className="dashboard-stat-icon">?</span>
              <div>
                <p>Questions in current paper</p>
                <h2>{questionsCount}</h2>
              </div>
            </article>

            <article className="dashboard-stat">
              <span className="dashboard-stat-icon">↗</span>
              <div>
                <p>Student responses</p>
                <h2>—</h2>
                <small>Not connected yet</small>
              </div>
            </article>
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div>
                <h2>Exam workflow</h2>
                <p>Move through the main steps of creating an exam.</p>
              </div>
            </div>

            <div className="dashboard-workflow">
              <Link to="/generate-questions" className="dashboard-action">
                <span className="dashboard-action-number">01</span>
                <span className="dashboard-action-icon">✦</span>
                <h3>Generate questions</h3>
                <p>
                  Upload study material and generate objective
                  questions using AI.
                </p>
                <span className="dashboard-action-link">
                  Start generating →
                </span>
              </Link>

              <Link to="/review-questions" className="dashboard-action">
                <span className="dashboard-action-number">02</span>
                <span className="dashboard-action-icon">✓</span>
                <h3>Review questions</h3>
                <p>
                  Check answers, edit questions, and retry
                  questions before publishing.
                </p>
                <span className="dashboard-action-link">
                  Review paper →
                </span>
              </Link>

              <Link to="/published-exams" className="dashboard-action">
                <span className="dashboard-action-number">03</span>
                <span className="dashboard-action-icon">↗</span>
                <h3>Published exams</h3>
                <p>
                  Open student links and manage your published
                  Google Forms.
                </p>
                <span className="dashboard-action-link">
                  View published exams →
                </span>
              </Link>

              <Link to="/results" className="dashboard-action">
                <span className="dashboard-action-number">04</span>
                <span className="dashboard-action-icon">▤</span>
                <h3>Results</h3>
                <p>
                  View student scores and performance once
                  response retrieval is connected.
                </p>
                <span className="dashboard-action-link">
                  View results →
                </span>
              </Link>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div>
                <h2>Recently published</h2>
                <p>Your saved Google Forms.</p>
              </div>

              <Link
                to="/published-exams"
                className="dashboard-text-link"
              >
                View all →
              </Link>
            </div>

            {publishedExams.length === 0 ? (
              <div className="dashboard-empty">
                <div className="dashboard-empty-icon">▣</div>
                <h3>No published exams yet</h3>
                <p>
                  Your Google Forms will appear here after you
                  publish your first exam.
                </p>
                <Link
                  to="/generate-questions"
                  className="dashboard-primary-button"
                >
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
                    <div className="dashboard-recent-icon">▤</div>

                    <div className="dashboard-recent-details">
                      <strong>
                        {exam.title || exam.name || `Published exam ${index + 1}`}
                      </strong>
                      <span>
                        {exam.publishedAt
                          ? `Published ${new Date(
                              exam.publishedAt
                            ).toLocaleDateString()}`
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
                        Open form ↗
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
