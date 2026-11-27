import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark";

const OMR_ROWS = [
  { q: "01", marked: 1 },
  { q: "02", marked: 3 },
  { q: "03", marked: 0 },
  { q: "04", marked: 2 },
  { q: "05", marked: 4 },
];

const CHOICES = ["A", "B", "C", "D", "E"];

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <BrandMark size={38} />
          <div>
            <div className="brand-title">Agentic AI Exam System</div>
            <div className="brand-subtitle">Academic Assessment Studio</div>
          </div>
        </div>

        <div className="login-hero">
          <h1>From syllabus PDF to a ready exam</h1>
          <p>
            Upload course material, verify extracted concepts, balance Bloom&apos;s
            taxonomy targets, and deploy auto-graded quizzes to Google Forms.
          </p>
        </div>

        <div className="omr-card" aria-hidden="true">
          <div className="omr-card-header">
            <span>OMR Response Blueprint</span>
            <span className="omr-card-badge">5 Questions · 1 Mark Each</span>
          </div>

          <svg
            className="omr-svg"
            viewBox="0 0 340 156"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {CHOICES.map((letter, colIdx) => (
              <text
                key={letter}
                x={78 + colIdx * 52}
                y="16"
                textAnchor="middle"
                fill="#B4BCD8"
                fontSize="11"
                fontWeight="600"
                fontFamily="Inter, sans-serif"
              >
                {letter}
              </text>
            ))}

            {OMR_ROWS.map((row, rowIdx) => {
              const y = 40 + rowIdx * 26;
              return (
                <g key={row.q}>
                  <text
                    x="14"
                    y={y + 4}
                    fill="#B4BCD8"
                    fontSize="12"
                    fontWeight="600"
                    fontFamily="Inter, sans-serif"
                  >
                    Q{row.q}
                  </text>
                  {CHOICES.map((_, colIdx) => {
                    const cx = 78 + colIdx * 52;
                    const isMarked = colIdx === row.marked;
                    return (
                      <circle
                        key={colIdx}
                        cx={cx}
                        cy={y}
                        r="8.5"
                        fill={isMarked ? "#F5C542" : "none"}
                        stroke={isMarked ? "#F5C542" : "#4A5499"}
                        strokeWidth="1.75"
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <div className="login-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={`login-tab${mode === "signin" ? " active" : ""}`}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "create"}
              className={`login-tab${mode === "create" ? " active" : ""}`}
              onClick={() => setMode("create")}
            >
              Create account
            </button>
          </div>

          <h2>{mode === "signin" ? "Welcome back" : "Create faculty account"}</h2>
          <p className="login-subtitle">
            {mode === "signin"
              ? "Sign in to manage your examinations and question banks."
              : "Set up your faculty workspace to generate and publish exams."}
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            {mode === "create" && (
              <div className="form-group">
                <label htmlFor="login-name">Full Name</label>
                <input
                  id="login-name"
                  className="form-control"
                  type="text"
                  placeholder="Prof. Elena Vance"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="form-control"
                type="email"
                placeholder="teacher@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="form-control"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="primary-button">
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
