
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const { Pool } = require("pg");
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const AI_URL = process.env.AI_SERVICE_URL;
const PORT = process.env.PORT || 5000;

if (!AI_URL) {
    console.error("AI_SERVICE_URL is missing from backend/.env");
}

const uploadDirectory = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024;

const upload = multer({
    dest: uploadDirectory,
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
    fileFilter: (req, file, cb) => {
        const name = (file.originalname || "").toLowerCase();
        if (!name.endsWith(".pdf")) {
            return cb(new Error("Please upload PDF files only."));
        }
        cb(null, true);
    }
});

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

function sendUpstreamError(res, error, fallback) {
    const status = error.response?.status || 500;
    const data = error.response?.data;
    console.error("Upstream AI service error:", {
        status,
        data: data ?? error.message
    });
    const detailText = typeof data?.detail === "string"
        ? data.detail
        : Array.isArray(data?.detail)
            ? data.detail.map(item => item?.msg || JSON.stringify(item)).join("; ")
            : null;
    return res.status(status).json({
        success: false,
        error: data?.error,
        message: data?.message || detailText || fallback,
        detail: data?.detail || error.message,
        retry_at: data?.retry_at,
        retry_after_seconds: data?.retry_after_seconds
    });
}

function cleanup(files) {
    for (const file of files || []) {
        if (file.path && fs.existsSync(file.path)) {
            try {
                fs.unlinkSync(file.path);
            } catch (error) {
                console.error("Upload cleanup error:", error.message);
            }
        }
    }
}

app.get("/", (req, res) => {
    res.json({ message: "Agentic AI Exam System Backend is running" });
});

app.get("/api/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({
            message: "PostgreSQL connected successfully",
            time: result.rows[0].now
        });
    } catch (error) {
        res.status(500).json({
            message: "Database connection failed",
            error: error.message
        });
    }
});

app.get("/api/test-ai", async (req, res) => {
    try {
        const response = await axios.get(`${AI_URL}/api/test`, {
            timeout: 10000
        });
        res.json({
            message: "Node.js connected to FastAPI successfully",
            aiServiceResponse: response.data
        });
    } catch (error) {
        sendUpstreamError(res, error, "Could not connect to FastAPI.");
    }
});

// STEP 1: upload PDFs and analyse them once.
app.post(
    "/api/analyze-material",
    upload.array("files", MAX_FILES),
    async (req, res) => {
        const files = req.files || [];
        try {
            if (!files.length) {
                return res.status(400).json({
                    success: false,
                    message: "Please upload at least one PDF."
                });
            }

            const totalSize = files.reduce((sum, file) => sum + file.size, 0);
            if (totalSize > MAX_TOTAL_SIZE) {
                return res.status(400).json({
                    success: false,
                    message: "Combined PDF size cannot exceed 100 MB."
                });
            }

            const form = new FormData();
            for (const file of files) {
                form.append("files", fs.createReadStream(file.path), {
                    filename: path.basename(file.originalname || "upload.pdf"),
                    contentType: "application/pdf"
                });
            }

            const response = await axios.post(
                `${AI_URL}/api/analyze-material`,
                form,
                {
                    headers: form.getHeaders(),
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                    timeout: 600000
                }
            );
            res.status(response.status).json(response.data);
        } catch (error) {
            sendUpstreamError(res, error, "Material analysis failed.");
        } finally {
            cleanup(files);
        }
    }
);

// STEP 2: local page search + AI evidence assessment.
app.post("/api/search-concept", async (req, res) => {
    try {
        const response = await axios.post(
            `${AI_URL}/api/search-concept`,
            req.body,
            { timeout: 180000 }
        );
        res.status(response.status).json(response.data);
    } catch (error) {
        sendUpstreamError(res, error, "Concept evidence search failed.");
    }
});

app.post("/api/add-concept", async (req, res) => {
    try {
        const response = await axios.post(
            `${AI_URL}/api/add-concept`,
            req.body,
            { timeout: 30000 }
        );
        res.status(response.status).json(response.data);
    } catch (error) {
        sendUpstreamError(res, error, "Could not add the concept.");
    }
});

// STEP 3: generate from selected concepts and cached source material.
app.post("/api/generate-questions", async (req, res) => {
    try {
        const response = await axios.post(
            `${AI_URL}/api/generate-questions`,
            req.body,
            { timeout: 600000 }
        );
        res.status(response.status).json(response.data);
    } catch (error) {
        sendUpstreamError(res, error, "Question generation failed.");
    }
});

// STEP 3: targeted question retry. No PDF upload.
app.post("/api/retry-question", async (req, res) => {
    try {
        const response = await axios.post(
            `${AI_URL}/api/retry-question`,
            req.body,
            { timeout: 300000 }
        );
        res.status(response.status).json(response.data);
    } catch (error) {
        sendUpstreamError(res, error, "Question retry failed.");
    }
});

// STEP 3: one whole-paper retry. Uses cached material.
app.post("/api/retry-paper", async (req, res) => {
    try {
        const response = await axios.post(
            `${AI_URL}/api/retry-paper`,
            req.body,
            { timeout: 600000 }
        );
        res.status(response.status).json(response.data);
    } catch (error) {
        sendUpstreamError(res, error, "Paper retry failed.");
    }
});

// STEP 4: existing Google Forms deployment route retained.
app.post("/api/deploy-google-form", async (req, res) => {
    try {
        const response = await axios.post(
            `${AI_URL}/api/deploy-google-form`,
            req.body,
            { headers: { "Content-Type": "application/json" }, timeout: 120000 }
        );
        res.json(response.data);
    } catch (error) {
        sendUpstreamError(res, error, "Google Form deployment failed.");
    }
});

app.get("/api/generation/:generationId", async (req, res) => {
    try {
        const response = await axios.get(
            `${AI_URL}/api/generation/${encodeURIComponent(req.params.generationId)}`,
            { timeout: 15000 }
        );
        res.status(response.status).json(response.data);
    } catch (error) {
        sendUpstreamError(res, error, "Could not load the saved generation.");
    }
});

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Each PDF must be 25 MB or smaller."
            : error.code === "LIMIT_FILE_COUNT"
                ? `Maximum ${MAX_FILES} PDF files allowed.`
                : error.message;

        return res.status(400).json({
            success: false,
            message
        });
    }

    if (error.message === "Please upload PDF files only.") {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    console.error("Backend error:", error);
    res.status(500).json({
        success: false,
        message: "An unexpected backend error occurred.",
        detail: error.message
    });
});

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
