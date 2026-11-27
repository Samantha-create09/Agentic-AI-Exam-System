
import re
from services.llm_service import LLMService


QUESTION_TYPES = [
    "MCQ", "TRUE_FALSE", "STATEMENT_MCQ", "FILL_BLANK", "SHORT_ANSWER"
]
BLOOM_LEVELS = [
    "Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"
]
STATEMENT_OPTIONS = [
    "Both statements are true.",
    "Both statements are false.",
    "Statement I is true, but Statement II is false.",
    "Statement I is false, but Statement II is true."
]


class QuestionAgent:
    BATCH_CHARS = 36000
    QUESTION_TYPES = QUESTION_TYPES
    BLOOM_LEVELS = BLOOM_LEVELS
    STATEMENT_OPTIONS = STATEMENT_OPTIONS

    def __init__(self):
        self.llm = LLMService()

    def _split(self, text):
        if not text or not text.strip():
            raise ValueError("No selected source material was supplied.")

        pages = re.split(
            r"(?=---\s*(?:File:.*?\|\s*)?Page\s+\d+\s*---)",
            text,
            flags=re.IGNORECASE
        )
        chunks, current = [], ""

        for page in pages:
            page = page.strip()
            if not page:
                continue

            if len(page) > self.BATCH_CHARS:
                if current:
                    chunks.append(current)
                    current = ""
                for start in range(0, len(page), self.BATCH_CHARS):
                    chunks.append(page[start:start + self.BATCH_CHARS])
                continue

            if current and len(current) + len(page) > self.BATCH_CHARS:
                chunks.append(current)
                current = page
            else:
                current = (current + "\n\n" + page).strip()

        if current:
            chunks.append(current)

        return chunks

    @staticmethod
    def _allocate(total, capacities):
        result = [0] * len(capacities)
        if total == 0:
            return result
        total_capacity = sum(capacities)
        if total_capacity == 0:
            raise ValueError("No capacity available for requested questions.")

        remaining = total
        for i, capacity in enumerate(capacities):
            amount = min(remaining, capacity)
            result[i] = amount
            remaining -= amount
            if remaining == 0:
                break
        if remaining:
            raise ValueError("Could not allocate requested questions.")
        return result

    @staticmethod
    def _normalise(question):
        q = dict(question)
        q["marks"] = 1
        q["type"] = str(q.get("type", "")).upper().replace("-", "_").replace(" ", "_")
        q["question"] = str(q.get("question", "")).strip()

        if q["type"] == "TRUE_FALSE":
            q["options"] = ["True", "False"]
            q["correctAnswer"] = str(q.get("correctAnswer", "")).strip().rstrip(".").capitalize()
            if q["correctAnswer"] not in ("True", "False"):
                raise ValueError("True/False answer must be True or False.")

        elif q["type"] == "STATEMENT_MCQ":
            q["options"] = STATEMENT_OPTIONS.copy()
            raw_answer = " ".join(str(q.get("correctAnswer", "")).split()).strip()
            normalized_map = {
                opt.rstrip(".").casefold(): opt for opt in STATEMENT_OPTIONS
            }
            matched = normalized_map.get(raw_answer.rstrip(".").casefold())
            if matched:
                q["correctAnswer"] = matched
            else:
                # Handle minor phrasing variations like missing "but"
                lower = raw_answer.casefold()
                if "both" in lower and "true" in lower:
                    q["correctAnswer"] = STATEMENT_OPTIONS[0]
                elif "both" in lower and "false" in lower:
                    q["correctAnswer"] = STATEMENT_OPTIONS[1]
                elif "statement i is true" in lower and "statement ii is false" in lower:
                    q["correctAnswer"] = STATEMENT_OPTIONS[2]
                elif "statement i is false" in lower and "statement ii is true" in lower:
                    q["correctAnswer"] = STATEMENT_OPTIONS[3]

        elif q["type"] == "MCQ":
            options = [str(x).strip() for x in (q.get("options") or []) if str(x).strip()]
            if len(options) != 4 or len({x.casefold() for x in options}) != 4:
                raise ValueError("Every MCQ must have exactly four distinct options.")
            q["options"] = options

            raw_answer = str(q.get("correctAnswer", "")).strip()
            exact_by_case = {opt.casefold(): opt for opt in options}
            if raw_answer in options:
                q["correctAnswer"] = raw_answer
            elif raw_answer.casefold() in exact_by_case:
                q["correctAnswer"] = exact_by_case[raw_answer.casefold()]
            elif raw_answer.upper() in {"A", "B", "C", "D"}:
                q["correctAnswer"] = options["ABCD".index(raw_answer.upper())]
            elif raw_answer in {"1", "2", "3", "4"}:
                q["correctAnswer"] = options[int(raw_answer) - 1]
            else:
                q["correctAnswer"] = raw_answer

        elif q["type"] in ("FILL_BLANK", "SHORT_ANSWER"):
            raw_accepted = q.get("acceptedAnswers") or []
            if isinstance(raw_accepted, str):
                raw_accepted = [raw_accepted]
            accepted = []
            seen_ans = set()
            for item in raw_accepted:
                cleaned = str(item).strip()
                if cleaned and cleaned.casefold() not in seen_ans:
                    accepted.append(cleaned)
                    seen_ans.add(cleaned.casefold())

            answer = str(q.get("correctAnswer", "")).strip()
            if not answer and accepted:
                answer = accepted[0]
            if answer and answer.casefold() not in seen_ans:
                accepted.insert(0, answer)
            if not answer or not accepted:
                raise ValueError(f"{q['type']} needs a correct answer and accepted answers.")
            q["correctAnswer"] = answer
            q["acceptedAnswers"] = accepted

        if q["type"] not in QUESTION_TYPES:
            raise ValueError(f"Unsupported question type: {q['type']}")
        if q.get("bloomLevel") not in BLOOM_LEVELS:
            raise ValueError("Generated question has an invalid Bloom level.")
        if not q["question"]:
            raise ValueError("Generated question text is empty.")
        if not str(q.get("explanation", "")).strip():
            q["explanation"] = "Grounded in the selected study material."
        if not str(q.get("concept", "")).strip():
            q["concept"] = "Selected concept"
        return q

    @staticmethod
    def _allocate_with_capacity(total, remaining_capacity):
        allocation = [0] * len(remaining_capacity)
        remaining = total

        for index, capacity in enumerate(remaining_capacity):
            amount = min(remaining, capacity)
            allocation[index] = amount
            remaining_capacity[index] -= amount
            remaining -= amount

            if remaining == 0:
                break

        if remaining:
            raise ValueError("Could not allocate the requested distribution.")

        return allocation

    def generate_questions(
        self,
        text,
        mcq_count=0,
        true_false_count=0,
        fill_blank_count=0,
        short_answer_count=0,
        difficulty="Medium",
        bloom_distribution=None,
        concept_graph=None,
        statement_mcq_count=0,
        retry_reason=""
    ):
        type_counts = {
            "MCQ": int(mcq_count),
            "TRUE_FALSE": int(true_false_count),
            "STATEMENT_MCQ": int(statement_mcq_count),
            "FILL_BLANK": int(fill_blank_count),
            "SHORT_ANSWER": int(short_answer_count)
        }
        if any(v < 0 for v in type_counts.values()):
            raise ValueError("Question counts cannot be negative.")

        total = sum(type_counts.values())
        bloom = {
            level: int((bloom_distribution or {}).get(level, 0))
            for level in BLOOM_LEVELS
        }

        if total < 1 or sum(bloom.values()) != total:
            raise ValueError("Bloom distribution must equal total question count.")
        if any(v < 0 for v in bloom.values()):
            raise ValueError("Bloom counts cannot be negative.")
        if difficulty not in ("Low", "Medium", "High"):
            raise ValueError("Invalid difficulty.")

        chunks = self._split(text)

        weights = [max(1, len(chunk)) for chunk in chunks]
        total_weight = sum(weights)

        raw_allocations = [
            total * weight / total_weight
            for weight in weights
        ]

        capacities = [
            int(value)
            for value in raw_allocations
        ]

        remaining = total - sum(capacities)

        fractional_order = sorted(
            range(len(raw_allocations)),
            key=lambda index: raw_allocations[index] - capacities[index],
            reverse=True
        )

        for index in fractional_order[:remaining]:
            capacities[index] += 1

        type_allocations = {}
        type_capacity = capacities.copy()

        for question_type in QUESTION_TYPES:
            type_allocations[question_type] = self._allocate_with_capacity(
                type_counts[question_type],
                type_capacity
            )

        bloom_allocations = {}
        bloom_capacity = capacities.copy()

        for level in BLOOM_LEVELS:
            bloom_allocations[level] = self._allocate_with_capacity(
                bloom[level],
                bloom_capacity
            )
            
        schema = {
            "type": "object",
            "properties": {
                "questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "question": {"type": "string"},
                            "type": {"type": "string", "enum": QUESTION_TYPES},
                            "options": {"type": "array", "items": {"type": "string"}},
                            "correctAnswer": {"type": "string"},
                            "acceptedAnswers": {"type": "array", "items": {"type": "string"}},
                            "marks": {"type": "integer"},
                            "bloomLevel": {"type": "string", "enum": BLOOM_LEVELS},
                            "difficulty": {"type": "string", "enum": ["Low", "Medium", "High"]},
                            "concept": {"type": "string"},
                            "explanation": {"type": "string"}
                        },
                        "required": [
                            "question", "type", "options", "correctAnswer",
                            "acceptedAnswers", "marks", "bloomLevel",
                            "difficulty", "concept", "explanation"
                        ]
                    }
                }
            },
            "required": ["questions"]
        }

        instructions = """
You are Agent 2. Generate clean, standalone university examination questions
grounded ONLY in the facts present in the supplied study-material batch.
Do not use outside knowledge.

CRITICAL PHRASING RULE:
- Write every question as a self-contained exam question.
- NEVER include self-referential or meta phrases such as "According to the study material",
  "According to the text", "Based on the passage", "In the provided notes",
  "As mentioned in the slides", "From the document", or any reference to
  "the passage", "the text", "the slides", or "the notes".
- Example: ask "What underlying kernel is the Android operating system built upon?"
  NOT "According to the study material, what underlying kernel is Android built upon?"

Follow the exact requested question-type counts and Bloom counts:
the total number of returned questions MUST equal the exact sum of EXACT TYPE COUNTS.
Every question is worth exactly 1 mark (marks: 1).
- MCQ: exactly four distinct options, and correctAnswer MUST match one option verbatim.
- TRUE_FALSE: one statement, options ["True", "False"], correctAnswer "True" or "False".
- STATEMENT_MCQ: question MUST contain both "Statement I: ..." and "Statement II: ...", options MUST be ["Both statements are true.", "Both statements are false.", "Statement I is true, but Statement II is false.", "Statement I is false, but Statement II is true."], and correctAnswer MUST be one of those four exact strings.
- FILL_BLANK: meaningful blank plus non-empty correctAnswer and non-empty acceptedAnswers.
- SHORT_ANSWER: focused answerable question plus non-empty correctAnswer and non-empty acceptedAnswers.
Always provide non-empty concept and explanation strings.
Avoid duplicates. Return JSON only.
"""

        all_questions = []
        for index, chunk in enumerate(chunks):
            batch_total = capacities[index]
            if batch_total == 0:
                # The chunk was considered in allocation but doesn't need
                # a separate generation call because no questions were assigned.
                continue

            requested_types = {
                t: type_allocations[t][index] for t in QUESTION_TYPES
            }
            requested_bloom = {
                level: bloom_allocations[level][index] for level in BLOOM_LEVELS
            }

            result = self.llm.generate_json(
                instructions=instructions,
                input_text=(
                    f"DIFFICULTY: {difficulty}\n"
                    f"EXACT TYPE COUNTS: {requested_types}\n"
                    f"EXACT BLOOM COUNTS: {requested_bloom}\n"
                    f"TEACHER FEEDBACK: {retry_reason}\n"
                    f"CONCEPT CONTEXT: {concept_graph or {}}\n\n"
                    f"SOURCE BATCH {index + 1}/{len(chunks)}:\n{chunk}"
                ),
                schema_name="exam_questions",
                schema=schema,
                task="question_generation",
            )

            generated = result.get("questions", [])
            if len(generated) != batch_total:
                raise ValueError(
                    f"Batch {index + 1} returned {len(generated)} questions; "
                    f"{batch_total} were requested. No automatic regeneration "
                    "was performed, to avoid wasting API quota."
                )

            source_files = set()
            source_pages = set()

            for match in re.finditer(
                r"---\s*(?:File:\s*(.*?)\s*\|\s*)?Page\s+(\d+)\s*---",
                chunk
            ):
                source_files.add(
                    (match.group(1) or "Uploaded material").strip()
                )
                source_pages.add(int(match.group(2)))

            for raw_question in generated:
                question = self._normalise(raw_question)
                question["source"] = {
                    "files": sorted(source_files),
                    "pages": sorted(source_pages)
                }
                all_questions.append(question)

        # Exact combined distribution validation.
        if len(all_questions) != total:
            raise ValueError(
                f"Expected {total} questions, received {len(all_questions)}."
            )

        actual_types = {
            t: sum(q["type"] == t for q in all_questions)
            for t in QUESTION_TYPES
        }
        actual_bloom = {
            level: sum(q["bloomLevel"] == level for q in all_questions)
            for level in BLOOM_LEVELS
        }

        if actual_types != type_counts:
            raise ValueError(f"Question-type mismatch: {actual_types}")
        if actual_bloom != bloom:
            raise ValueError(f"Bloom distribution mismatch: {actual_bloom}")

        seen = set()
        for q in all_questions:
            key = re.sub(r"\s+", " ", q["question"].casefold()).strip()
            if key in seen:
                raise ValueError("Duplicate questions were generated. Review the source or request fewer questions.")
            seen.add(key)

        for number, q in enumerate(all_questions, 1):
            q["number"] = number
            q["marks"] = 1

        return all_questions
