import Sidebar from "../components/Sidebar";

function UploadMaterial() {
  return (
    <div className="app-layout">

      <Sidebar />

      <main className="main-content">

        <div className="topbar">
          <div className="topbar-title">
            Upload Material
          </div>
        </div>

        <div className="content">

          <div className="page-heading">

            <h1>
              Upload study material
            </h1>

            <p>
              Upload PDFs or notes that the AI agents will use
              to understand the syllabus and generate questions.
            </p>

          </div>


          <div className="form-card">

            <div className="upload-box">

              <div className="upload-icon">
                📄
              </div>

              <h3>
                Drop your PDF here
              </h3>

              <p>
                Supported format: PDF
              </p>

              <button className="btn btn-primary">
                Choose PDF
              </button>

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}

export default UploadMaterial;