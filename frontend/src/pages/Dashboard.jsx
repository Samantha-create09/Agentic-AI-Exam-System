import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";

function Dashboard() {
  return (
    <div className="app-layout">

      <Sidebar />

      <main className="main-content">

        <div className="topbar">

          <div className="topbar-title">
            Dashboard
          </div>

          <div className="user-area">

            <div>
              <strong>Teacher</strong>
            </div>

            <div className="avatar">
              T
            </div>

          </div>

        </div>


        <div className="content">

          <div className="page-heading">

            <h1>
              Good morning, Teacher!
            </h1>

            <p>
              Manage your exams, questions and student results.
            </p>

          </div>


          <div className="stats-grid">

            <div className="stat-card">

              <div className="stat-top">

                <span className="stat-label">
                  Total Exams
                </span>

                <div className="stat-icon">
                  ▣
                </div>

              </div>

              <div className="stat-number">
                12
              </div>

            </div>


            <div className="stat-card">

              <div className="stat-top">

                <span className="stat-label">
                  Question Bank
                </span>

                <div className="stat-icon">
                  ?
                </div>

              </div>

              <div className="stat-number">
                248
              </div>

            </div>


            <div className="stat-card">

              <div className="stat-top">

                <span className="stat-label">
                  Published
                </span>

                <div className="stat-icon">
                  ✓
                </div>

              </div>

              <div className="stat-number">
                8
              </div>

            </div>


            <div className="stat-card">

              <div className="stat-top">

                <span className="stat-label">
                  Responses
                </span>

                <div className="stat-icon">
                  ◉
                </div>

              </div>

              <div className="stat-number">
                186
              </div>

            </div>

          </div>


          <div className="dashboard-grid">

            <div className="card">

              <div className="card-header">

                <h2>
                  Quick actions
                </h2>

              </div>


              <div className="quick-actions">

                <Link
                  to="/create-exam"
                  className="action-card"
                >
                  <div className="action-icon">
                    📝
                  </div>

                  <h3>
                    Create Exam
                  </h3>

                  <p>
                    Set subject, difficulty, Bloom levels
                    and question requirements.
                  </p>
                </Link>


                <Link
                  to="/upload-material"
                  className="action-card"
                >
                  <div className="action-icon">
                    📄
                  </div>

                  <h3>
                    Upload Material
                  </h3>

                  <p>
                    Upload PDFs, notes or study material
                    for AI processing.
                  </p>
                </Link>


                <Link
                  to="/generate-questions"
                  className="action-card"
                >
                  <div className="action-icon">
                    ✨
                  </div>

                  <h3>
                    Generate Questions
                  </h3>

                  <p>
                    Generate balanced AI questions from
                    your approved material.
                  </p>
                </Link>


                <Link
                  to="/review-questions"
                  className="action-card"
                >
                  <div className="action-icon">
                    ✓
                  </div>

                  <h3>
                    Review Questions
                  </h3>

                  <p>
                    Check, edit and approve AI-generated
                    questions before publishing.
                  </p>
                </Link>

              </div>

            </div>


            <div className="card">

              <div className="card-header">

                <h2>
                  Recent exams
                </h2>

              </div>


              <div className="exam-row">

                <div>
                  <div className="exam-name">
                    Data Structures
                  </div>

                  <div className="exam-info">
                    25 questions · 30 students
                  </div>
                </div>

                <span className="badge badge-green">
                  Published
                </span>

              </div>


              <div className="exam-row">

                <div>
                  <div className="exam-name">
                    Operating Systems
                  </div>

                  <div className="exam-info">
                    20 questions · 42 students
                  </div>
                </div>

                <span className="badge badge-green">
                  Published
                </span>

              </div>


              <div className="exam-row">

                <div>
                  <div className="exam-name">
                    Computer Networks
                  </div>

                  <div className="exam-info">
                    30 questions · Draft
                  </div>
                </div>

                <span className="badge badge-yellow">
                  Draft
                </span>

              </div>

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}

export default Dashboard;