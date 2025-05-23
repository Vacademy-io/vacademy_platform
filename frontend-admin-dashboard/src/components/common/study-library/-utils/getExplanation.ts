import { InstituteType } from "@/schemas/student/student-list/institute-schema";

export interface ExplanationType {
    course: string;
    courseExamples: string;
    session: string;
    sessionExamples: string;
    level: string;
    levelExamples: string;
}

export default function getExplanation(type?: InstituteType): ExplanationType {
    let courseExamples = "";
    let sessionExamples = "";
    let levelExamples = "";

    switch (type) {
        case "Coaching Institute": {
            courseExamples =
                "For eg. JEE Advanced Preparation, NEET Crash Course, CAT Quantitative Aptitude";
            sessionExamples = "For eg. 2025 - 2026, Jun 2026 - Nov2026";
            levelExamples = "For eg. Basic, Advanced";
            break;
        }
        case "School": {
            courseExamples = "For eg. NCERT, CBSE, ICSE";
            sessionExamples = "For eg. 2025 - 2026, Jun 2026 - Nov2026";
            levelExamples = "For eg. 10th standard, 9th standard, 8th standard";
            break;
        }
        case "University": {
            courseExamples =
                "For eg. Software Engineering Fundamentals, Business Management Principles";
            sessionExamples = "For eg. 2025 - 2026, Jun 2026 - Nov2026";
            levelExamples = "For eg. 1st year, 2nd year, 3rd year";
            break;
        }
        case "Corporate": {
            courseExamples =
                "For eg. Leadership & Management Training, Advanced Excel for Business Analytics";
            sessionExamples = "For eg. 2025 - 2026, Jun 2026 - Nov2026";
            levelExamples = "For eg. Beginner, Intermediate, Advanced, Expert";
            break;
        }
        default: {
            courseExamples = "";
            sessionExamples = "";
            levelExamples = "";
            break;
        }
    }

    return {
        course: "A Course is the main learning program that covers a subject or skill. It may consist of different Levels to structure learning progressively.",
        courseExamples,
        session:
            "A Session refers to a specific time frame during which a level is conducted within the course. It defines the duration and schedule of learning, ensuring students progress systematically.",
        sessionExamples,
        level: "Levels organize a course into structured learning stages. These stages may represent increasing difficulty, different modules, or key milestones within the course.",
        levelExamples,
    };
}
