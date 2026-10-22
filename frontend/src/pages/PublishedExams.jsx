import Sidebar from "../components/Sidebar";

function PublishedExams() {
  return (
    <div className="app-layout">

      <Sidebar />

      <main className="main-content">

        <div className="topbar">
          <div className="topbar-title">
            Published Exams
          </div>
        </div>

        <div className="content">

          <div className="page-heading">

            <h1>
              Published examinations
            </h1>

            <p>
              Manage your live Google Forms examinations.
            </p>

          </div>


          <div className="card">

            <div className="exam-row">

              <div>
                <div className="exam-name">
                  Data Structures Unit Test
                </div>

                <div className="exam-info">
                  20 questions · 32 responses
                </div>
              </div>

              <span className="badge badge-green">
                Live
              </span>

            </div>


            <div className="exam-row">

              <div>
                <div className="exam-name">
                  Operating Systems Quiz
                </div>

                <div className="exam-info">
                  15 questions · 28 responses
                </div>
              </div>

              <span className="badge badge-green">
                Live
              </span>

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}

export default PublishedExams;