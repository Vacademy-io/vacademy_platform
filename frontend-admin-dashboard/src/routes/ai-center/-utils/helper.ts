import { AIAssessmentCompleteQuestion } from '@/types/ai/generate-assessment/generate-complete-assessment';
import { MyQuestion } from '@/types/assessments/question-paper-form';
import { FilePdf } from '@phosphor-icons/react';
import { FileAudio, FileDoc } from '@phosphor-icons/react';

export const transformQuestionsToGenerateAssessmentAI = (
    data: AIAssessmentCompleteQuestion[] | undefined
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
            numericType = JSON.parse(item.options_json)?.numeric_type || '';
        }
        if (item.auto_evaluation_json) {
            if (item.question_type === 'ONE_WORD') {
                subjectiveAnswerText = JSON.parse(item.auto_evaluation_json)?.data?.answer;
            } else if (item.question_type === 'LONG_ANSWER') {
                subjectiveAnswerText = JSON.parse(item.auto_evaluation_json)?.data?.answer?.content;
            }
        }
        const baseQuestion: MyQuestion = {
            id: item.id || '',
            questionId: item.id || item.preview_id || undefined,
            questionName: convertSVGsToBase64(item.text?.content) || '',
            explanation: convertSVGsToBase64(item.explanation_text?.content) || '',
            questionType: item.question_type,
            questionMark: '0',
            questionPenalty: '0',
            tags: item.tags || [],
            level: item.level || '',
            questionDuration: {
                hrs: String(Math.floor((item.default_question_time_mins ?? 0) / 60)), // Extract hours
                min: String((item.default_question_time_mins ?? 0) % 60), // Extract remaining minutes
            },
            singleChoiceOptions: Array(4).fill({
                id: '',
                name: '',
                isSelected: false,
            }),
            multipleChoiceOptions: Array(4).fill({
                id: '',
                name: '',
                isSelected: false,
            }),
            csingleChoiceOptions: Array(4).fill({
                id: '',
                name: '',
                isSelected: false,
            }),
            cmultipleChoiceOptions: Array(4).fill({
                id: '',
                name: '',
                isSelected: false,
            }),
            trueFalseOptions: Array(2).fill({
                id: '',
                name: '',
                isSelected: false,
            }),
            validAnswers: [],
            decimals,
            numericType,
            parentRichTextContent: item.parent_rich_text?.content || null,
            subjectiveAnswerText,
        };

        if (item.question_type === 'MCQS') {
            baseQuestion.singleChoiceOptions = item.options.map((option) => ({
                name: convertSVGsToBase64(option.text?.content) || '',
                isSelected: correctOptionIds.includes(option.id || option.preview_id),
            }));
        } else if (item.question_type === 'MCQM') {
            baseQuestion.multipleChoiceOptions = item.options.map((option) => ({
                name: convertSVGsToBase64(option.text?.content) || '',
                isSelected: correctOptionIds.includes(option.id || option.preview_id),
            }));
        } else if (item.question_type === 'CMCQM') {
            baseQuestion.cmultipleChoiceOptions = item.options.map((option) => ({
                id: option.id ? option.id : '',
                name: convertSVGsToBase64(option.text?.content) || '',
                isSelected: correctOptionIds.includes(option.id || option.preview_id),
            }));
        } else if (item.question_type === 'TRUE_FALSE') {
            baseQuestion.trueFalseOptions = item.options.map((option) => ({
                id: option.id ? option.id : '',
                name: convertSVGsToBase64(option.text?.content) || '',
                isSelected: correctOptionIds.includes(option.id || option.preview_id),
            }));
        } else if (item.question_type === 'NUMERIC') {
            baseQuestion.validAnswers = validAnswers;
        }
        return baseQuestion;
    });
};

