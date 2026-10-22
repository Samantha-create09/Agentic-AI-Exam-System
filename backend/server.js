const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const { Pool } = require("pg");
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ======================================
// Temporary PDF upload configuration
// ======================================

const upload = multer({
    dest: "uploads/"
});

// ======================================
// PostgreSQL Connection
// ======================================

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

// ======================================
// Basic Backend Test
// ======================================

app.get("/", (req, res) => {
    res.json({
        message: "Agentic AI Exam System Backend is running"
    });
});

// ======================================
// PostgreSQL Test
// ======================================

app.get("/api/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            message: "PostgreSQL connected successfully",
            time: result.rows[0].now
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Database connection failed",
            error: error.message
        });
    }
});

// ======================================
// FastAPI Connection Test
// ======================================

app.get("/api/test-ai", async (req, res) => {

    try {

        const response = await axios.get(
            `${process.env.AI_SERVICE_URL}/api/test`
        );

        res.json({
            message: "Node.js connected to FastAPI successfully",
            aiServiceResponse: response.data
        });

    } catch (error) {

        console.error(error.message);

        res.status(500).json({
            message: "Could not connect to FastAPI",
            error: error.message
        });
    }
});

// ======================================
// PDF Question Generation
// Node.js → FastAPI
// ======================================

app.post(
    "/api/generate-questions",
    upload.single("file"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    message: "PDF file is required"
                });
            }

            const form = new FormData();

            // Send PDF
            form.append(
                "file",
                fs.createReadStream(req.file.path)
            );

            // Question type counts
            form.append(
                "mcq_count",
                req.body.mcq_count || "0"
            );

            form.append(
                "true_false_count",
                req.body.true_false_count || "0"
            );

            form.append(
                "fill_blank_count",
                req.body.fill_blank_count || "0"
            );

            form.append(
                "short_answer_count",
                req.body.short_answer_count || "0"
            );

            // Difficulty
            form.append(
                "difficulty",
                req.body.difficulty || "Medium"
            );

            // Bloom counts
            form.append(
                "remember_count",
                req.body.remember_count || "0"
            );

            form.append(
                "understand_count",
                req.body.understand_count || "0"
            );

            form.append(
                "apply_count",
                req.body.apply_count || "0"
            );

            form.append(
                "analyze_count",
                req.body.analyze_count || "0"
            );

            form.append(
                "evaluate_count",
                req.body.evaluate_count || "0"
            );

            form.append(
                "create_count",
                req.body.create_count || "0"
            );

            // Send request to FastAPI
            const response = await axios.post(
                `${process.env.AI_SERVICE_URL}/api/generate-questions`,
                form,
                {
                    headers: {
                        ...form.getHeaders()
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );

            // Delete temporary uploaded PDF
            if (
                req.file &&
                fs.existsSync(req.file.path)
            ) {
                fs.unlinkSync(req.file.path);
            }

            res.json(response.data);

        } catch (error) {

            console.error(
                "Question generation error:",
                error.response?.data ||
                error.message
            );

            // Always delete temporary PDF
            if (
                req.file &&
                fs.existsSync(req.file.path)
            ) {
                fs.unlinkSync(req.file.path);
            }

            res.status(
                error.response?.status || 500
            ).json({

                message: "Question generation failed",

                error:
                    error.response?.data ||
                    error.message
            });
        }
    }
);

// ======================================
// Start Server
// ======================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(
        `Server running on http://localhost:${PORT}`
    );

});