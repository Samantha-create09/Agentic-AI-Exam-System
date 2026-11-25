
from collections import Counter


class BalanceAgent:

    def check_balance(
        self,
        questions,
        expected_bloom_distribution,
        expected_type_distribution=None
    ):
        actual_bloom = Counter(
            question.get("bloomLevel")
            for question in questions
        )

        actual_types = Counter(
            question.get("type")
            for question in questions
        )

        issues = []

        # Check every Bloom level
        for level, expected in expected_bloom_distribution.items():
            actual = actual_bloom.get(level, 0)

            if actual != expected:
                issues.append({
                    "category": "Bloom",
                    "name": level,
                    "expected": expected,
                    "actual": actual
                })

        # Check every question type
        if expected_type_distribution is not None:
            for question_type, expected in expected_type_distribution.items():
                actual = actual_types.get(question_type, 0)

                if actual != expected:
                    issues.append({
                        "category": "Question Type",
                        "name": question_type,
                        "expected": expected,
                        "actual": actual
                    })

        expected_total = sum(expected_bloom_distribution.values())
        actual_total = len(questions)

        if actual_total != expected_total:
            issues.append({
                "category": "Total",
                "name": "Questions",
                "expected": expected_total,
                "actual": actual_total
            })

        return {
            "valid": len(issues) == 0,
            "actualTotal": actual_total,
            "expectedTotal": expected_total,
            "actualBloomDistribution": dict(actual_bloom),
            "expectedBloomDistribution": expected_bloom_distribution,
            "actualTypeDistribution": dict(actual_types),
            "expectedTypeDistribution": expected_type_distribution,
            "issues": issues
        }
