import { AIAssessmentCompleteQuestion } from "@/types/ai/generate-assessment/generate-complete-assessment";
import { MyQuestion } from "@/types/assessments/question-paper-form";

export const transformQuestionsToGenerateAssessmentAI = (
    data: AIAssessmentCompleteQuestion[] | undefined,
) => {
    return data?.map((item) => {
        const correctOptionIds =
            JSON.parse(item.auto_evaluation_json)?.data?.correctOptionIds || [];
        const validAnswers = JSON.parse(item.auto_evaluation_json)?.data?.validAnswers || [];
        let decimals;
        let numericType;
        let subjectiveAnswerText;
        if (item.options_json) {
            decimals = JSON.parse(item.options_json)?.decimals || 0;
            numericType = JSON.parse(item.options_json)?.numeric_type || "";
        }
        if (item.auto_evaluation_json) {
            if (item.question_type === "ONE_WORD") {
                subjectiveAnswerText = JSON.parse(item.auto_evaluation_json)?.data?.answer;
            } else if (item.question_type === "LONG_ANSWER") {
                subjectiveAnswerText = JSON.parse(item.auto_evaluation_json)?.data?.answer?.content;
            }
        }
        const baseQuestion: MyQuestion = {
            id: item.id || "",
            questionId: item.id || item.preview_id || undefined,
            questionName: convertSVGsToBase64(item.text?.content) || "",
            explanation: convertSVGsToBase64(item.explanation_text?.content) || "",
            questionType: item.question_type,
            questionMark: "0",
            questionPenalty: "0",
            tags: item.tags || [],
            level: item.level || "",
            questionDuration: {
                hrs: String(Math.floor((item.default_question_time_mins ?? 0) / 60)), // Extract hours
                min: String((item.default_question_time_mins ?? 0) % 60), // Extract remaining minutes
            },
            singleChoiceOptions: Array(4).fill({
                id: "",
                name: "",
                isSelected: false,
            }),
            multipleChoiceOptions: Array(4).fill({
                id: "",
                name: "",
                isSelected: false,
            }),
            csingleChoiceOptions: Array(4).fill({
                id: "",
                name: "",
                isSelected: false,
            }),
            cmultipleChoiceOptions: Array(4).fill({
                id: "",
                name: "",
                isSelected: false,
            }),
            trueFalseOptions: Array(2).fill({
                id: "",
                name: "",
                isSelected: false,
            }),
            validAnswers: [],
            decimals,
            numericType,
            parentRichTextContent: item.parent_rich_text?.content || null,
            subjectiveAnswerText,
        };

        if (item.question_type === "MCQS") {
            baseQuestion.singleChoiceOptions = item.options.map((option) => ({
                name: convertSVGsToBase64(option.text?.content) || "",
                isSelected: correctOptionIds.includes(option.id || option.preview_id),
            }));
        } else if (item.question_type === "MCQM") {
            baseQuestion.multipleChoiceOptions = item.options.map((option) => ({
                name: convertSVGsToBase64(option.text?.content) || "",
                isSelected: correctOptionIds.includes(option.id || option.preview_id),
            }));
        } else if (item.question_type === "CMCQM") {
            baseQuestion.cmultipleChoiceOptions = item.options.map((option) => ({
                id: option.id ? option.id : "",
                name: convertSVGsToBase64(option.text?.content) || "",
                isSelected: correctOptionIds.includes(option.id || option.preview_id),
            }));
        } else if (item.question_type === "TRUE_FALSE") {
            baseQuestion.trueFalseOptions = item.options.map((option) => ({
                id: option.id ? option.id : "",
                name: convertSVGsToBase64(option.text?.content) || "",
                isSelected: correctOptionIds.includes(option.id || option.preview_id),
            }));
        } else if (item.question_type === "NUMERIC") {
            baseQuestion.validAnswers = validAnswers;
        }
        return baseQuestion;
    });
};

export function convertSVGsToBase64(htmlString: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");

    const svgElements = doc.querySelectorAll("svg");

    svgElements.forEach((svg) => {
        const svgClone = svg.cloneNode(true);

        // Serialize the SVG element to a string
        const svgString = new XMLSerializer().serializeToString(svgClone);

        // Encode as Base64
        const base64 = btoa(unescape(encodeURIComponent(svgString)));
        const dataUrl = `data:image/svg+xml;base64,${base64}`;

        // Create an <img> element with the data URL
        const img = document.createElement("img");
        img.src = dataUrl;
        img.alt = "Converted SVG";

        // Replace the <svg> element with the <img> tag
        svg.replaceWith(img);
    });

    return doc.body.innerHTML;
}

export function getPerformanceLabel(score: number): string {
    if (score < 40) return "Needs Improvement";
    if (score >= 40 && score < 60) return "Average";
    if (score >= 60 && score < 80) return "Good";
    return "Excellent"; // score >= 80
}

export function getPerformanceColor(score: number): string {
    if (score < 40) return "text-destructive text-sm"; // or "text-danger-500" if using custom
    if (score >= 40 && score < 60) return "text-warning-500 text-sm";
    if (score > 60 && score <= 80) return "text-success-500 text-sm";
    return "text-success-500 text-sm"; // for score > 80
}

export function getScoreFromString(input: string): number {
    const scores: Record<string, number> = {
        "Delivery & Presentation": 20,
        "Content Quality": 20,
        "Student Engagement": 15,
        "Assessment & Feedback": 10,
        "Inclusivity & Language": 10,
        "Classroom Management": 10,
        "Teaching Aids": 10,
        Professionalism: 5,
    };

    return scores[input.trim()] ?? 0;
}
