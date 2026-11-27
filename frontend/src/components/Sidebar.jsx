import { NavLink, useLocation } from "react-router-dom";
import BrandMark from "./BrandMark";

const CREATE_EXAM_PATHS = [
  "/generate-questions",
  "/select-concepts",
  "/review-questions",
  "/create-exam",
];

function Sidebar() {
  const { pathname } = useLocation();
  const isCreateExamActive = CREATE_EXAM_PATHS.some((prefix) =>
    pathname.startsWith(prefix)
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <BrandMark size={36} />
        <div>
          <div className="brand-title">Agentic AI</div>
          <div className="brand-subtitle">Exam System</div>
        </div>
      </div>

      <div className="nav-section">
        <div className="nav-title">Workspace</div>

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
          </svg>
          Dashboard
        </NavLink>

        <NavLink
          to="/generate-questions"
          className={() =>
            `nav-item${isCreateExamActive ? " active" : ""}`
          }
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Create Exam
        </NavLink>
      </div>

      <div className="nav-section">
        <div className="nav-title">Assessment</div>

        <NavLink
          to="/published-exams"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="13" y2="17" />
          </svg>
          Published Exams
        </NavLink>

        <NavLink
          to="/results"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Results
        </NavLink>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-teacher">
          <div className="sidebar-avatar">T</div>
          <div>
            <div className="sidebar-teacher-name">Teacher</div>
            <div className="sidebar-teacher-role">Faculty Portal</div>
          </div>
        </div>

        <NavLink to="/" className="sidebar-signout">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </NavLink>
      </div>
    </aside>
  );
}

export default Sidebar;
