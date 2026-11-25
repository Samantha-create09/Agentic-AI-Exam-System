
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

function PublishedExams() {
  const [exams, setExams] = useState([]);

  useEffect(() => {
    const saved = readSession("publishedExams", []);
    const latest = readSession("publishedForm", null);

    let list = Array.isArray(saved) ? [...saved] : [];

    if (latest && latest.formUrl) {
      const existingIndex = list.findIndex(
        (exam) => exam.formUrl === latest.formUrl
      );

      const latestExam = {
        ...latest,
        title:
          latest.title ||
          latest.formTitle ||
          latest.name ||
          "Published exam",
        publishedAt: latest.publishedAt || new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        list[existingIndex] = {
          ...list[existingIndex],
          ...latestExam,
        };
      } else {
        list.unshift(latestExam);
      }
    }

    // Remove duplicate forms using their student URL.
    list = list.filter(
      (exam, index, all) =>
        exam.formUrl &&
        all.findIndex((item) => item.formUrl === exam.formUrl) === index
    );

    setExams(list);
    sessionStorage.setItem("publishedExams", JSON.stringify(list));
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <div className="topbar">
          <div className="topbar-title">Published Exams</div>

          <div className="user-area">
            <strong>Teacher</strong>
            <div className="avatar">T</div>
          </div>
        </div>

        <div className="content dashboard-home">
          <section className="page-heading">
            <p className="dashboard-eyebrow">
              EXAM MANAGEMENT
            </p>

            <h1>Published exams</h1>

            <p>
              Open the student form, edit the Google Form, or
              check its publication details.
            </p>
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div>
                <h2>Your Google Forms</h2>
                <p>
                  {exams.length} saved{" "}
                  {exams.length === 1 ? "exam" : "exams"}
                </p>
              </div>
            </div>

            {exams.length === 0 ? (
              <div className="dashboard-empty">
                <div className="dashboard-empty-icon">▣</div>
                <h3>No published exams yet</h3>
                <p>
                  After you publish an exam, its student and
                  editor links will appear here.
                </p>

                <a
                  href="/generate-questions"
                  className="dashboard-primary-button"
                >
                  Generate questions
                </a>
              </div>
            ) : (
              <div className="published-exam-list">
                {exams.map((exam, index) => (
                  <article
                    className="published-exam-card"
                    key={exam.formUrl}
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
                          {exam.publishedAt
                            ? `Published ${new Date(
                                exam.publishedAt
                              ).toLocaleString()}`
                            : "Google Form"}
                        </p>
                      </div>

                      <span className="published-status">
                        Published
                      </span>
                    </div>

                    <div className="published-exam-links">
                      <div>
                        <span>Student link</span>
                        <p>
                          {exam.formUrl
                            ? "Share this link with students."
                            : "Student link not available."}
                        </p>
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
                        <span>Teacher link</span>
                        <p>
                          Open the form to manage questions and
                          settings.
                        </p>
                        {exam.editUrl && (
                          <a
                            href={exam.editUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open form editor ↗
                          </a>
                        )}
                      </div>
                    </div>

                    {exam.expiryDate && (
                      <p className="published-expiry">
                        Close date saved:{" "}
                        {new Date(exam.expiryDate).toLocaleString()}
                      </p>
                    )}

                    {!exam.editUrl && (
                      <p className="published-note">
                        The editor URL was not returned for this
                        form. Use the student link only until the
                        editor link is available.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <p className="published-footnote">
            These links are stored in this browser session. They
            are not yet saved permanently to your database.
          </p>
        </div>
      </main>
    </div>
  );
}

export default PublishedExams;
