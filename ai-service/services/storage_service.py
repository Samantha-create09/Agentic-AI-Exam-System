
import json
import os
import tempfile
import threading
import uuid
from datetime import datetime, timezone


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
STORE_FILE = os.path.join(DATA_DIR, "generation_store.json")


class StorageService:
    """Single-process development storage. Migrate to PostgreSQL before production."""

    def __init__(self, store_file=STORE_FILE):
        self.store_file = store_file
        self.lock = threading.RLock()
        os.makedirs(os.path.dirname(store_file), exist_ok=True)
        if not os.path.exists(store_file):
            self._write({"generations": {}})

    @staticmethod
    def now():
        return datetime.now(timezone.utc).isoformat()

    def _read(self):
        if not os.path.exists(self.store_file):
            return {"generations": {}}
        try:
            with open(self.store_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            data.setdefault("generations", {})
            return data
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(
                "Generation storage is unreadable. Back up the file before repair."
            ) from exc

    def _write(self, data):
        folder = os.path.dirname(self.store_file)
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                "w", encoding="utf-8", dir=folder,
                delete=False, suffix=".tmp"
            ) as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
                temp_path = f.name
            os.replace(temp_path, self.store_file)
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

    def create_generation(self, record):
        generation_id = str(uuid.uuid4())
        with self.lock:
            data = self._read()
            record = {
                **record,
                "generation_id": generation_id,
                "created_at": self.now(),
                "updated_at": self.now(),
                "individual_retry_total": 0,
                "individual_retry_counts": {},
                "paper_retry_count": 0,
                "status": "material_analyzed",
            }
            data["generations"][generation_id] = record
            self._write(data)
        return record

    def get_generation(self, generation_id):
        with self.lock:
            return self._read()["generations"].get(generation_id)

    def find_cached_analysis(self, content_hash):
        if not content_hash:
            return None
        with self.lock:
            generations = self._read()["generations"].values()
            matches = [
                record for record in generations
                if record.get("content_hash") == content_hash
                and record.get("extracted_text")
                and isinstance(record.get("concept_graph"), dict)
                and "concepts" in record["concept_graph"]
            ]
            if not matches:
                return None
            matches.sort(key=lambda r: r.get("updated_at", ""), reverse=True)
            return matches[0]

    def update_generation(self, generation_id, updates):
        with self.lock:
            data = self._read()
            record = data["generations"].get(generation_id)
            if record is None:
                return None
            record.update(updates)
            record["updated_at"] = self.now()
            self._write(data)
            return record

    def reserve_question_retry(self, generation_id, question_id):
        with self.lock:
            data = self._read()
            record = data["generations"].get(generation_id)
            if not record:
                raise KeyError("Generation not found.")

            counts = record.setdefault("individual_retry_counts", {})
            per_question = int(counts.get(question_id, 0))
            total = int(record.get("individual_retry_total", 0))

            if per_question >= 2:
                raise ValueError("This question has reached its 2-retry limit.")
            if total >= 10:
                raise ValueError("This paper has reached its 10 individual-retry limit.")

            counts[question_id] = per_question + 1
            record["individual_retry_total"] = total + 1
            record["updated_at"] = self.now()
            self._write(data)

            return {
                "question_retry_count": per_question + 1,
                "question_retries_remaining": 1 - per_question,
                "paper_individual_retry_count": total + 1,
                "paper_individual_retries_remaining": 9 - total,
            }

    def release_question_retry(self, generation_id, question_id):
        with self.lock:
            data = self._read()
            record = data["generations"].get(generation_id)
            if not record:
                return None

            counts = record.setdefault("individual_retry_counts", {})
            per_question = int(counts.get(question_id, 0))
            if per_question > 0:
                counts[question_id] = per_question - 1

            total = int(record.get("individual_retry_total", 0))
            if total > 0:
                record["individual_retry_total"] = total - 1

            record["updated_at"] = self.now()
            self._write(data)
            return record

    def reserve_paper_retry(self, generation_id):
        with self.lock:
            data = self._read()
            record = data["generations"].get(generation_id)
            if not record:
                raise KeyError("Generation not found.")
            if int(record.get("paper_retry_count", 0)) >= 1:
                raise ValueError("The paper has already used its one full-paper retry.")

            record["paper_retry_count"] = 1
            record["updated_at"] = self.now()
            self._write(data)
            return {"paper_retry_count": 1, "paper_retries_remaining": 0}

    def release_paper_retry(self, generation_id):
        with self.lock:
            data = self._read()
            record = data["generations"].get(generation_id)
            if not record:
                return None

            current = int(record.get("paper_retry_count", 0))
            if current > 0:
                record["paper_retry_count"] = current - 1
            record["updated_at"] = self.now()
            self._write(data)
            return record


storage_service = StorageService()
