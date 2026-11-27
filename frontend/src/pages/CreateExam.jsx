import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

function CreateExam() {
  const navigate = useNavigate();
  const [title, setTitle] = useState(sessionStorage.getItem("examTitle") || "");
  const [subject, setSubject] = useState(sessionStorage.getItem("examSubject") || "");

  function handleContinue(event) {
    event.preventDefault();
    if (title.trim()) sessionStorage.setItem("examTitle", title.trim());
    if (subject.trim()) sessionStorage.setItem("examSubject", subject.trim());
    navigate("/generate-questions");
  }

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <div className="topbar">
          <div className="topbar-title">Create Exam</div>

          <div className="user-area">
            <strong>Teacher</strong>
            <div className="avatar">T</div>
          </div>
        </div>

        <div className="content dashboard-home">
          <section className="page-heading">
            <p className="dashboard-eyebrow">Assessment Setup</p>
            <h1>Create a new examination</h1>
            <p>
              Define the exam title and subject, then continue to material upload and question configuration.
            </p>
          </section>

          <form className="form-card" onSubmit={handleContinue}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="create-title">Exam title</label>
                <input
                  id="create-title"
                  className="form-control"
                  placeholder="e.g. Data Structures Unit Test"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="create-subject">Subject</label>
                <input
                  id="create-subject"
                  className="form-control"
                  placeholder="e.g. Data Structures"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            </div>

            <div className="workflow-actions">
              <span />
              <button type="submit" className="primary-button">
                Continue to Configure &amp; Upload
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default CreateExam;
