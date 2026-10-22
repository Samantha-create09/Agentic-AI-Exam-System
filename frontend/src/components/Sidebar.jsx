import { NavLink } from "react-router-dom";

function Sidebar() {
  return (
    <aside className="sidebar">

      <div className="logo">

        <div className="logo-icon">
          ✦
        </div>

        <div>
          <div className="logo-text">
            ExamAI
          </div>

          <div className="logo-subtitle">
            AGENTIC EXAM SYSTEM
          </div>
        </div>

      </div>


      <div className="nav-title">
        Workspace
      </div>


      <NavLink
        to="/dashboard"
        className="nav-item"
      >
        <span>⌂</span>
        Dashboard
      </NavLink>


      <NavLink
        to="/create-exam"
        className="nav-item"
      >
        <span>＋</span>
        Create Exam
      </NavLink>


      <NavLink
        to="/upload-material"
        className="nav-item"
      >
        <span>↑</span>
        Upload Material
      </NavLink>


      <NavLink
        to="/generate-questions"
        className="nav-item"
      >
        <span>✦</span>
        Generate Questions
      </NavLink>


      <NavLink
        to="/review-questions"
        className="nav-item"
      >
        <span>✓</span>
        Review Questions
      </NavLink>


      <div className="nav-title">
        Assessment
      </div>


      <NavLink
        to="/published-exams"
        className="nav-item"
      >
        <span>▣</span>
        Published Exams
      </NavLink>


      <NavLink
        to="/results"
        className="nav-item"
      >
        <span>▤</span>
        Results
      </NavLink>

    </aside>
  );
}

export default Sidebar;