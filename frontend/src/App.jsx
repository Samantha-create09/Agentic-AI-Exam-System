import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateExam from "./pages/CreateExam";
import UploadMaterial from "./pages/UploadMaterial";
import GenerateQuestions from "./pages/GenerateQuestions";
import ReviewQuestions from "./pages/ReviewQuestions";
import PublishedExams from "./pages/PublishedExams";
import Results from "./pages/Results";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Login />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create-exam" element={<CreateExam />} />
        <Route path="/upload-material" element={<UploadMaterial />} />
        <Route path="/generate-questions" element={<GenerateQuestions />} />
        <Route path="/review-questions" element={<ReviewQuestions />} />
        <Route path="/published-exams" element={<PublishedExams />} />
        <Route path="/results" element={<Results />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;