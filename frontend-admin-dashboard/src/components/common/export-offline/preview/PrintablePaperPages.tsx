import {
    useMemo,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { Question } from '../types/question';
import { QuestionComponent } from './question-component';

const PAGE_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 20;
const QUESTION_SPACING_MM = 10;
const PX_PER_MM = 3.7795275591;

const FONT_SIZE_PX: Record<NonNullable<PrintablePaperPagesProps['fontSize']>, number> = {
    small: 12,
    medium: 14,
    large: 16,
};

export interface PrintablePaperPagesProps {
    /**
     * Already-converted questions (use convertQuestionsToExportSchema if the
     * source is the question-papers API, or a flow-specific mapper for
     * AI-generated content).
     */
    questions: Question[];
    /**
     * Rendered at the top of EVERY page (letterhead + title + info strip).
     * Caller controls header look; this component just measures it once and
     * subtracts its height from every page's available space.
     */
    header: ReactNode;
    /**
     * Optional one-time content rendered between the header and the question
     * grid on page 1 only (e.g. student-details fill-in strip on an exam).
     */
    firstPagePrefix?: ReactNode;
    /**
     * Optional text shown on the left of the footer on every page (e.g.
     * "Shiksha Nation · 28 May 2026"). The right side always shows
     * `Page X of Y` when showPageNumbers is true.
     */
    footerLabel?: string;
    /**
     * Optional base64 data URL drawn as a faint watermark behind the content
     * on every page. Used for institute branding and as a soft anti-photocopy
     * cue on printed exam papers.
     */
    watermarkSrc?: string | null;
    /** When true, highlights correct option(s) and renders explanation_text. */
    showAnswers?: boolean;
    /** Number of columns to lay questions out in per page (1 = full width). */
    columns?: 1 | 2 | 3;
    fontSize?: 'small' | 'medium' | 'large';
    showCheckboxes?: boolean;
    showMarks?: boolean;
    showPageNumbers?: boolean;
}

/**
 * Off-screen-mountable printable wrapper that builds `.page`-class A4 divs
 * for an html2canvas + jspdf export pipeline.
 *
 * Layout per page (z-stack, bottom to top):
 *   1. Watermark layer (absolute, opacity-10, rotated logo) — optional
 *   2. Content column (header → first-page prefix → questions → footer)
 *
 * Pagination strategy: first invisible pass measures every question's
 * rendered height plus the header + footer + first-page prefix; second pass
 * packs questions into columns & pages so A4 never overflows. The capture
 * hook reads `.page` children from `pagesContainerRef`.
 */
export function PrintablePaperPages({
    questions,
    header,
    firstPagePrefix,
    footerLabel,
    watermarkSrc,
    showAnswers = false,
    columns = 1,
    fontSize = 'medium',
    showCheckboxes = false,
    showMarks = true,
    showPageNumbers = true,
}: PrintablePaperPagesProps) {
    const headerRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);
    const prefixRef = useRef<HTMLDivElement>(null);
    const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [measurements, setMeasurements] = useState<{
        header: number;
        footer: number;
        prefix: number;
        questions: number[];
    }>({ header: 0, footer: 0, prefix: 0, questions: [] });

    useEffect(() => {
        const measure = (el: HTMLElement | null): number => {
            if (!el) return 0;
            const styles = window.getComputedStyle(el);
            const margin =
                parseFloat(styles.marginTop) + parseFloat(styles.marginBottom);
            return (el.offsetHeight + margin) / PX_PER_MM;
        };
        setMeasurements({
            header: measure(headerRef.current),
            footer: measure(footerRef.current),
            prefix: measure(prefixRef.current),
            questions: questionRefs.current.map(measure),
        });
    }, [
        questions,
        header,
        firstPagePrefix,
        footerLabel,
        showAnswers,
        columns,
        fontSize,
        showCheckboxes,
        showMarks,
    ]);

    // Compute pages as a list of "column buckets" (no JSX yet) so we can
    // know totalPages before rendering — needed for "Page X of Y" labels.
    const packed = useMemo(() => {
        const pages: Array<{ columns: number[][]; isFirst: boolean }> = [];
        const availablePerPage =
            PAGE_HEIGHT_MM -
            2 * PAGE_MARGIN_MM -
            measurements.header -
            measurements.footer;

        let pageIndex = 0;
        let currentColumns: number[][] = Array.from(
            { length: columns },
            () => []
        );
        let columnHeights = Array(columns).fill(0);
        let currentColumn = 0;
        const firstPagePrefixHeight = firstPagePrefix ? measurements.prefix : 0;
        let availableHeight = availablePerPage - firstPagePrefixHeight;

        const flushPage = (isFirst: boolean) => {
            pages.push({ columns: currentColumns, isFirst });
            pageIndex += 1;
            currentColumns = Array.from({ length: columns }, () => []);
            columnHeights = Array(columns).fill(0);
            currentColumn = 0;
            availableHeight = availablePerPage;
        };

        questions.forEach((_q, idx) => {
            const qHeight = measurements.questions[idx] || 0;
            const total = columnHeights[currentColumn] + qHeight + QUESTION_SPACING_MM;
            if (total <= availableHeight) {
                currentColumns[currentColumn]!.push(idx);
                columnHeights[currentColumn] += qHeight + QUESTION_SPACING_MM;
                return;
            }
            if (currentColumn < columns - 1) {
                currentColumn += 1;
                currentColumns[currentColumn]!.push(idx);
                columnHeights[currentColumn] = qHeight + QUESTION_SPACING_MM;
                return;
            }
            flushPage(pageIndex === 0);
            currentColumns[currentColumn]!.push(idx);
            columnHeights[currentColumn] = qHeight + QUESTION_SPACING_MM;
        });

        if (currentColumns.some((c) => c.length > 0)) {
            flushPage(pageIndex === 0);
        }

        return pages;
    }, [questions, columns, measurements, firstPagePrefix]);

    const totalPages = Math.max(packed.length, 1);

    const renderQuestionDiv = (q: Question, idx: number) => (
        <div
            key={q.question_id}
            ref={(el) => {
                questionRefs.current[idx] = el;
            }}
            className="mb-4"
            style={{ fontSize: `${FONT_SIZE_PX[fontSize]}px` }}
        >
            <QuestionComponent
                question={q}
                questionNumber={idx + 1}
                showMarks={showMarks}
                showCheckboxes={showCheckboxes}
                showAnswers={showAnswers}
            />
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Hidden measurement region — header / footer / prefix only need
                to be measured once and the values are reused on every page so
                the pagination math stays stable. */}
            <div className="absolute -z-50 opacity-0" aria-hidden>
                <div ref={headerRef}>{header}</div>
                {firstPagePrefix && <div ref={prefixRef}>{firstPagePrefix}</div>}
                <div ref={footerRef}>
                    <Footer
                        label={footerLabel}
                        pageNumber={1}
                        totalPages={totalPages}
                        show={showPageNumbers}
                    />
                </div>
            </div>

            {packed.map((page, pageIdx) => {
                const pageNumber = pageIdx + 1;
                return (
                    <div
                        key={`page-${pageNumber}`}
                        className="page relative bg-white"
                    >
                        {watermarkSrc && (
                            <Watermark src={watermarkSrc} />
                        )}
                        <div className="relative z-10 flex h-full flex-col">
                            <div>{header}</div>
                            {page.isFirst && firstPagePrefix && (
                                <div>{firstPagePrefix}</div>
                            )}
                            <div className="grow">
                                <div
                                    className={`grid gap-8 ${
                                        columns === 2
                                            ? 'grid-cols-2'
                                            : columns === 3
                                              ? 'grid-cols-3'
                                              : ''
                                    }`}
                                >
                                    {page.columns.map((col, ci) => (
                                        <div
                                            key={ci}
                                            className="flex flex-col"
                                        >
                                            {col.map((qIdx) =>
                                                renderQuestionDiv(
                                                    questions[qIdx]!,
                                                    qIdx
                                                )
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Footer
                                label={footerLabel}
                                pageNumber={pageNumber}
                                totalPages={totalPages}
                                show={showPageNumbers}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function Watermark({ src }: { src: string }) {
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
        >
            <img
                src={src}
                alt=""
                className="w-3/5 -rotate-12 opacity-10 grayscale"
            />
        </div>
    );
}

function Footer({
    label,
    pageNumber,
    totalPages,
    show,
}: {
    label?: string;
    pageNumber: number;
    totalPages: number;
    show: boolean;
}) {
    if (!label && !show) return null;
    return (
        <div className="mt-4 border-t border-neutral-200 pt-2 text-xs text-neutral-500">
            <div className="flex items-center justify-between gap-4">
                <span className="truncate">{label}</span>
                {show && (
                    <span>
                        Page {pageNumber} of {totalPages}
                    </span>
                )}
            </div>
        </div>
    );
}
