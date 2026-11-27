
import re
import uuid
from services.llm_service import LLMService


class ConceptAgent:
    CHUNK_SIZE = 48000

    def __init__(self):
        self.llm = LLMService()

    _QUESTION_PREFIX_RE = re.compile(
        r"^(?:q\d*[\.\):]?\s*)?(?:"
        r"what\s+(?:is|are|do|does)|"
        r"why\s+(?:is|are|do|does)|"
        r"how\s+(?:do|does|is|are|can|to)|"
        r"when\s+(?:is|are|do|does|should)|"
        r"where\s+(?:is|are|do|does)|"
        r"which\s+(?:is|are|of)|"
        r"define|explain|describe|list|enumerate|state|compare|"
        r"differentiate|distinguish|discuss|illustrate|elaborate|"
        r"write\s+(?:a\s+)?short\s+notes?\s+on"
        r")\b",
        re.IGNORECASE,
    )

    _NOISE_HEADINGS = {
        "question",
        "questions",
        "review question",
        "review questions",
        "exercise",
        "exercises",
        "assignment",
        "assignments",
        "practice questions",
        "thank you",
        "thanks",
        "references",
        "bibliography",
        "agenda",
        "table of contents",
        "contents",
        "learning objectives",
        "objectives",
        "summary",
    }

    @staticmethod
    def _id(value):
        return str(uuid.uuid5(uuid.NAMESPACE_URL, str(value).casefold()))

    @staticmethod
    def _normalize_name(name):
        text = str(name or "").strip()
        if not text:
            return ""
        # Strip parenthetical acronyms/notes so e.g.
        # "Message-Oriented Middleware (MOM)" matches "Message Oriented Middleware".
        without_parens = re.sub(r"\([^)]*\)", " ", text)
        normalized = re.sub(r"[^a-z0-9\s]", " ", without_parens.casefold())
        normalized = " ".join(normalized.split())
        if normalized:
            return normalized
        fallback = re.sub(r"[^a-z0-9\s]", " ", text.casefold())
        return " ".join(fallback.split())

    @staticmethod
    def _prefer_name(existing_name, candidate_name):
        if not existing_name:
            return candidate_name
        if "(" in candidate_name and "(" not in existing_name:
            return candidate_name
        return existing_name

    @classmethod
    def _is_question_text(cls, text):
        cleaned = " ".join(str(text or "").split()).strip()
        if not cleaned:
            return False
        if cleaned.endswith("?"):
            return True
        if cls._QUESTION_PREFIX_RE.match(cleaned):
            # Reject imperative/interrogative slide prompts such as
            # "Explain types of middleware" or "What is Middleware".
            if len(cleaned) <= 140 and "." not in cleaned[:-1]:
                return True
        return False

    @classmethod
    def _is_noise_heading(cls, name):
        norm = cls._normalize_name(name)
        if not norm:
            return True
        if norm in cls._NOISE_HEADINGS:
            return True
        if cls._is_question_text(name):
            return True
        return False

    @staticmethod
    def _merge_sources(existing_sources, new_source):
        file_name = str(new_source.get("file", "Uploaded material")).strip() or "Uploaded material"
        new_pages = [int(p) for p in new_source.get("pages", []) if p is not None]

        for entry in existing_sources:
            if entry.get("file") == file_name:
                merged = sorted(set(entry.get("pages", [])) | set(new_pages))
                entry["pages"] = merged
                return

        existing_sources.append({
            "file": file_name,
            "pages": sorted(set(new_pages))
        })

    @classmethod
    def _merge_description(cls, existing_desc, candidate_desc):
        cand = " ".join(str(candidate_desc or "").split()).strip()
        if not cand or cls._is_question_text(cand):
            return existing_desc
        if not existing_desc:
            return cand
        if len(existing_desc) < 60 and len(cand) > len(existing_desc) + 20:
            return cand
        return existing_desc

    def split_pages(self, text):
        if not text or not text.strip():
            raise ValueError("No readable text was extracted from the PDFs.")

        marker = re.compile(
            r"(?m)^---\s*(?:File:\s*(.*?)\s*\|\s*)?Page\s+(\d+)\s*---\s*$"
        )
        matches = list(marker.finditer(text))
        pages = []

        if matches:
            for i, match in enumerate(matches):
                end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
                content = text[match.end():end].strip()
                if content:
                    pages.append({
                        "file": (match.group(1) or "Uploaded material").strip(),
                        "page": int(match.group(2)),
                        "text": content
                    })
        else:
            pages.append({"file": "Uploaded material", "page": 1, "text": text})

        return pages

    def _chunks(self, text):
        pages = self.split_pages(text)
        chunks = []
        current_parts = []
        current_len = 0
        current_pages = []

        def flush_chunk():
            if not current_parts:
                return
            grouped_sources = []
            for entry in current_pages:
                self._merge_sources(
                    grouped_sources,
                    {"file": entry["file"], "pages": [entry["page"]]},
                )
            chunks.append({
                "file": grouped_sources[0]["file"] if grouped_sources else "Uploaded material",
                "pages": sorted({entry["page"] for entry in current_pages}),
                "sources": grouped_sources,
                "valid_page_pairs": {(entry["file"], entry["page"]) for entry in current_pages},
                "text": "\n\n".join(current_parts),
            })

        for page in pages:
            formatted = f"--- File: {page['file']} | Page {page['page']} ---\n{page['text']}"

            if len(formatted) > self.CHUNK_SIZE:
                flush_chunk()
                current_parts = []
                current_len = 0
                current_pages = []

                body = page["text"]
                for start in range(0, len(body), self.CHUNK_SIZE):
                    part = body[start:start + self.CHUNK_SIZE].strip()
                    if part:
                        part_text = f"--- File: {page['file']} | Page {page['page']} ---\n{part}"
                        chunks.append({
                            "file": page["file"],
                            "pages": [page["page"]],
                            "sources": [{"file": page["file"], "pages": [page["page"]]}],
                            "valid_page_pairs": {(page["file"], page["page"])},
                            "text": part_text,
                        })
                continue

            if current_parts and current_len + len(formatted) + 2 > self.CHUNK_SIZE:
                flush_chunk()
                current_parts = []
                current_len = 0
                current_pages = []

            current_parts.append(formatted)
            current_len += len(formatted) + 2
            current_pages.append({"file": page["file"], "page": page["page"]})

        flush_chunk()
        return chunks

    @staticmethod
    def _resolve_chunk_sources(raw_sources, chunk):
        """
        Validate LLM-reported sources against pages actually present in the chunk.
        Falls back to the chunk's full source list if none match cleanly.
        """
        valid_pairs = chunk.get("valid_page_pairs") or set()
        chunk_sources = chunk.get("sources") or [
            {"file": chunk["file"], "pages": chunk["pages"]}
        ]
        files_in_chunk = [s["file"] for s in chunk_sources]
        resolved = []

        for entry in raw_sources or []:
            if not isinstance(entry, dict):
                continue
            raw_file = str(entry.get("file", "")).strip()
            matched_file = None

            for candidate in files_in_chunk:
                if raw_file == candidate or raw_file.casefold() == candidate.casefold():
                    matched_file = candidate
                    break
            if matched_file is None and len(files_in_chunk) == 1:
                matched_file = files_in_chunk[0]
            if matched_file is None:
                continue

            valid_pages_for_file = {
                p for f, p in valid_pairs if f == matched_file
            }
            valid_pages = []
            for p in entry.get("pages", []):
                try:
                    page_num = int(p)
                except (TypeError, ValueError):
                    continue
                if page_num in valid_pages_for_file:
                    valid_pages.append(page_num)

            if valid_pages:
                ConceptAgent._merge_sources(
                    resolved,
                    {"file": matched_file, "pages": valid_pages},
                )

        return resolved or [
            {"file": s["file"], "pages": list(s["pages"])}
            for s in chunk_sources
        ]

    def extract_concepts(self, text):
        chunks = self._chunks(text)
        collected = {}

        schema = {
            "type": "object",
            "properties": {
                "concepts": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "description": {"type": "string"},
                            "sources": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "file": {"type": "string"},
                                        "pages": {
                                            "type": "array",
                                            "items": {"type": "integer"}
                                        }
                                    },
                                    "required": ["file", "pages"]
                                }
                            },
                            "subtopics": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string"},
                                        "description": {"type": "string"}
                                    },
                                    "required": ["name", "description"]
                                }
                            }
                        },
                        "required": ["name", "description", "subtopics"]
                    }
                },
                "relationships": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "source": {"type": "string"},
                            "target": {"type": "string"},
                            "relationship": {"type": "string"}
                        },
                        "required": ["source", "target", "relationship"]
                    }
                }
            },
            "required": ["concepts", "relationships"]
        }

        instructions = """
You are Agent 1, an academic syllabus analyst. Analyse ONLY the supplied study-material passage and extract genuine, teachable syllabus concepts and subtopics suitable for university exam questions.

STRICT INCLUSION RULES:
- Extract ONLY substantive academic concepts and meaningful subtopics actually taught in the passage.
- Aim for 5 to 12 clean, high-level parent concepts across a full unit (e.g., for a Middleware unit: "Middleware Overview & Role", "Web Server as Middleware", "Message-Oriented Middleware (MOM)", "Object Middleware & ORB", "Remote Procedure Call (RPC) Middleware", "API Middleware", "Factors for Choosing a Middleware Platform", "Android OS as Middleware"), each with 2 to 6 concise subtopics.
- Keep every concept and subtopic description to 1 to 2 crisp, factual sentences grounded strictly in the passage.
- For each concept's "sources", list the exact PDF filename and page numbers from the `--- File: ... | Page ... ---` headers where that concept appears.
- Do NOT use outside knowledge or invent missing information.

STRICT EXCLUSION RULES:
- EXCLUDE cover-slide and administrative metadata (college/institute names, department names, professor/author names, addresses, course/unit codes, dates, page footers).
- EXCLUDE review, exercise, or assignment questions at the end of slides (e.g., "What is Middleware?", "Explain types of middleware").
- EXCLUDE generic non-topic nouns ("Features", "Connectivity", "Software Components", "Front End", "Back End", "Business Logic", "Design Processes", "Advantages", "Examples") unless the passage is a major dedicated academic section on that topic.
- EXCLUDE standalone real-world product/company examples ("Uber", "Amazon", "Google Maps API", "Apache Kafka") as top-level concepts; keep examples inside the parent concept's description or as a brief subtopic under their parent concept (e.g., under "API Middleware" or "Message-Oriented Middleware").
- If a passage contains ONLY a cover slide, title slide, table of contents, administrative info, or exercise/review questions with no teachable explanation, return an empty "concepts" array [].

Return JSON only.
"""

        relationships = {}

        for index, chunk in enumerate(chunks, 1):
            result = self.llm.generate_json(
                instructions=instructions + (
                    f"\nThis is passage {index} of {len(chunks)}."
                ),
                input_text=chunk["text"],
                schema_name="concept_inventory",
                schema=schema,
                task="concept_extraction",
            )

            for concept in result.get("concepts", []):
                name = " ".join(str(concept.get("name", "")).split()).strip()
                if not name or self._is_noise_heading(name):
                    continue

                raw_desc = " ".join(str(concept.get("description", "")).split()).strip()
                if self._is_question_text(raw_desc):
                    raw_desc = ""

                key = self._normalize_name(name)
                if not key:
                    continue

                concept_sources = self._resolve_chunk_sources(
                    concept.get("sources"), chunk
                )

                if key not in collected:
                    collected[key] = {
                        "id": self._id(key),
                        "name": name,
                        "description": raw_desc,
                        "sources": [],
                        "subtopics": {},
                    }

                item = collected[key]
                item["name"] = self._prefer_name(item["name"], name)
                item["description"] = self._merge_description(item["description"], raw_desc)
                for src in concept_sources:
                    self._merge_sources(item["sources"], src)

                for sub in concept.get("subtopics", []):
                    sub_name = " ".join(str(sub.get("name", "")).split()).strip()
                    if not sub_name or self._is_noise_heading(sub_name):
                        continue

                    sub_key = self._normalize_name(sub_name)
                    if not sub_key or sub_key == key:
                        continue

                    sub_desc = " ".join(str(sub.get("description", "")).split()).strip()
                    if self._is_question_text(sub_desc):
                        continue

                    subtopics_map = item["subtopics"]
                    if sub_key not in subtopics_map:
                        subtopics_map[sub_key] = {
                            "id": self._id(f"{key}::{sub_key}"),
                            "name": sub_name,
                            "description": sub_desc,
                            "sources": []
                        }
                    else:
                        subtopics_map[sub_key]["name"] = self._prefer_name(
                            subtopics_map[sub_key]["name"], sub_name
                        )
                        subtopics_map[sub_key]["description"] = self._merge_description(
                            subtopics_map[sub_key]["description"], sub_desc
                        )

                    for src in concept_sources:
                        self._merge_sources(subtopics_map[sub_key]["sources"], src)

            for rel in result.get("relationships", []):
                source_name = " ".join(str(rel.get("source", "")).split()).strip()
                target_name = " ".join(str(rel.get("target", "")).split()).strip()
                relation = " ".join(str(rel.get("relationship", "")).split()).strip()
                if (
                    source_name and target_name and relation
                    and not self._is_noise_heading(source_name)
                    and not self._is_noise_heading(target_name)
                ):
                    rel_key = (
                        self._normalize_name(source_name),
                        self._normalize_name(target_name),
                        relation.casefold()
                    )
                    relationships[rel_key] = {
                        "source": source_name,
                        "target": target_name,
                        "relationship": relation
                    }

        final_concepts = []
        for item in collected.values():
            final_concepts.append({
                "id": item["id"],
                "name": item["name"],
                "description": item["description"],
                "sources": item["sources"],
                "subtopics": list(item["subtopics"].values())
            })

        return {
            "concepts": final_concepts,
            "relationships": list(relationships.values()),
            "source_chunk_count": len(chunks),
            "source_page_count": len(self.split_pages(text))
        }

    def search_material(self, text, query, limit=10):
        terms = {
            x.casefold()
            for x in re.findall(r"[A-Za-z0-9]+", query or "")
            if len(x) > 1
        }
        if not terms:
            return []

        matches = []
        for page in self.split_pages(text):
            body = page["text"]
            words = {x.casefold() for x in re.findall(r"[A-Za-z0-9]+", body)}
            score = sum(term in words for term in terms)
            if score:
                matches.append({
                    "file": page["file"],
                    "pages": [page["page"]],
                    "score": score,
                    "excerpt": body[:1600]
                })

        matches.sort(key=lambda x: x["score"], reverse=True)
        return matches[:limit]

    def assess_concept(self, query, excerpts):
        if not excerpts:
            return {
                "status": "unsupported",
                "explanation": "No matching passage was found in the uploaded PDFs.",
                "sources": []
            }

        source_text = "\n\n".join(
            f"FILE: {item['file']} | PAGES: {item['pages']}\n{item['excerpt']}"
            for item in excerpts
        )

        schema = {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["adequate", "partial", "unsupported"]
                },
                "explanation": {"type": "string"},
                "covered_aspects": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "missing_aspects": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": [
                "status", "explanation", "covered_aspects", "missing_aspects"
            ]
        }

        result = self.llm.generate_json(
            instructions="""
Assess whether the supplied passages adequately teach the requested concept.
Use ONLY the passages. A keyword occurrence alone is not sufficient.
adequate = concept is substantively explained with enough detail.
partial = concept is mentioned or only partly explained.
unsupported = passages do not meaningfully explain it.
Do not use external knowledge. Return JSON only.
""",
            input_text=f"TEACHER-ADDED CONCEPT: {query}\n\nPASSAGES:\n{source_text}",
            schema_name="concept_evidence_assessment",
            schema=schema,
            task="concept_assessment",
        )

        result["sources"] = [
            {"file": item["file"], "pages": item["pages"]}
            for item in excerpts
        ]
        return result
