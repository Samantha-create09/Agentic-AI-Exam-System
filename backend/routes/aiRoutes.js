const express = require("express");
const axios = require("axios");
const FormData = require("form-data");

const router = express.Router();


const AI_SERVICE_URL =
    "http://localhost:8000";


router.post(
    "/generate-questions",
    async (req, res) => {

        try {

            const {
                filePath,
                mcqCount,
                trueFalseCount,
                fillBlankCount,
                shortAnswerCount,
                difficulty
            } = req.body;


            const response =
                await axios.post(

                    `${AI_SERVICE_URL}/api/generate-questions`,

                    null,

                    {
                        params: {

                            mcq_count:
                                mcqCount,

                            true_false_count:
                                trueFalseCount,

                            fill_blank_count:
                                fillBlankCount,

                            short_answer_count:
                                shortAnswerCount,

                            difficulty:
                                difficulty || "Medium"
                        }
                    }
                );


            res.json(
                response.data
            );


        } catch (error) {

            console.error(
                error.response?.data ||
                error.message
            );


            res.status(500).json({

                message:
                    "AI question generation failed.",

                error:
                    error.response?.data ||
                    error.message
            });

        }

    }
);


module.exports = router;