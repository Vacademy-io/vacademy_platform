import { $insertNodes, $createParagraphNode, type LexicalEditor, type LexicalNode } from 'lexical';
import {
    Image,
    VideoCamera,
    Paperclip,
    Browser,
    Megaphone,
    MusicNotes,
    FilePdf,
    Function as FunctionIcon,
    GitBranch,
    TextIndent,
    ListNumbers,
    BookOpen,
    GameController,
    Cards,
    Rows,
    Question,
    ListChecks,
    Columns,
    CaretCircleDown,
    Code,
    Terminal,
} from '@phosphor-icons/react';
import { SlashMenuOption } from './SlashMenuPlugin';
import {
    MathBlock,
    MermaidBlock,
    AudioBlock,
    PdfBlock,
    FillBlanksBlock,
    JupyterBlock,
    ScratchBlock,
    TocBlock,
} from '../nodes/simple-attr-nodes';
import { ImageBlock, VideoBlock, FileBlock, EmbedBlock, CalloutBlock } from '../nodes/media-nodes';
import {
    FlashcardBlock,
    TabsBlock,
    QuizBlock,
    TimelineBlock,
    ColumnsBlock,
    AccordionBlock,
    CodeBlock,
    MultiLangCodeBlock,
} from '../nodes/payload-nodes';

/** Slash-menu entries for the custom document blocks. */

const insertBlock = (editor: LexicalEditor, create: () => LexicalNode) => {
    editor.update(() => {
        // Follow with an empty paragraph so the caret has somewhere to land
        // after inserting a decorator (non-text) block.
        $insertNodes([create(), $createParagraphNode()]);
    });
};

export function buildCustomBlockOptions(): SlashMenuOption[] {
    return [
        new SlashMenuOption('Image', {
            description: 'Upload an image',
            menuIcon: Image,
            keywords: ['image', 'picture', 'photo'],
            onSelect: (editor) => insertBlock(editor, () => ImageBlock.$create()),
        }),
        new SlashMenuOption('Video', {
            description: 'Upload a video file',
            menuIcon: VideoCamera,
            keywords: ['video', 'movie'],
            onSelect: (editor) => insertBlock(editor, () => VideoBlock.$create()),
        }),
        new SlashMenuOption('Embed', {
            description: 'YouTube, Vimeo, Loom or any URL',
            menuIcon: Browser,
            keywords: ['embed', 'youtube', 'vimeo', 'loom', 'iframe'],
            onSelect: (editor) => insertBlock(editor, () => EmbedBlock.$create()),
        }),
        new SlashMenuOption('File', {
            description: 'Attach a downloadable file',
            menuIcon: Paperclip,
            keywords: ['file', 'attachment', 'download'],
            onSelect: (editor) => insertBlock(editor, () => FileBlock.$create()),
        }),
        new SlashMenuOption('Callout', {
            description: 'Highlighted note box',
            menuIcon: Megaphone,
            keywords: ['callout', 'note', 'alert', 'info'],
            onSelect: (editor) => insertBlock(editor, () => CalloutBlock.$create()),
        }),
        new SlashMenuOption('Audio', {
            description: 'Upload an audio clip',
            menuIcon: MusicNotes,
            keywords: ['audio', 'sound', 'music', 'podcast'],
            onSelect: (editor) => insertBlock(editor, () => AudioBlock.$create()),
        }),
        new SlashMenuOption('PDF viewer', {
            description: 'Inline PDF for learners',
            menuIcon: FilePdf,
            keywords: ['pdf', 'document'],
            onSelect: (editor) => insertBlock(editor, () => PdfBlock.$create()),
        }),
        new SlashMenuOption('Math (LaTeX)', {
            description: 'KaTeX-rendered formula',
            menuIcon: FunctionIcon,
            keywords: ['math', 'latex', 'formula', 'equation', 'katex'],
            onSelect: (editor) => insertBlock(editor, () => MathBlock.$create()),
        }),
        new SlashMenuOption('Mermaid diagram', {
            description: 'Flowcharts, sequences & more',
            menuIcon: GitBranch,
            keywords: ['mermaid', 'diagram', 'flowchart', 'chart'],
            onSelect: (editor) => insertBlock(editor, () => MermaidBlock.$create()),
        }),
        new SlashMenuOption('Fill in the blanks', {
            description: 'Interactive cloze exercise',
            menuIcon: ListNumbers,
            keywords: ['fill', 'blanks', 'cloze', 'exercise'],
            onSelect: (editor) => insertBlock(editor, () => FillBlanksBlock.$create()),
        }),
        new SlashMenuOption('Table of contents', {
            description: 'Auto-generated from headings',
            menuIcon: TextIndent,
            keywords: ['toc', 'contents', 'outline'],
            onSelect: (editor) => insertBlock(editor, () => TocBlock.$create()),
        }),
        new SlashMenuOption('Jupyter notebook', {
            description: 'Embed a notebook from GitHub',
            menuIcon: BookOpen,
            keywords: ['jupyter', 'notebook', 'python'],
            onSelect: (editor) => insertBlock(editor, () => JupyterBlock.$create()),
        }),
        new SlashMenuOption('Scratch project', {
            description: 'Embed a Scratch project',
            menuIcon: GameController,
            keywords: ['scratch', 'game', 'project'],
            onSelect: (editor) => insertBlock(editor, () => ScratchBlock.$create()),
        }),
        new SlashMenuOption('Flashcard', {
            description: 'Front/back flip card',
            menuIcon: Cards,
            keywords: ['flashcard', 'card', 'flip'],
            onSelect: (editor) => insertBlock(editor, () => FlashcardBlock.$create()),
        }),
        new SlashMenuOption('Tabs', {
            description: 'Tabbed content sections',
            menuIcon: Rows,
            keywords: ['tabs', 'tabbed', 'sections'],
            onSelect: (editor) => insertBlock(editor, () => TabsBlock.$create()),
        }),
        new SlashMenuOption('Quiz', {
            description: 'Inline MCQ or true/false',
            menuIcon: Question,
            keywords: ['quiz', 'mcq', 'question', 'test'],
            onSelect: (editor) => insertBlock(editor, () => QuizBlock.$create()),
        }),
        new SlashMenuOption('Timeline', {
            description: 'Step-by-step timeline',
            menuIcon: ListChecks,
            keywords: ['timeline', 'steps', 'process'],
            onSelect: (editor) => insertBlock(editor, () => TimelineBlock.$create()),
        }),
        new SlashMenuOption('Columns', {
            description: 'Side-by-side layout',
            menuIcon: Columns,
            keywords: ['columns', 'layout', 'grid'],
            onSelect: (editor) => insertBlock(editor, () => ColumnsBlock.$create()),
        }),
        new SlashMenuOption('Accordion', {
            description: 'Collapsible sections — each supports rich content',
            menuIcon: CaretCircleDown,
            keywords: ['accordion', 'collapse', 'expand', 'faq'],
            onSelect: (editor) => insertBlock(editor, () => AccordionBlock.$create()),
        }),
        new SlashMenuOption('Code', {
            description: 'Syntax-highlighted code snippet',
            menuIcon: Code,
            keywords: ['code', 'snippet', 'pre'],
            onSelect: (editor) => insertBlock(editor, () => CodeBlock.$create()),
        }),
        new SlashMenuOption('Code editor (runnable)', {
            description: 'Interactive runner for learners',
            menuIcon: Terminal,
            keywords: ['code', 'python', 'run', 'interactive', 'editor'],
            onSelect: (editor) => insertBlock(editor, () => MultiLangCodeBlock.$create()),
        }),
    ];
}
