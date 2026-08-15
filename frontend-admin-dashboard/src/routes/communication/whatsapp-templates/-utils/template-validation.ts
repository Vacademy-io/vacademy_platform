import type { TemplateButton, WhatsAppTemplateDTO } from '../-services/template-api';

/**
 * Client-side mirror of the server's WhatsAppTemplateValidator.
 *
 * Meta answers nearly every content problem with the same opaque error code 100 "Invalid parameter",
 * so both layers check these rules: the server because it is the real gate, and here so the admin sees
 * "Body text cannot end with a variable" the moment they hit Submit instead of after a round trip.
 */

export interface TemplateProblem {
    field: string;
    message: string;
}

const PLACEHOLDER = /\{\{\s*(\d+)\s*\}\}/g;

const BODY_MAX = 1024;
const HEADER_TEXT_MAX = 60;
const FOOTER_MAX = 60;
const BUTTON_TEXT_MAX = 25;
/** Meta's own ceiling. The builder offers 3, but a template synced from Meta may carry more. */
const MAX_BUTTONS = 10;

/** Meta allows lowercase letters, digits and underscores, up to 512 characters. */
export const normalizeTemplateName = (raw: string): string =>
    raw.toLowerCase().replace(/[^a-z0-9_]/g, '_');

export const placeholderIndexes = (text: string): number[] => {
    const found: number[] = [];
    for (const match of text.matchAll(PLACEHOLDER)) {
        found.push(Number(match[1]));
    }
    return found;
};

/** Meta requires variables numbered 1..N with no gaps — `{{1}} … {{3}}` is rejected. */
const sequenceProblem = (indexes: number[], where: string): string | null => {
    if (indexes.length === 0) return null;
    const distinct = [...new Set(indexes)].sort((a, b) => a - b);
    if (distinct[0] !== 1) {
        return `${where} variables must start at {{1}} — found {{${distinct[0]}}} first.`;
    }
    for (let i = 0; i < distinct.length; i++) {
        if (distinct[i] !== i + 1) {
            return `${where} variables must be numbered consecutively — {{${i + 1}}} is missing but {{${distinct[i]}}} is used.`;
        }
    }
    return null;
};

const endsWithPlaceholder = (trimmed: string): boolean => {
    let end = -1;
    for (const match of trimmed.matchAll(PLACEHOLDER)) {
        end = (match.index ?? 0) + match[0].length;
    }
    return end === trimmed.length;
};

const startsWithPlaceholder = (trimmed: string): boolean => /^\{\{\s*\d+\s*\}\}/.test(trimmed);

/** Everything that must hold before a draft can be saved. Deliberately permissive. */
export const validateDraft = (dto: {
    name: string;
    category: string;
    bodyText: string;
}): TemplateProblem[] => {
    const problems: TemplateProblem[] = [];
    const normalized = normalizeTemplateName(dto.name.trim());

    if (!dto.name.trim()) {
        problems.push({ field: 'name', message: 'Give the template a name.' });
    } else if (!normalized.replace(/_/g, '')) {
        problems.push({
            field: 'name',
            message: 'Template name must contain at least one letter or number.',
        });
    } else if (normalized.length > 512) {
        problems.push({
            field: 'name',
            message: 'Template name is too long — Meta allows at most 512 characters.',
        });
    }

    if (!dto.category) {
        problems.push({ field: 'category', message: 'Pick a category.' });
    }

    if (!dto.bodyText.trim()) {
        problems.push({
            field: 'bodyText',
            message: 'Add the message body — this is what your learners will read.',
        });
    }

    return problems;
};

