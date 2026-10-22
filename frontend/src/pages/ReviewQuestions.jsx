import Sidebar from "../components/Sidebar";

function ReviewQuestions() {
  return (
    <div className="app-layout">

      <Sidebar />

      <main className="main-content">

        <div className="topbar">
          <div className="topbar-title">
            Review Questions
          </div>
        </div>

        <div className="content">

          <div className="page-heading">

            <h1>
              Review generated questions
            </h1>

            <p>
              Review and edit questions before sending them
              to Google Forms.
            </p>

          </div>


          <div className="card">

            <div className="exam-row">

              <div>

                <span className="badge badge-green">
                  MCQ
                </span>

                <div className="exam-name">
                  Which data structure follows the FIFO principle?
                </div>

                <div className="exam-info">
                  Bloom: Remember · 1 mark
                </div>

              </div>

              <button className="btn btn-secondary">
                Edit
              </button>

            </div>


            <div className="exam-row">

              <div>

                <span className="badge badge-green">
                  TRUE / FALSE
                </span>

                <div className="exam-name">
                  A stack follows the FIFO principle.
                </div>

                <div className="exam-info">
                  Bloom: Understand · 1 mark
                </div>

              </div>

              <button className="btn btn-secondary">
                Edit
              </button>

            </div>


            <div className="exam-row">

              <div>

                <span className="badge badge-green">
                  FILL BLANK
                </span>

                <div className="exam-name">
                  The process of arranging data in order is called ______.
                </div>

                <div className="exam-info">
                  Bloom: Remember · 1 mark
                </div>

              </div>

              <button className="btn btn-secondary">
                Edit
              </button>

            </div>


            <br />

            <button className="btn btn-primary">
              Approve & Create Google Form →
            </button>

          </div>

        </div>

      </main>

    </div>
  );
}

export default ReviewQuestions;