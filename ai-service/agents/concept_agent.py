from services.llm_service import LLMService


class ConceptAgent:

    def __init__(self):

        self.llm = LLMService()


    def extract_concepts(self, text):

        instructions = """

You are Agent 1 of an academic examination system.

Your job is to analyze academic study material and
identify important concepts and relationships between
those concepts.

Rules:

1. Only use information present in the supplied material.

2. Identify meaningful academic concepts.

3. Avoid trivial words.

4. Avoid duplicate concepts.

5. Identify meaningful relationships between concepts.

6. Every relationship must be supported by the material.

7. Keep concept names concise.

8. Provide a short description for every concept.

9. Return only the requested JSON structure.

"""


        schema = {

            "type": "object",

            "properties": {

                "concepts": {

                    "type": "array",

                    "items": {

                        "type": "object",

                        "properties": {

                            "name": {
                                "type": "string"
                            },

                            "description": {
                                "type": "string"
                            }

                        },

                        "required": [
                            "name",
                            "description"
                        ]

                    }

                },

                "relationships": {

                    "type": "array",

                    "items": {

                        "type": "object",

                        "properties": {

                            "source": {
                                "type": "string"
                            },

                            "target": {
                                "type": "string"
                            },

                            "relationship": {
                                "type": "string"
                            }

                        },

                        "required": [
                            "source",
                            "target",
                            "relationship"
                        ]

                    }

                }

            },

            "required": [
                "concepts",
                "relationships"
            ]

        }


        return self.llm.generate_json(

            instructions=instructions,

            input_text=text,

            schema_name="concept_graph",

            schema=schema

        )