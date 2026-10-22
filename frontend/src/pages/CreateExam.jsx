import Sidebar from "../components/Sidebar";

function CreateExam() {
  return (
    <div className="app-layout">

      <Sidebar />

      <main className="main-content">

        <div className="topbar">
          <div className="topbar-title">
            Create Exam
          </div>
        </div>

        <div className="content">

          <div className="page-heading">
            <h1>Create a new examination</h1>
            <p>
              Define the requirements for your AI-generated question paper.
            </p>
          </div>

          <div className="form-card">

            <div className="form-row">

              <div className="form-group">
                <label>Exam title</label>
                <input
                  className="form-control"
                  placeholder="e.g. Data Structures Unit Test"
                />
              </div>

              <div className="form-group">
                <label>Subject</label>
                <input
                  className="form-control"
                  placeholder="e.g. Data Structures"
                />
              </div>

            </div>


            <div className="form-row">

              <div className="form-group">
                <label>Number of questions</label>

                <input
                  className="form-control"
                  type="number"
                  placeholder="20"
                />
              </div>

              <div className="form-group">
                <label>Difficulty</label>

                <select className="form-control">
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                  <option>Mixed</option>
                </select>
              </div>

            </div>


            <div className="form-group">

              <label>
                Question types
              </label>

              <select className="form-control">
                <option>
                  MCQ + True/False + Fill in the Blanks
                </option>

                <option>
                  MCQ only
                </option>

                <option>
                  MCQ + True/False
                </option>

                <option>
                  Mixed objective questions
                </option>
              </select>

            </div>


            <div className="form-group">

              <label>
                Bloom's Taxonomy distribution
              </label>

              <input
                className="form-control"
                placeholder="Remember, Understand, Apply, Analyze..."
              />

            </div>


            <button className="btn btn-primary">
              Continue to Material Upload →
            </button>

          </div>

        </div>

      </main>

    </div>
  );
}

export default CreateExam;