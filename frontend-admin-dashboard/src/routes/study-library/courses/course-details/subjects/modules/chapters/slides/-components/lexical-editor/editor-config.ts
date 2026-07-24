import type { InitialConfigType } from '@lexical/react/LexicalComposer';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import type { Klass, LexicalNode } from 'lexical';
import { simpleAttrNodeClasses } from './nodes/simple-attr-nodes';
import { mediaNodeClasses } from './nodes/media-nodes';
import { payloadNodeClasses } from './nodes/payload-nodes';

/** Node registry for the Lexical document editor. Custom block nodes
 *  (flashcard, tabs, quiz, …) are appended here as they are built. */
export const editorNodes: Array<Klass<LexicalNode>> = [
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    LinkNode,
    AutoLinkNode,
    TableNode,
    TableCellNode,
    TableRowNode,
    HorizontalRuleNode,
    ...simpleAttrNodeClasses,
    ...mediaNodeClasses,
    ...payloadNodeClasses,
];

/** Theme: Tailwind token classes only (design-system rule — no raw values).
 *  These class names are what the editor DOM renders with; they do NOT leak
 *  into the serialized HTML ($generateHtmlFromNodes emits clean tags). */
export const editorTheme: InitialConfigType['theme'] = {
    paragraph: 'mb-2 leading-relaxed',
    heading: {
        h1: 'text-h1 font-semibold mb-3 mt-4',
        h2: 'text-h2 font-semibold mb-2 mt-3',
        h3: 'text-h3 font-semibold mb-2 mt-2',
    },
    quote: 'border-l-4 border-neutral-300 pl-4 italic text-neutral-600 my-2',
    list: {
        ul: 'list-disc pl-6 mb-2',
        ol: 'list-decimal pl-6 mb-2',
        listitem: 'mb-1',
        nested: {
            listitem: 'list-none',
        },
        listitemChecked: 'lex-check-item lex-check-item--checked',
        listitemUnchecked: 'lex-check-item',
    },
    link: 'text-primary-500 underline cursor-pointer',
    text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        strikethrough: 'line-through',
        underlineStrikethrough: 'underline line-through',
        code: 'rounded-sm bg-neutral-100 px-1 py-0.5 font-mono text-caption',
        highlight: 'bg-warning-100',
    },
    table: 'lex-table my-2 w-full border-collapse',
    tableCell: 'border border-neutral-300 p-2 align-top',
    tableCellHeader: 'border border-neutral-300 bg-neutral-50 p-2 font-semibold',
    hr: 'my-4 border-neutral-300',
};

export function onEditorError(error: Error): void {
    // Never let an editor exception crash the whole slide page — log and let
    // Lexical recover (it re-renders from the last good state).
    console.error('[LexicalDocumentEditor]', error);
}
