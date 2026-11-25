
import re
import uuid
from services.llm_service import LLMService


class ConceptAgent:
    CHUNK_SIZE = 16000

    def __init__(self):
        self.llm = LLMService()

    @staticmethod
    def _id(value):
        return str(uuid.uuid5(uuid.NAMESPACE_URL, str(value).casefold()))

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
        chunks = []
        for page in self.split_pages(text):
            body = page["text"]
            for start in range(0, len(body), self.CHUNK_SIZE):
                part = body[start:start + self.CHUNK_SIZE].strip()
                if part:
                    chunks.append({
                        "file": page["file"],
                        "pages": [page["page"]],
                        "text": part
                    })
        return chunks

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
You are Agent 1. Analyse ONLY the supplied study-material passage.
Extract important concepts and meaningful subtopics.
Descriptions must be supported by the passage.
Do not use outside knowledge or invent missing information.
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
                schema=schema
            )

            source = {"file": chunk["file"], "pages": chunk["pages"]}

            for concept in result.get("concepts", []):
                name = str(concept.get("name", "")).strip()
                if not name:
                    continue
                key = name.casefold()

                if key not in collected:
                    collected[key] = {
                        "id": self._id(key),
                        "name": name,
                        "description": concept.get("description", ""),
                        "sources": [],
                        "subtopics": []
                    }

                item = collected[key]
                if source not in item["sources"]:
                    item["sources"].append(source)

                for sub in concept.get("subtopics", []):
                    sub_name = str(sub.get("name", "")).strip()
                    if not sub_name:
                        continue
                    sub_key = sub_name.casefold()
                    existing = next(
                        (x for x in item["subtopics"]
                         if x["name"].casefold() == sub_key),
                        None
                    )
                    if existing is None:
                        item["subtopics"].append({
                            "id": self._id(key + "::" + sub_key),
                            "name": sub_name,
                            "description": sub.get("description", ""),
                            "sources": [source]
                        })
                    elif source not in existing["sources"]:
                        existing["sources"].append(source)

            for rel in result.get("relationships", []):
                source_name = str(rel.get("source", "")).strip()
                target_name = str(rel.get("target", "")).strip()
                relation = str(rel.get("relationship", "")).strip()
                if source_name and target_name and relation:
                    key = (source_name.casefold(), target_name.casefold(), relation.casefold())
                    relationships[key] = {
                        "source": source_name,
                        "target": target_name,
                        "relationship": relation
                    }

        return {
            "concepts": list(collected.values()),
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
            schema=schema
        )

        result["sources"] = [
            {"file": item["file"], "pages": item["pages"]}
            for item in excerpts
        ]
        return result
