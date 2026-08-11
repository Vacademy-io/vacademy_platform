import type { KbPurpose, SourceKind, SourceStatus } from '../-types';
import type { StatusType } from '@/components/design-system/status-chips';

/**
 * Purposes in plain language. The wording matters more than it looks: this is the
 * screen where a non-technical academic head decides what a "knowledge base" even
 * is, so each option names a real thing they already have on a shelf.
 */
export const PURPOSE_OPTIONS: Array<{
    value: KbPurpose;
    label: string;
    hint: string;
}> = [
    {
        value: 'teaching',
        label: 'Teaching material',
        hint: 'Textbooks, notes and reference books for a class or subject — e.g. "Class 9 Science".',
    },
    {
        value: 'question_bank',
        label: 'Question bank',
        hint: 'Past papers and question collections — e.g. "JEE Advanced previous year questions".',
    },
    {
        value: 'general',
        label: 'General reference',
        hint: 'Anything else you want the AI to be able to look things up in.',
    },
];

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
    PDF: 'Document',
    URL: 'Web page',
    YOUTUBE: 'YouTube video',
    TEXT: 'Typed note',
};

/**
 * Status wording is deliberately plain and honest. "Partly readable" exists
 * because a scanned regional-language book genuinely produces some unusable
 * pages, and hiding that behind a green tick is how a teacher ends up with a
 * question paper built on garbled text.
 */
export const SOURCE_STATUS_META: Record<
    SourceStatus,
    { label: string; tone: StatusType; hint: string }
> = {
    PENDING: { label: 'Queued', tone: 'INFO', hint: 'Waiting to start.' },
    PROCESSING: { label: 'Reading', tone: 'INFO', hint: 'Being read and indexed right now.' },
    READY: { label: 'Ready', tone: 'SUCCESS', hint: 'Fully readable and searchable.' },
    PARTIAL: {
        label: 'Partly readable',
        tone: 'WARNING',
        hint: 'Indexed, but some pages could not be read properly.',
    },
    FAILED: { label: 'Failed', tone: 'DANGER', hint: 'Nothing could be indexed from this.' },
};

/** Stage → what the user is actually waiting for. */
export const STAGE_LABEL: Record<string, string> = {
    parsing: 'Reading pages',
    figures: 'Collecting diagrams and tables',
    chunking: 'Organising the text',
    embedding: 'Making it searchable',
    summarizing: 'Summarising chapters',
};

/** Language hints offered when creating a knowledge base. */
export const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'Hindi' },
    { value: 'mr', label: 'Marathi' },
    { value: 'ta', label: 'Tamil' },
    { value: 'te', label: 'Telugu' },
    { value: 'kn', label: 'Kannada' },
    { value: 'ml', label: 'Malayalam' },
    { value: 'bn', label: 'Bengali' },
    { value: 'gu', label: 'Gujarati' },
    { value: 'pa', label: 'Punjabi' },
    { value: 'ur', label: 'Urdu' },
];

export const LANGUAGE_LABEL: Record<string, string> = LANGUAGE_OPTIONS.reduce(
    (acc, opt) => ({ ...acc, [opt.value]: opt.label }),
    {} as Record<string, string>
);

/** Matches MAX_PAGES_PER_SOURCE in ai_service/app/services/kb/parsing.py. */
export const MAX_PAGES_PER_SOURCE = 1200;

/** Poll interval while any source is still being processed. */
export const POLL_INTERVAL_MS = 4000;

/**
 * The institute that publishes the shared library.
 *
 * A UI hint only — it decides whether the publishing entry point is worth
 * showing. The API is the authority and refuses anyone else with a 403, so a
 * stale value here can never grant publishing rights.
 * Mirrors KB_PUBLISHER_INSTITUTE_ID in ai_service.
 */
export const PUBLISHER_INSTITUTE_ID = '6b600940-2134-40ec-93ed-b61e403c5a87';