/** Everything Meta checks at registration. Returns every problem, not just the first. */
export const validateForSubmit = (dto: {
    name: string;
    language: string;
    category: string;
    headerType: string;
    headerText: string;
    headerSampleUrl: string;
    headerSampleValues?: string[];
    bodyText: string;
    footerText: string;
    buttons: TemplateButton[];
    bodySampleValues: string[];
}): TemplateProblem[] => {
    const problems: TemplateProblem[] = validateDraft(dto);

    if (!dto.language) {
        problems.push({ field: 'language', message: 'Pick a language.' });
    }

    // --- Body ---
    const body = dto.bodyText;
    if (body.trim()) {
        if (body.length > BODY_MAX) {
            problems.push({
                field: 'bodyText',
                message: `Body text is ${body.length} characters; Meta allows at most ${BODY_MAX}.`,
            });
        }
        const indexes = placeholderIndexes(body);
        const seqProblem = sequenceProblem(indexes, 'Body');
        if (seqProblem) problems.push({ field: 'bodyText', message: seqProblem });

        if (indexes.length > 0) {
            const trimmed = body.trim();
            if (startsWithPlaceholder(trimmed)) {
                problems.push({
                    field: 'bodyText',
                    message: 'Body text cannot start with a variable — put some words before it.',
                });
            }
            if (endsWithPlaceholder(trimmed)) {
                problems.push({
                    field: 'bodyText',
                    message:
                        'Body text cannot end with a variable — add a word or punctuation after it.',
                });
            }
            const expected = Math.max(...indexes);
            for (let i = 0; i < expected; i++) {
                if (!dto.bodySampleValues[i]?.trim()) {
                    problems.push({
                        field: 'bodySampleValues',
                        message: `Sample value for variable {{${i + 1}}} is empty — Meta needs one example per variable to review the template.`,
                    });
                }
            }
        }
    }

    // --- Header ---
    if (dto.headerType === 'TEXT') {
        if (!dto.headerText.trim()) {
            problems.push({
                field: 'headerText',
                message: 'Header is set to Text but no header text was entered.',
            });
        } else {
            if (dto.headerText.length > HEADER_TEXT_MAX) {
                problems.push({
                    field: 'headerText',
                    message: `Header text is ${dto.headerText.length} characters; Meta allows at most ${HEADER_TEXT_MAX}.`,
                });
            }
            const headerVars = placeholderIndexes(dto.headerText);
            if (headerVars.length > 1) {
                problems.push({
                    field: 'headerText',
                    message: `A text header can contain at most one variable; this one has ${headerVars.length}.`,
                });
            } else if (headerVars.length === 1 && !dto.headerSampleValues?.[0]?.trim()) {
                problems.push({
                    field: 'headerSampleValues',
                    message: 'The header variable needs a sample value for Meta to review it.',
                });
            }
        }
    } else if (dto.headerType !== 'NONE' && !dto.headerSampleUrl.trim()) {
        problems.push({
            field: 'headerSampleUrl',
            message: `A sample ${dto.headerType.toLowerCase()} URL is required for ${dto.headerType.toLowerCase()}-header templates.`,
        });
    }

    // --- Footer ---
    if (dto.footerText.trim()) {
        if (dto.footerText.length > FOOTER_MAX) {
            problems.push({
                field: 'footerText',
                message: `Footer is ${dto.footerText.length} characters; Meta allows at most ${FOOTER_MAX}.`,
            });
        }
        if (placeholderIndexes(dto.footerText).length > 0) {
            problems.push({
                field: 'footerText',
                message: 'Footers cannot contain variables — remove the {{…}} from the footer.',
            });
        }
    }

    // --- Buttons ---
    if (dto.buttons.length > MAX_BUTTONS) {
        problems.push({
            field: 'buttons',
            message: `A template can have at most ${MAX_BUTTONS} buttons.`,
        });
    }
    let phoneButtons = 0;
    dto.buttons.forEach((btn, i) => {
        const label = `Button ${i + 1}`;
        if (!btn.text?.trim()) {
            problems.push({ field: `buttons.${i}.text`, message: `${label} has no label text.` });
        } else if (btn.text.length > BUTTON_TEXT_MAX) {
            problems.push({
                field: `buttons.${i}.text`,
                message: `${label} label is ${btn.text.length} characters; Meta allows at most ${BUTTON_TEXT_MAX}.`,
            });
        }
        if (btn.type === 'URL') {
            const url = btn.url?.trim() ?? '';
            if (!url || url === 'https://') {
                problems.push({
                    field: `buttons.${i}.url`,
                    message: `${label} is a URL button but has no link.`,
                });
            } else if (!/^https?:\/\//.test(url)) {
                problems.push({
                    field: `buttons.${i}.url`,
                    message: `${label} link must start with http:// or https://.`,
                });
            } else if (placeholderIndexes(url).length > 0 && !btn.example?.[0]?.trim()) {
                problems.push({
                    field: `buttons.${i}.example`,
                    message: `${label} has a variable in its link, so it needs a sample URL for Meta to review.`,
                });
            }
        }
        if (btn.type === 'PHONE_NUMBER') {
            phoneButtons++;
            const phone = btn.phoneNumber?.trim() ?? '';
            if (!phone) {
                problems.push({
                    field: `buttons.${i}.phoneNumber`,
                    message: `${label} is a phone button but has no number.`,
                });
            } else if (!phone.startsWith('+')) {
                problems.push({
                    field: `buttons.${i}.phoneNumber`,
                    message: `${label} number must be in international format, e.g. +919876543210.`,
                });
            }
        }
    });
    if (phoneButtons > 1) {
        problems.push({
            field: 'buttons',
            message: 'Only one phone-number button is allowed per template.',
        });
    }

    return problems;
};

/** Fields the server flagged, keyed the same way the builder keys its inputs. */
export const problemFields = (problems: TemplateProblem[]): Set<string> =>
    new Set(problems.map((p) => p.field));

export type TemplateDraftInput = Pick<
    WhatsAppTemplateDTO,
    'name' | 'language' | 'category' | 'headerType' | 'bodyText'
>;
