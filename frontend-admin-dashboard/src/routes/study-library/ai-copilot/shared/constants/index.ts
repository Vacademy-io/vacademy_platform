import { QuizQuestion } from '../types';

export const DEFAULT_QUIZ_QUESTIONS: QuizQuestion[] = [
    {
        question: 'What is the primary purpose of machine learning?',
        options: [
            'To create databases',
            'To enable computers to learn from data',
            'To design user interfaces',
            'To manage network security',
        ],
        correctAnswerIndex: 1,
    },
    {
        question: 'Which ensemble method combines multiple weak learners sequentially?',
        options: ['Bagging', 'Boosting', 'Stacking', 'Random Forest'],
        correctAnswerIndex: 1,
    },
    {
        question: 'What does PCA stand for in dimensionality reduction?',
        options: [
            'Principal Component Analysis',
            'Primary Correlation Assessment',
            'Progressive Component Algorithm',
            'Practical Classification Approach',
        ],
        correctAnswerIndex: 0,
    },
];

export const DEFAULT_SELECTED_ANSWERS: Record<number, string> = DEFAULT_QUIZ_QUESTIONS.reduce(
    (acc, question, index) => {
        if (question.correctAnswerIndex !== undefined) {
            acc[index] = question.correctAnswerIndex.toString();
        }
        return acc;
    },
    {} as Record<number, string>
);

export const DEFAULT_SOLUTION_CODE = `// Sample solution implementation
function solveHomeworkProblem(input) {
    // Replace this with the real solution logic
    const processed = input.map((value) => value * 2);
    return processed;
}

const sampleInput = [1, 2, 3, 4];
const output = solveHomeworkProblem(sampleInput);

console.log('Input:', sampleInput);
console.log('Output:', output);`;
