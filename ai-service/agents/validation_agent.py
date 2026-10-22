class ValidationAgent:

    ALLOWED_TYPES = {

        "MCQ",
        "TRUE_FALSE",
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


    def validate_questions(
        self,
        questions
    ):

        issues = []

        seen_questions = set()


        for index, question in enumerate(
            questions
        ):

            number = index + 1


            # ================================================
            # QUESTION TEXT
            # ================================================

            question_text = (
                question.get(
                    "question",
                    ""
                )
                .strip()
            )


            if not question_text:

                issues.append({

                    "question":
                        number,

                    "issue":
                        "Question text is empty"
                })


            # ================================================
            # DUPLICATES
            # ================================================

            normalized = (
                question_text
                .lower()
                .strip()
            )


            if normalized in seen_questions:

                issues.append({

                    "question":
                        number,

                    "issue":
                        "Duplicate question"
                })


            seen_questions.add(
                normalized
            )


            # ================================================
            # TYPE
            # ================================================

            question_type = question.get(
                "type"
            )


            if question_type not in self.ALLOWED_TYPES:

                issues.append({

                    "question":
                        number,

                    "issue":
                        f"Invalid question type: {question_type}"
                })


            # ================================================
            # MARKS
            # ================================================

            if question.get("marks") != 1:

                issues.append({

                    "question":
                        number,

                    "issue":
                        "Question must have exactly 1 mark"
                })


            # ================================================
            # BLOOM
            # ================================================

            bloom_level = question.get(
                "bloomLevel"
            )


            if bloom_level not in self.ALLOWED_BLOOM:

                issues.append({

                    "question":
                        number,

                    "issue":
                        f"Invalid Bloom level: {bloom_level}"
                })


            # ================================================
            # DIFFICULTY
            # ================================================

            difficulty = question.get(
                "difficulty"
            )


            if difficulty not in self.ALLOWED_DIFFICULTY:

                issues.append({

                    "question":
                        number,

                    "issue":
                        f"Invalid difficulty: {difficulty}"
                })


            # ================================================
            # CONCEPT
            # ================================================

            if not question.get(
                "concept"
            ):

                issues.append({

                    "question":
                        number,

                    "issue":
                        "Concept is missing"
                })


            # ================================================
            # EXPLANATION
            # ================================================

            if not question.get(
                "explanation"
            ):

                issues.append({

                    "question":
                        number,

                    "issue":
                        "Explanation is missing"
                })


            # ================================================
            # MCQ
            # ================================================

            if question_type == "MCQ":

                options = question.get(
                    "options",
                    []
                )


                if len(options) != 4:

                    issues.append({

                        "question":
                            number,

                        "issue":
                            "MCQ must have exactly 4 options"
                    })


                if len(
                    set(options)
                ) != len(options):

                    issues.append({

                        "question":
                            number,

                        "issue":
                            "MCQ options must be unique"
                    })


                correct_answer = question.get(
                    "correctAnswer",
                    ""
                )


                if correct_answer not in options:

                    issues.append({

                        "question":
                            number,

                        "issue":
                            "MCQ correct answer must be one of the options"
                    })


            # ================================================
            # TRUE / FALSE
            # ================================================

            elif question_type == "TRUE_FALSE":

                correct_answer = str(
                    question.get(
                        "correctAnswer",
                        ""
                    )
                )


                if correct_answer not in {
                    "True",
                    "False"
                }:

                    issues.append({

                        "question":
                            number,

                        "issue":
                            "True/False answer must be True or False"
                    })


            # ================================================
            # FILL IN BLANK
            # ================================================

            elif question_type == "FILL_BLANK":

                accepted_answers = question.get(
                    "acceptedAnswers",
                    []
                )


                if not accepted_answers:

                    issues.append({

                        "question":
                            number,

                        "issue":
                            "Fill-in-the-blank requires accepted answers"
                    })


            # ================================================
            # SHORT ANSWER
            # ================================================

            elif question_type == "SHORT_ANSWER":

                correct_answer = (
                    question.get(
                        "correctAnswer",
                        ""
                    )
                    .strip()
                )


                accepted_answers = question.get(
                    "acceptedAnswers",
                    []
                )


                if not correct_answer:

                    issues.append({

                        "question":
                            number,

                        "issue":
                            "Short answer requires a correct answer"
                    })


                if not accepted_answers:

                    issues.append({

                        "question":
                            number,

                        "issue":
                            "Short answer requires accepted answers"
                    })


        return {

            "valid":
                len(issues) == 0,

            "totalQuestions":
                len(questions),

            "issues":
                issues,

            "questions":
                questions
        }