class ValidationAgent:

    ALLOWED_TYPES = {
        "MCQ",
        "TRUE_FALSE",
        "STATEMENT_MCQ",
        "FILL_BLANK",
        "SHORT_ANSWER"
    }

    ALLOWED_BLOOM = {
        "Remember",
        "Understand",
        "Apply",
        "Analyze",
        "Evaluate",
        "Create"
    }

    ALLOWED_DIFFICULTY = {
        "Low",
        "Medium",
        "High"
    }

    STATEMENT_MCQ_OPTIONS = [
        "Both statements are true.",
        "Both statements are false.",
        "Statement I is true, but Statement II is false.",
        "Statement I is false, but Statement II is true."
    ]

    def validate_questions(self, questions):

        issues = []
        seen_questions = set()

        for index, question in enumerate(questions):

            number = index + 1

            # ================================================
            # QUESTION TEXT
            # ================================================

            question_text = str(
                question.get("question", "")
            ).strip()

            if not question_text:

                issues.append({
                    "question": number,
                    "issue": "Question text is empty"
                })

            # ================================================
            # DUPLICATES
            # ================================================

            normalized = " ".join(
                question_text.lower().split()
            )

            if normalized in seen_questions:

                issues.append({
                    "question": number,
                    "issue": "Duplicate question"
                })

            seen_questions.add(normalized)

            # ================================================
            # TYPE
            # ================================================

            question_type = question.get("type")

            if question_type not in self.ALLOWED_TYPES:

                issues.append({
                    "question": number,
                    "issue": f"Invalid question type: {question_type}"
                })

            # ================================================
            # MARKS
            # ================================================

            if question.get("marks") != 1:

                issues.append({
                    "question": number,
                    "issue": "Question must have exactly 1 mark"
                })

            # ================================================
            # BLOOM
            # ================================================

            bloom_level = question.get("bloomLevel")

            if bloom_level not in self.ALLOWED_BLOOM:

                issues.append({
                    "question": number,
                    "issue": f"Invalid Bloom level: {bloom_level}"
                })

            # ================================================
            # DIFFICULTY
            # ================================================

            difficulty = question.get("difficulty")

            if difficulty not in self.ALLOWED_DIFFICULTY:

                issues.append({
                    "question": number,
                    "issue": f"Invalid difficulty: {difficulty}"
                })

            # ================================================
            # CONCEPT
            # ================================================

            if not str(question.get("concept", "")).strip():

                issues.append({
                    "question": number,
                    "issue": "Concept is missing"
                })

            # ================================================
            # EXPLANATION
            # ================================================

            if not str(question.get("explanation", "")).strip():

                issues.append({
                    "question": number,
                    "issue": "Explanation is missing"
                })

            # ================================================
            # MCQ
            # ================================================

            if question_type == "MCQ":

                options = question.get("options", [])

                if not isinstance(options, list) or len(options) != 4:

                    issues.append({
                        "question": number,
                        "issue": "MCQ must have exactly 4 options"
                    })

                else:

                    if len(set(options)) != 4:

                        issues.append({
                            "question": number,
                            "issue": "MCQ options must be unique"
                        })

                    correct_answer = question.get(
                        "correctAnswer", ""
                    )

                    if correct_answer not in options:

                        issues.append({
                            "question": number,
                            "issue": "MCQ correct answer must be one of the options"
                        })

            # ================================================
            # NORMAL TRUE / FALSE
            # ================================================

            elif question_type == "TRUE_FALSE":

                options = question.get("options", [])

                if options != ["True", "False"]:

                    issues.append({
                        "question": number,
                        "issue": "Normal True/False must have exactly True and False options"
                    })

                correct_answer = str(
                    question.get("correctAnswer", "")
                )

                if correct_answer not in {"True", "False"}:

                    issues.append({
                        "question": number,
                        "issue": "True/False answer must be True or False"
                    })

            # ================================================
            # STATEMENT-BASED TRUE / FALSE MCQ
            # ================================================

            elif question_type == "STATEMENT_MCQ":

                options = question.get("options", [])

                # Must contain two labelled statements
                has_statement_one = (
                    "statement i:" in question_text.lower()
                )

                has_statement_two = (
                    "statement ii:" in question_text.lower()
                )

                if not has_statement_one or not has_statement_two:

                    issues.append({
                        "question": number,
                        "issue": "Statement-based MCQ must contain Statement I and Statement II"
                    })

                # Exactly four fixed options
                if options != self.STATEMENT_MCQ_OPTIONS:

                    issues.append({
                        "question": number,
                        "issue": "Statement-based MCQ must use the four standard answer options"
                    })

                # Correct answer must match one of those options
                correct_answer = question.get(
                    "correctAnswer", ""
                )

                if correct_answer not in self.STATEMENT_MCQ_OPTIONS:

                    issues.append({
                        "question": number,
                        "issue": "Statement-based MCQ answer must match one of the four standard options"
                    })

            # ================================================
            # FILL IN THE BLANK
            # ================================================

            elif question_type == "FILL_BLANK":

                accepted_answers = question.get(
                    "acceptedAnswers", []
                )

                correct_answer = str(
                    question.get("correctAnswer", "")
                ).strip()

                if not correct_answer:

                    issues.append({
                        "question": number,
                        "issue": "Fill-in-the-blank requires a correct answer"
                    })

                if not isinstance(accepted_answers, list) or not accepted_answers:

                    issues.append({
                        "question": number,
                        "issue": "Fill-in-the-blank requires accepted answers"
                    })

            # ================================================
            # SHORT ANSWER
            # ================================================

            elif question_type == "SHORT_ANSWER":

                correct_answer = str(
                    question.get("correctAnswer", "")
                ).strip()

                accepted_answers = question.get(
                    "acceptedAnswers", []
                )

                if not correct_answer:

                    issues.append({
                        "question": number,
                        "issue": "Short answer requires a correct answer"
                    })

                if not isinstance(accepted_answers, list) or not accepted_answers:

                    issues.append({
                        "question": number,
                        "issue": "Short answer requires accepted answers"
                    })

        return {
            "valid": len(issues) == 0,
            "totalQuestions": len(questions),
            "issues": issues,
            "questions": questions
        }