export function convertSVGsToBase64(htmlString: string) {
    if (!htmlString) return '';

    console.log('🔄 convertSVGsToBase64 INPUT:', htmlString.substring(0, 100) + '...');

    let processedString = htmlString;

    // 1. Replace known typo/bad chars variants
    processedString = processedString
        .replace(/‹/g, '<')
        .replace(/›/g, '>')
        .replace(/xmIns/g, 'xmlns');

    // 2. Recursive Unescape (up to 3 levels)
    const txt = document.createElement('textarea');
    let levels = 0;
    while (levels < 3) {
        const prev = processedString;
        if (!prev.includes('&')) break;
        txt.innerHTML = prev;
        processedString = txt.value;
        if (processedString === prev) break;
        levels++;
    }

    // 2.5 Convert raw LaTeX delimiters to TipTap HTML format
    // Block math $$...$$
    processedString = processedString.replace(
        /\$\$([^$]+)\$\$/g,
        (_, tex) => `<div class="math-block" data-latex="${tex.replace(/"/g, '&quot;')}"></div>`
    );
    // Inline math $...$
    processedString = processedString.replace(
        /\$([^$]+)\$/g,
        (_, tex) => `<span class="math-inline" data-latex="${tex.replace(/"/g, '&quot;')}"></span>`
    );

    const parser = new DOMParser();
    const doc = parser.parseFromString(processedString, 'text/html');

    // 3. UNCONDITIONALLY CLEAN ALL .math-inline elements
    // This is the nuclear fix - clear any inner content and keep only data-latex attribute
    const mathInlineElements = doc.querySelectorAll('.math-inline');
    mathInlineElements.forEach((el) => {
        const latex = el.getAttribute('data-latex') || '';
        console.log('🧹 Cleaning .math-inline element, latex:', latex);

        // Completely wipe inner content
        el.innerHTML = '';

        // If latex is empty, just leave a space as placeholder
        // If latex exists, set it as text (will be rendered by TipTap's math node)
        el.textContent = latex || '';
    });

    // 4. Convert SVGs to base64 images
    const svgElements = doc.querySelectorAll('svg');
    svgElements.forEach((svg) => {
        const svgClone = svg.cloneNode(true);
        const svgString = new XMLSerializer().serializeToString(svgClone);
        const base64 = btoa(unescape(encodeURIComponent(svgString)));
        const dataUrl = `data:image/svg+xml;base64,${base64}`;
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = 'Converted SVG';
        svg.replaceWith(img);
    });

    const result = doc.body.innerHTML;
    console.log('🔄 convertSVGsToBase64 OUTPUT:', result.substring(0, 100) + '...');
    return result;
}

export function getPerformanceLabel(score: number): string {
    if (score < 40) return 'Needs Improvement';
    if (score >= 40 && score < 60) return 'Average';
    if (score >= 60 && score < 80) return 'Good';
    return 'Excellent'; // score >= 80
}

export function getPerformanceColor(score: number): string {
    if (score < 40) return 'text-destructive text-sm'; // or "text-danger-500" if using custom
    if (score >= 40 && score < 60) return 'text-warning-500 text-sm';
    if (score > 60 && score <= 80) return 'text-success-500 text-sm';
    return 'text-success-500 text-sm'; // for score > 80
}

export function getScoreFromString(input: string): number {
    const scores: Record<string, number> = {
        'Delivery & Presentation': 20,
        'Content Quality': 20,
        'Student Engagement': 15,
        'Assessment & Feedback': 10,
        'Inclusivity & Language': 10,
        'Classroom Management': 10,
        'Teaching Aids': 10,
        Professionalism: 5,
    };

    return scores[input.trim()] ?? 0;
}

export const AIFormatDate = (dateString: string): string => {
    try {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true, // Common preference, can be set to false
        });
    } catch (error) {
        console.error('Error formatting date:', dateString, error);
        return 'Invalid Date';
    }
};

export function getAIIconByMimeType(mimeType: string) {
    const lowerMime = mimeType.toLowerCase();

    if (lowerMime.includes('pdf')) {
        return FilePdf;
    }

    if (
        lowerMime.includes('wav') || // audio/wav
        lowerMime.includes('flac') || // audio/flac
        lowerMime.includes('aac') || // audio/aac
        lowerMime.includes('m4a') || // audio/m4a
        lowerMime.includes('mpeg') || // audio/mpeg
        lowerMime.includes('mp3') || // audio/mp3 (non-standard but seen in some systems)
        lowerMime.includes('audio') || // generic audio/*
        lowerMime.includes('x-mpeg') || // audio/x-mpeg
        lowerMime.includes('x-mp3') || // audio/x-mp3
        lowerMime.includes('mpeg3') || // audio/mpeg3 (rare but used)
        lowerMime.includes('mpga') || // audio/mpga
        lowerMime.includes('x-mpg') || // audio/x-mpg
        lowerMime.includes('x-mpeg3') || // audio/x-mpeg3
        lowerMime.includes('mp3audio') || // custom or non-standard
        lowerMime.includes('x-mpegaudio') // audio/x-mpegaudio (non-standard)
    ) {
        return FileAudio;
    }
    // Default to document icon for other types
    return FileDoc;
}

export const getRandomTaskName = () => {
    const now = new Date();
    const formattedDate = now.toLocaleString().replace(', ', '_');
    return `Task_${formattedDate}`;
};
