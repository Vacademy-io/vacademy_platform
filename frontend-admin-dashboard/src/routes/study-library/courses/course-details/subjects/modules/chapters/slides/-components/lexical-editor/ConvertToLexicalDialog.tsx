import { useEffect, useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { CheckCircle, Warning, WarningCircle, Info, CircleNotch } from '@phosphor-icons/react';
import { analyzeConversion, type ConversionAnalysis } from './convert-yoopta';

interface ConvertToLexicalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Current document HTML (live editor serialization) to convert. */
    sourceHtml: string | null;
    /** Called with the round-tripped HTML + whether the pre-flight was clean.
     *  `forced` is true when the user overrode a detected data-loss warning. */
    onConfirm: (convertedHtml: string, forced: boolean) => void;
    converting?: boolean;
}

export function ConvertToLexicalDialog({
    open,
    onOpenChange,
    sourceHtml,
    onConfirm,
    converting = false,
}: ConvertToLexicalDialogProps) {
    const [analysis, setAnalysis] = useState<ConversionAnalysis | null>(null);

    // Run the pre-flight when the dialog opens for a document.
    useEffect(() => {
        if (!open || !sourceHtml) {
            setAnalysis(null);
            return;
        }
        setAnalysis(null);
        // Defer so the dialog paints its loading state before the (synchronous)
        // round-trip runs.
        const id = window.setTimeout(() => {
            setAnalysis(analyzeConversion(sourceHtml));
        }, 0);
        return () => window.clearTimeout(id);
    }, [open, sourceHtml]);

    const loading = !analysis;
    const hasHardLoss =
        !!analysis &&
        (analysis.lostBlocks.length > 0 || analysis.lostMedia.length > 0 || analysis.textChanged);

    return (
        <MyDialog
            heading="Convert to new editor"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="w-full max-w-lg"
            footer={
                <div className="flex w-full flex-wrap items-center justify-end gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        disable={converting}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    {analysis && analysis.convertedHtml && !hasHardLoss && (
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            disable={converting}
                            onClick={() => onConfirm(analysis.convertedHtml, false)}
                        >
                            {converting ? 'Converting…' : 'Convert'}
                        </MyButton>
                    )}
                    {analysis && analysis.convertedHtml && hasHardLoss && (
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            disable={converting}
                            className="border-danger-400 text-danger-600 hover:bg-danger-50"
                            onClick={() => onConfirm(analysis.convertedHtml, true)}
                        >
                            {converting ? 'Converting…' : 'Convert anyway'}
                        </MyButton>
                    )}
                </div>
            }
        >
            <div className="flex flex-col gap-3 text-subtitle text-neutral-600">
                <p>
                    This moves the document to the new editor. We first run a check to make sure
                    nothing is lost.
                </p>

                {loading && (
                    <div className="flex items-center gap-2 rounded-md bg-neutral-50 p-3 text-neutral-500">
                        <CircleNotch className="size-4 animate-spin" />
                        Checking the document…
                    </div>
                )}

                {analysis && !analysis.convertedHtml && (
                    <div className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 p-3 text-danger-700">
                        <WarningCircle className="mt-0.5 size-5 shrink-0" />
                        <div>
                            <p className="font-medium">This document can’t be converted.</p>
                            <p className="text-caption">
                                It couldn’t be parsed by the new editor. Leave it on the current
                                editor.
                            </p>
                        </div>
                    </div>
                )}

                {analysis && analysis.convertedHtml && !hasHardLoss && (
                    <div className="flex items-start gap-2 rounded-md border border-success-200 bg-success-50 p-3 text-success-700">
                        <CheckCircle className="mt-0.5 size-5 shrink-0" />
                        <div>
                            <p className="font-medium">
                                Safe to convert — no content will be lost.
                            </p>
                            <p className="text-caption">
                                All text, media and interactive blocks carry over.
                            </p>
                        </div>
                    </div>
                )}

                {analysis && analysis.convertedHtml && hasHardLoss && (
                    <div className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 p-3 text-danger-700">
                        <Warning className="mt-0.5 size-5 shrink-0" />
                        <div className="flex flex-col gap-1">
                            <p className="font-medium">Converting would lose content:</p>
                            <ul className="ml-4 list-disc text-caption">
                                {analysis.textChanged && <li>Some text would not carry over</li>}
                                {analysis.lostBlocks.length > 0 && (
                                    <li>
                                        Blocks:{' '}
                                        {analysis.lostBlocks.map((b) => humanBlock(b)).join(', ')}
                                    </li>
                                )}
                                {analysis.lostMedia.length > 0 && (
                                    <li>
                                        {analysis.lostMedia.length} media/link item(s) would be
                                        dropped
                                    </li>
                                )}
                            </ul>
                            <p className="text-caption">
                                Recommended: keep this document on the current editor.
                            </p>
                        </div>
                    </div>
                )}

                {analysis && analysis.convertedHtml && analysis.formattingWarnings.length > 0 && (
                    <div className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 p-3 text-warning-700">
                        <Info className="mt-0.5 size-5 shrink-0" />
                        <div>
                            <p className="font-medium">Minor styling may look different:</p>
                            <p className="text-caption">
                                {analysis.formattingWarnings.join(', ')}. Your content and blocks
                                are kept — only some inline styling may not carry over.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </MyDialog>
    );
}

const BLOCK_LABELS: Record<string, string> = {
    flashcard: 'Flashcard',
    tabbedContent: 'Tabs',
    quizBlock: 'Quiz',
    timeline: 'Timeline',
    columnsLayout: 'Columns',
    accordion: 'Accordion',
    mermaid: 'Mermaid diagram',
    mathBlock: 'Math',
    audioPlayer: 'Audio',
    pdfViewer: 'PDF',
    fillBlanks: 'Fill in the blanks',
    jupyterNotebook: 'Jupyter notebook',
    scratchProject: 'Scratch project',
    tableOfContents: 'Table of contents',
    codeBlock: 'Code editor',
    table: 'Table',
    img: 'Image',
    'media-embed': 'Video / embed',
};

function humanBlock(key: string): string {
    return BLOCK_LABELS[key] ?? key;
}
