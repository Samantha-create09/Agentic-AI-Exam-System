from services.llm_service import LLMService


class QuestionAgent:

    def __init__(self):
        self.llm = LLMService()

    def generate_questions(
        self,
        text,
        mcq_count,
        true_false_count,
        fill_blank_count,
        short_answer_count,
        difficulty,
        bloom_distribution,
        concept_graph=None
    ):

        total_questions = (
            mcq_count
            + true_false_count
            + fill_blank_count
            + short_answer_count
        )

        instructions = """
You are Agent 2 of an academic examination system.

Your task is to generate high-quality objective
examination questions strictly from the supplied
study material.

You MUST follow every rule below.

1. Do not invent facts that are not supported by
   the study material.

2. Questions must be academically meaningful.

3. Questions must be clear and grammatically correct.

4. Avoid duplicate questions.

5. Avoid ambiguous questions.

6. MCQs must have exactly four options.

7. MCQs must have exactly one correct answer.

8. True/False questions must use exactly:
   True
   False

9. Fill-in-the-blank questions must have accepted answers.

10. Short factual answer questions must have a concise
    expected answer and accepted answers.

11. Follow the requested difficulty exactly.

12. Generate exactly the requested number of questions
    for each question type.

13. Generate exactly the requested total number of questions.

14. Generate exactly the requested number of questions
    for EACH Bloom level.

15. DO NOT change the Bloom distribution.

16. Every question must contain its Bloom level.

17. Every question must contain the concept being tested.

18. Every question must contain an explanation.

19. EVERY question MUST have exactly 1 mark.

20. Never generate 2 marks, 3 marks, or any other mark value.

21. Do not include Markdown.

22. Return only the requested JSON structure.

The Bloom distribution is a HARD requirement.

For example:

Remember: 2
Understand: 2
Apply: 1
Analyze: 1
Evaluate: 0
Create: 0

You MUST generate:

2 Remember questions
2 Understand questions
1 Apply question
1 Analyze question
0 Evaluate questions
0 Create questions

Do not change these numbers.

The question-type distribution is also a HARD requirement.

If the requested distribution is:

MCQ: 4
TRUE_FALSE: 2
FILL_BLANK: 2
SHORT_ANSWER: 2

then generate exactly:

4 MCQs
2 True/False questions
2 Fill-in-the-blank questions
2 Short factual answer questions

Every question must have exactly 1 mark.
"""

        concept_information = ""

        if concept_graph:

            concept_information = f"""
CONCEPT GRAPH CREATED BY AGENT 1:

{concept_graph}

Use this concept information when selecting
important concepts for the questions.

Do not invent relationships or concepts that
are not supported by the study material.
"""

        user_prompt = f"""
Generate exactly {total_questions} questions.

QUESTION TYPE DISTRIBUTION:

MCQ:
{mcq_count}

TRUE_FALSE:
{true_false_count}

FILL_BLANK:
{fill_blank_count}

SHORT_ANSWER:
{short_answer_count}


DIFFICULTY:

{difficulty}


EXACT BLOOM DISTRIBUTION:

Remember: {bloom_distribution.get("Remember", 0)}

Understand: {bloom_distribution.get("Understand", 0)}

Apply: {bloom_distribution.get("Apply", 0)}

Analyze: {bloom_distribution.get("Analyze", 0)}

Evaluate: {bloom_distribution.get("Evaluate", 0)}

Create: {bloom_distribution.get("Create", 0)}


IMPORTANT:

Every question must have:

marks = 1

The total number of questions must be:

{total_questions}


{concept_information}


STUDY MATERIAL:

{text}
"""

        schema = {
            "type": "object",
            "properties": {
                "questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {

                            "question": {
                                "type": "string"
                            },

                            "type": {
                                "type": "string",
                                "enum": [
                                    "MCQ",
                                    "TRUE_FALSE",
                                    "FILL_BLANK",
                                    "SHORT_ANSWER"
                                ]
                            },

                            "options": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                }
                            },

                            "correctAnswer": {
                                "type": "string"
                            },

                            "acceptedAnswers": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                }
                            },

                            "marks": {
                                "type": "integer"
                            },

                            "bloomLevel": {
                                "type": "string",
                                "enum": [
                                    "Remember",
                                    "Understand",
                                    "Apply",
                                    "Analyze",
                                    "Evaluate",
                                    "Create"
                                ]
                            },

                            "difficulty": {
                                "type": "string",
                                "enum": [
                                    "Low",
                                    "Medium",
                                    "High"
                                ]
                            },

                            "concept": {
                                "type": "string"
                            },

                            "explanation": {
                                "type": "string"
                            }
                        },

                        "required": [
                            "question",
                            "type",
                            "options",
                            "correctAnswer",
                            "acceptedAnswers",
                            "marks",
                            "bloomLevel",
                            "difficulty",
                            "concept",
                            "explanation"
                        ]
                    }
                }
            },

            "required": [
                "questions"
            ]
        }

        result = self.llm.generate_json(
            instructions=instructions,
            input_text=user_prompt,
            schema_name="exam_questions",
            schema=schema
        )

        questions = result["questions"]

        # ======================================
        # System-level enforcement
        # ======================================

        # Every question is exactly 1 mark.
        for question in questions:
            question["marks"] = 1

        # Force True/False options
        for question in questions:

            if question["type"] == "TRUE_FALSE":

                question["options"] = [
                    "True",
                    "False"
                ]

        return questions