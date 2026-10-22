import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div className="login-page">

      <div className="login-left">

        <div className="logo">
          <div className="logo-icon">✦</div>

          <div>
            <div className="logo-text">ExamAI</div>
            <div className="logo-subtitle">
              AGENTIC EXAM SYSTEM
            </div>
          </div>
        </div>

        <h1>
          Smarter exams.
          <br />
          Better evaluation.
        </h1>

        <p>
          A teacher-supervised AI platform for generating
          balanced question papers, conducting assessments,
          and analysing student performance.
        </p>

      </div>


      <div className="login-right">

        <div className="login-card">

          <h2>Welcome back</h2>

          <p>
            Sign in to manage your examinations.
          </p>

          <form onSubmit={handleLogin}>

            <div className="form-group">
              <label>Email address</label>

              <input
                className="form-control"
                type="email"
                placeholder="teacher@example.com"
                required
              />
            </div>


            <div className="form-group">
              <label>Password</label>

              <input
                className="form-control"
                type="password"
                placeholder="Enter your password"
                required
              />
            </div>


            <button className="btn btn-primary">
              Sign in
            </button>

          </form>

        </div>

      </div>

    </div>
  );
}

export default Login;