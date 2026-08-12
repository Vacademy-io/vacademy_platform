import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

type MdProps = { children?: ReactNode };

/**
 * Token-styled markdown for knowledge-base answers.
 *
 * The model writes markdown — headings, bullet lists, `**bold**` — and rendering
 * it as plain text put literal `* **Separation techniques**:` on screen, which
 * reads like the feature is broken. No `prose` plugin: every element is mapped to
 * design-system tokens so it matches the rest of the app.
 *
 * `break-words` throughout because knowledge-base content is full of long
 * unbroken tokens (file names like
 * `21st_E_Book_Chemistry_Is_matter_around_us_pure...`) that otherwise blow out
 * the card width.
 */
const components: Components = {
    p: ({ children }: MdProps) => <p className="mb-2 break-words last:mb-0">{children}</p>,
    ul: ({ children }: MdProps) => (
        <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
    ),
    ol: ({ children }: MdProps) => (
        <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
    ),
    li: ({ children }: MdProps) => <li className="break-words">{children}</li>,
    strong: ({ children }: MdProps) => (
        <strong className="font-semibold text-neutral-700">{children}</strong>
    ),
    em: ({ children }: MdProps) => <em className="italic">{children}</em>,
    h1: ({ children }: MdProps) => (
        <p className="mb-1 mt-3 text-subtitle font-semibold text-neutral-700 first:mt-0">
            {children}
        </p>
    ),
    h2: ({ children }: MdProps) => (
        <p className="mb-1 mt-3 text-subtitle font-semibold text-neutral-700 first:mt-0">
            {children}
        </p>
    ),
    h3: ({ children }: MdProps) => (
        <p className="mb-1 mt-2 text-body font-semibold text-neutral-700 first:mt-0">{children}</p>
    ),
    code: ({ children }: MdProps) => (
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-caption text-neutral-700">
            {children}
        </code>
    ),
    pre: ({ children }: MdProps) => (
        <pre className="mb-2 overflow-x-auto rounded-md bg-neutral-100 p-2 text-caption">
            {children}
        </pre>
    ),
    blockquote: ({ children }: MdProps) => (
        <blockquote className="mb-2 border-l-2 border-neutral-300 pl-3 text-neutral-600">
            {children}
        </blockquote>
    ),
    // Tables appear when an answer quotes one out of the source material.
    table: ({ children }: MdProps) => (
        <div className="mb-2 overflow-x-auto">
            <table className="w-full border-collapse text-caption">{children}</table>
        </div>
    ),
    th: ({ children }: MdProps) => (
        <th className="border border-neutral-200 bg-neutral-50 px-2 py-1 text-left font-semibold">
            {children}
        </th>
    ),
    td: ({ children }: MdProps) => (
        <td className="border border-neutral-200 px-2 py-1">{children}</td>
    ),
    hr: () => <hr className="my-3 border-neutral-200" />,
};

export const AnswerMarkdown = ({ children }: { children: string }) => (
    <div className="text-body text-neutral-600">
        <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
);
