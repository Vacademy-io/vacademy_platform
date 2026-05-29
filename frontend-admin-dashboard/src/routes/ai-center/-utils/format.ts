import { AITaskIndividualListInterface } from '@/types/ai/generate-assessment/generate-complete-assessment';

export type FileFamily = 'pdf' | 'audio' | 'image' | 'doc' | 'none';

export const stripExtension = (name: string): string => {
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(0, i) : name;
};

export const classifyFile = (mime: string | undefined): FileFamily => {
    if (!mime) return 'none';
    const m = mime.toLowerCase();
    if (m.includes('pdf')) return 'pdf';
    if (
        m.startsWith('audio') ||
        m.includes('mp3') ||
        m.includes('wav') ||
        m.includes('flac') ||
        m.includes('aac') ||
        m.includes('m4a') ||
        m.includes('mpeg')
    )
        return 'audio';
    if (m.startsWith('image')) return 'image';
    if (
        m.includes('word') ||
        m.includes('document') ||
        m.includes('presentation') ||
        m.includes('ppt')
    )
        return 'doc';
    return 'doc';
};

export const sourceLabel: Record<FileFamily, string> = {
    pdf: 'From a PDF',
    audio: 'From audio',
    image: 'From a photo',
    doc: 'From a document',
    none: 'From a topic',
};

export const routeForFamily: Record<FileFamily, string> = {
    pdf: '/ai-center/ai-tools/vsmart-upload',
    audio: '/ai-center/ai-tools/vsmart-audio',
    image: '/ai-center/ai-tools/vsmart-image',
    doc: '/ai-center/ai-tools/vsmart-upload',
    none: '/ai-center/ai-tools/vsmart-prompt',
};

// The server stores the human title inside the generated `result_json` payload
// (e.g. "Respiration in Organisms - Class 10"), not on the task row itself. Prefer
// it over the auto-generated `Task_<timestamp>` name when present.
const titleFromResultJson = (raw: unknown): string | null => {
    if (typeof raw !== 'string' || !raw) return null;
    try {
        const parsed = JSON.parse(raw) as { title?: unknown };
        if (typeof parsed.title === 'string') {
            const trimmed = parsed.title.trim();
            if (trimmed) return trimmed;
        }
    } catch {
        // result_json may be empty, partial, or non-JSON for in-progress/failed tasks
    }
    return null;
};

export const taskDisplayName = (
    task: AITaskIndividualListInterface,
    fallback = 'Untitled draft'
): string => {
    const generatedTitle = titleFromResultJson(task.result_json);
    if (generatedTitle) return generatedTitle;
    if (task.file_detail?.file_name) return stripExtension(task.file_detail.file_name);
    if (task.task_name && !/^Task_\d/.test(task.task_name)) return task.task_name;
    return fallback;
};

export const relativeTime = (iso: string): string => {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const diff = Math.round((Date.now() - t) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} d ago`;
    return new Date(iso).toLocaleDateString();
};

export const statusStyles = (status: string): string => {
    if (status === 'COMPLETED') return 'bg-green-50 text-green-700 ring-green-600/20';
    if (status === 'FAILED') return 'bg-red-50 text-red-700 ring-red-600/20';
    return 'bg-blue-50 text-blue-700 ring-blue-600/20';
};

export const statusLabel = (status: string): string => {
    if (status === 'COMPLETED') return 'Ready';
    if (status === 'FAILED') return 'Failed';
    if (status === 'PROGRESS') return 'In progress';
    return status.charAt(0) + status.slice(1).toLowerCase();
};

const FRIENDLY_HEADINGS: Record<string, string> = {
    'Vsmart Upload': 'Your question papers',
    'Vsmart Extract': 'Your extractions',
    'Vsmart Image': 'Your extractions',
    'Vsmart Audio': 'Your audio-based papers',
    'Vsmart Topics': 'Your topic-based papers',
    'Vsmart Chat': 'Your chat sessions',
    'Vsmart Organizer': 'Your sorted sets',
    'Vsmart Sorter': 'Your sorted sets',
    'Vsmart Lecturer': 'Your lesson plans',
    'Vsmart Feedback': 'Your lecture reviews',
};

export const friendlyHeading = (rawHeading: string): string => {
    return FRIENDLY_HEADINGS[rawHeading] ?? rawHeading;
};

// input_type values that produce questions viewable via AIQuestionsPreview.
// Chat, lecture-plan, and lecture-review tasks use their own preview components.
export const QUESTION_TASK_TYPES = new Set<string>([
    'PDF_TO_QUESTIONS',
    'PDF_TO_QUESTIONS_WITH_TOPIC',
    'IMAGE_TO_QUESTIONS',
    'AUDIO_TO_QUESTIONS',
    'TEXT_TO_QUESTIONS',
]);

export const isQuestionTask = (task: AITaskIndividualListInterface): boolean =>
    QUESTION_TASK_TYPES.has(task.input_type);

// Map input_type → display heading for AIQuestionsPreview's export filename.
const QUESTION_HEADING_BY_TYPE: Record<string, string> = {
    PDF_TO_QUESTIONS: 'Vsmart Upload',
    PDF_TO_QUESTIONS_WITH_TOPIC: 'Vsmart Organizer',
    IMAGE_TO_QUESTIONS: 'Vsmart Image',
    AUDIO_TO_QUESTIONS: 'Vsmart Audio',
    TEXT_TO_QUESTIONS: 'Vsmart Topics',
};

export const headingForQuestionTask = (task: AITaskIndividualListInterface): string =>
    QUESTION_HEADING_BY_TYPE[task.input_type] ?? 'Vsmart';
