-- ============================================
-- AGENTIC AI EXAM SYSTEM
-- DATABASE SCHEMA
-- ============================================

-- ============================================
-- USERS
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash TEXT,
    role VARCHAR(30) NOT NULL DEFAULT 'TEACHER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- EXAMS
-- ============================================

CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    subject VARCHAR(150) NOT NULL,

    total_questions INTEGER DEFAULT 0,

    difficulty VARCHAR(50),

    mcq_count INTEGER DEFAULT 0,
    true_false_count INTEGER DEFAULT 0,
    fill_blank_count INTEGER DEFAULT 0,
    short_answer_count INTEGER DEFAULT 0,

    status VARCHAR(50) DEFAULT 'DRAFT',

    teacher_id INTEGER REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- MATERIALS
-- ============================================

CREATE TABLE IF NOT EXISTS materials (
    id SERIAL PRIMARY KEY,

    exam_id INTEGER REFERENCES exams(id)
        ON DELETE CASCADE,

    file_name VARCHAR(255) NOT NULL,

    file_path TEXT,

    extracted_text TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- QUESTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,

    exam_id INTEGER REFERENCES exams(id)
        ON DELETE CASCADE,

    question_text TEXT NOT NULL,

    question_type VARCHAR(50) NOT NULL,

    options JSONB,

    correct_answer TEXT,

    accepted_answers JSONB,

    marks INTEGER DEFAULT 1,

    bloom_level VARCHAR(50),

    difficulty VARCHAR(50),

    concept VARCHAR(255),

    explanation TEXT,

    status VARCHAR(50) DEFAULT 'GENERATED',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- EXAM QUESTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS exam_questions (
    id SERIAL PRIMARY KEY,

    exam_id INTEGER REFERENCES exams(id)
        ON DELETE CASCADE,

    question_id INTEGER REFERENCES questions(id)
        ON DELETE CASCADE,

    question_order INTEGER,

    UNIQUE(exam_id, question_id)
);


-- ============================================
-- GOOGLE FORMS
-- ============================================

CREATE TABLE IF NOT EXISTS google_forms (
    id SERIAL PRIMARY KEY,

    exam_id INTEGER REFERENCES exams(id)
        ON DELETE CASCADE,

    form_id VARCHAR(255),

    form_url TEXT,

    status VARCHAR(50) DEFAULT 'CREATED',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- STUDENT RESPONSES
-- ============================================

CREATE TABLE IF NOT EXISTS responses (
    id SERIAL PRIMARY KEY,

    exam_id INTEGER REFERENCES exams(id)
        ON DELETE CASCADE,

    google_response_id VARCHAR(255),

    student_email VARCHAR(255),

    submitted_at TIMESTAMP,

    answers JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- RESULTS
-- ============================================

CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,

    exam_id INTEGER REFERENCES exams(id)
        ON DELETE CASCADE,

    response_id INTEGER REFERENCES responses(id)
        ON DELETE CASCADE,

    student_email VARCHAR(255),

    total_questions INTEGER DEFAULT 0,

    correct_answers INTEGER DEFAULT 0,

    wrong_answers INTEGER DEFAULT 0,

    score NUMERIC(10,2) DEFAULT 0,

    percentage NUMERIC(5,2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);