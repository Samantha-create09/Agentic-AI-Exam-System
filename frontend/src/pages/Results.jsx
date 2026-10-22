import Sidebar from "../components/Sidebar";

function Results() {
  return (
    <div className="app-layout">

      <Sidebar />

      <main className="main-content">

        <div className="topbar">
          <div className="topbar-title">
            Results
          </div>
        </div>

        <div className="content">

          <div className="page-heading">

            <h1>
              Examination results
            </h1>

            <p>
              View automatically evaluated objective responses
              and student performance.
            </p>

          </div>


          <div className="stats-grid">

            <div className="stat-card">

              <div className="stat-label">
                Responses
              </div>

              <div className="stat-number">
                186
              </div>

            </div>


            <div className="stat-card">

              <div className="stat-label">
                Average Score
              </div>

              <div className="stat-number">
                78%
              </div>

            </div>


            <div className="stat-card">

              <div className="stat-label">
                Highest Score
              </div>

              <div className="stat-number">
                96%
              </div>

            </div>


            <div className="stat-card">

              <div className="stat-label">
                Questions
              </div>

              <div className="stat-number">
                20
              </div>

            </div>

          </div>


          <div className="card">

            <div className="card-header">
              <h2>
                Recent results
              </h2>
            </div>

            <div className="exam-row">
              <div>
                <div className="exam-name">
                  Student 001
                </div>
                <div className="exam-info">
                  Data Structures Unit Test
                </div>
              </div>

              <strong>
                18 / 20
              </strong>
            </div>


            <div className="exam-row">
              <div>
                <div className="exam-name">
                  Student 002
                </div>
                <div className="exam-info">
                  Data Structures Unit Test
                </div>
              </div>

              <strong>
                16 / 20
              </strong>
            </div>

          </div>

        </div>

      </main>

    </div>
  );
}

export default Results;