from collections import Counter


class BalanceAgent:

    def check_balance(
        self,
        questions,
        expected_bloom_distribution,
        expected_type_distribution
    ):

        issues = []


        # ====================================================
        # BLOOM LEVEL COUNT
        # ====================================================

        actual_bloom = Counter(
            question.get("bloomLevel")
            for question in questions
        )


        for level, expected_count in (
            expected_bloom_distribution.items()
        ):

            actual_count = (
                actual_bloom.get(
                    level,
                    0
                )
            )

            if actual_count != expected_count:

                issues.append({

                    "category":
                        "Bloom",

                    "level":
                        level,

                    "expected":
                        expected_count,

                    "actual":
                        actual_count
                })


        # ====================================================
        # QUESTION TYPE COUNT
        # ====================================================

        actual_types = Counter(
            question.get("type")
            for question in questions
        )


        for question_type, expected_count in (
            expected_type_distribution.items()
        ):

            actual_count = (
                actual_types.get(
                    question_type,
                    0
                )
            )

            if actual_count != expected_count:

                issues.append({

                    "category":
                        "Question Type",

                    "type":
                        question_type,

                    "expected":
                        expected_count,

                    "actual":
                        actual_count
                })


        # ====================================================
        # TOTAL
        # ====================================================

        expected_total = sum(
            expected_bloom_distribution.values()
        )

        actual_total = len(
            questions
        )


        if actual_total != expected_total:

            issues.append({

                "category":
                    "Total",

                "expected":
                    expected_total,

                "actual":
                    actual_total
            })


        # ====================================================
        # RESULT
        # ====================================================

        return {

            "valid":
                len(issues) == 0,

            "actualBloomDistribution":
                dict(actual_bloom),

            "expectedBloomDistribution":
                expected_bloom_distribution,

            "actualTypeDistribution":
                dict(actual_types),

            "expectedTypeDistribution":
                expected_type_distribution,

            "actualTotal":
                actual_total,

            "expectedTotal":
                expected_total,

            "issues":
                issues
        }