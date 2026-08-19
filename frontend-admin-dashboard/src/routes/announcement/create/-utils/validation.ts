import type { MediumType, ModeType } from '@/services/announcement';
import type { WhatsAppTemplateDTO } from '@/routes/communication/whatsapp-templates/-services/template-api';
import type {
    AudienceRule,
    BatchOption,
    EmailConfig,
    FieldErrors,
    ModeSettings,
    PushConfig,
    ScheduleType,
    SectionValidation,
    WhatsAppConfig,
    FormSectionId,
} from '../-types';

const empty = (): SectionValidation => ({ errors: {}, blockers: [], warnings: [] });

const add = (v: SectionValidation, path: string, message: string) => {
    v.errors[path] = message;
    v.blockers.push(message);
};

export interface ValidationInput {
    title: string;
    htmlContent: string;
    contentText: string;
    previewText: string;
    rules: AudienceRule[];
    batchById: Record<string, BatchOption>;
    modes: ModeType[];
    modeSettings: Partial<Record<ModeType, ModeSettings>>;
    mediums: MediumType[];
    push: PushConfig;
    email: EmailConfig;
    whatsapp: WhatsAppConfig;
    selectedWaTemplate: WhatsAppTemplateDTO | null;
    hasEmailSenders: boolean;
    scheduleType: ScheduleType;
    oneTimeStart: string;
    cronExpression: string;
}

/** The template's variable names, from its declared names or its `{{…}}` placeholders. */
export function whatsAppVariableNames(template: WhatsAppTemplateDTO | null): string[] {
    if (!template) return [];
    if (template.bodyVariableNames?.length) return template.bodyVariableNames;
    const matches = (template.bodyText ?? '').match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

/** Media headers must carry a URL — Meta rejects the whole send without one. */
export function whatsAppHeaderKind(
    template: WhatsAppTemplateDTO | null
): 'image' | 'video' | 'document' | null {
    const raw = template?.headerType?.toUpperCase();
    if (raw === 'IMAGE') return 'image';
    if (raw === 'VIDEO') return 'video';
    if (raw === 'DOCUMENT') return 'document';
    return null;
}

/** Content that carries no words can still be a real announcement — a poster, a table, an embed. */
const hasNonTextContent = (html: string) =>
    /<(img|video|iframe|table|hr|embed|picture)\b/i.test(html);

function validateBasics(input: ValidationInput): SectionValidation {
    const v = empty();
    if (!input.title.trim()) add(v, 'title', 'Give the announcement a title.');
    // Matches the backend's @Size(max = 500) so the user is stopped here rather than by a 400.
    else if (input.title.trim().length > 500)
        add(v, 'title', 'Keep the title under 500 characters.');
    if (!input.contentText.trim() && !hasNonTextContent(input.htmlContent))
        add(v, 'content', 'Write the announcement content.');
    if (!input.previewText.trim()) {
        v.warnings.push(
            'No preview text — inboxes will fall back to the first line of your content.'
        );
    }
    return v;
}

function validateRecipients(input: ValidationInput): SectionValidation {
    const v = empty();
    if (input.rules.length === 0) {
        add(v, 'recipients', 'Add at least one audience — nobody receives this yet.');
        return v;
    }

    input.rules.forEach((rule, index) => {
        const label = `Audience ${index + 1}`;
        const path = `rule.${rule.key}`;
        switch (rule.type) {
            case 'ROLE':
                if (!rule.roleId) add(v, `${path}.role`, `${label}: pick a role.`);
                break;
            case 'PACKAGE_SESSION': {
                if (rule.packageSessionIds.length === 0) {
                    add(v, `${path}.batches`, `${label}: select at least one batch.`);
                    break;
                }
                const needsRole = rule.packageSessionIds.some(
                    (id) => input.batchById[id]?.isOrgAssociated
                );
                if (needsRole && !rule.orgRole) {
                    add(
                        v,
                        `${path}.orgRole`,
                        `${label}: pick Admin or Learner for the sub-organisation batches.`
                    );
                }
                break;
            }
            case 'USER':
                if (rule.userIds.length === 0)
                    add(v, `${path}.users`, `${label}: add at least one user id or email.`);
                break;
            case 'TAG':
                if (rule.tagIds.length === 0)
                    add(v, `${path}.tags`, `${label}: select at least one tag.`);
                break;
            case 'AUDIENCE':
                if (!rule.campaignId) add(v, `${path}.campaign`, `${label}: pick a campaign.`);
                break;
            case 'CUSTOM_FIELD_FILTER': {
                const complete = rule.fieldFilters.filter(
                    (f) =>
                        f.fieldId &&
                        (Array.isArray(f.filterValue) ? f.filterValue.length > 0 : !!f.filterValue)
                );
                if (complete.length === 0)
                    add(v, `${path}.filters`, `${label}: configure at least one field filter.`);
                break;
            }
            default:
                break;
        }

        const halfFilledFilter = rule.fieldFilters.some(
            (f) =>
                (f.fieldId &&
                    (Array.isArray(f.filterValue) ? !f.filterValue.length : !f.filterValue)) ||
                (!f.fieldId &&
                    (Array.isArray(f.filterValue) ? f.filterValue.length : f.filterValue))
        );
        if (halfFilledFilter && rule.type !== 'CUSTOM_FIELD_FILTER') {
            v.warnings.push(`${label}: an incomplete field filter will be ignored.`);
        }
        if (rule.exclusions.some((e) => !e.exclusionId)) {
            v.warnings.push(`${label}: an empty exclusion will be ignored.`);
        }
    });

    return v;
}

function validateModeSettings(mode: ModeType, settings: ModeSettings, v: SectionValidation): void {
    const path = `modes.${mode}`;
    switch (mode) {
        case 'SYSTEM_ALERT':
            if (!settings.priority) add(v, `${path}.priority`, 'System Alert: choose a priority.');
            break;
        case 'DASHBOARD_PIN': {
            const start = (settings.pinStartTime as string) || '';
            const end = (settings.pinEndTime as string) || '';
            if (!settings.position) add(v, `${path}.position`, 'Dashboard Pin: choose a position.');
            if (!start) add(v, `${path}.pinStartTime`, 'Dashboard Pin: set a start time.');
            if (!end) add(v, `${path}.pinEndTime`, 'Dashboard Pin: set an end time.');
            if (start && end && new Date(start) >= new Date(end))
                add(
                    v,
                    `${path}.pinEndTime`,
                    'Dashboard Pin: the end time must be after the start.'
                );
            break;
        }
        case 'APP_OVERLAY': {
            const showUntil = (settings.showUntil as string) || '';
            if (showUntil) {
                const parsed = new Date(showUntil);
                if (Number.isNaN(parsed.getTime()))
                    add(v, `${path}.showUntil`, 'App Overlay: enter a valid date and time.');
                else if (parsed.getTime() <= Date.now())
                    add(v, `${path}.showUntil`, 'App Overlay: “show until” must be in the future.');
            }
            const priority = Number(settings.priority ?? 1);
            if (!Number.isInteger(priority) || priority < 1 || priority > 10)
                add(v, `${path}.priority`, 'App Overlay: priority must be between 1 and 10.');
            break;
        }
        case 'RESOURCES':
            if (!settings.folderName)
                add(v, `${path}.folderName`, 'Resources: enter a folder name.');
            break;
        case 'COMMUNITY':
            if (!settings.communityType)
                add(v, `${path}.communityType`, 'Community: choose a community type.');
            break;
        case 'TASKS': {
            const slides = (settings.slideIds as string[] | undefined) ?? [];
            const goLive = (settings.goLiveDateTime as string) || '';
            const deadline = (settings.deadlineDateTime as string) || '';
            if (!settings.taskTitle) add(v, `${path}.taskTitle`, 'Tasks: enter a task title.');
            if (!slides.length) add(v, `${path}.slideIds`, 'Tasks: add at least one slide.');
            if (!goLive) add(v, `${path}.goLiveDateTime`, 'Tasks: set a go-live time.');
            if (!deadline) add(v, `${path}.deadlineDateTime`, 'Tasks: set a deadline.');
            if (goLive && deadline && new Date(goLive) >= new Date(deadline))
                add(v, `${path}.deadlineDateTime`, 'Tasks: the deadline must be after go-live.');
            break;
        }
        default:
            break;
    }
}

function validatePlacements(input: ValidationInput): SectionValidation {
    const v = empty();
    if (input.modes.length === 0) {
        add(v, 'modes', 'Choose at least one place for this announcement to appear.');
        return v;
    }
    input.modes.forEach((mode) => validateModeSettings(mode, input.modeSettings[mode] ?? {}, v));
    return v;
}

function validateDelivery(input: ValidationInput): SectionValidation {
    const v = empty();

    if (input.mediums.length === 0) {
        v.warnings.push(
            'No delivery channel selected — this will only appear inside the product, with no push, email or WhatsApp.'
        );
    }

    if (input.mediums.includes('PUSH_NOTIFICATION')) {
        if (!input.push.title.trim())
            add(v, 'push.title', 'Push notification: a title is required.');
        if (!input.push.body.trim()) add(v, 'push.body', 'Push notification: a body is required.');
        if (input.push.title.length > 50)
            v.warnings.push('Push titles over 50 characters get truncated on most devices.');
        if (input.push.body.length > 150)
            v.warnings.push('Push bodies over 150 characters get truncated on most devices.');
    }

    if (input.mediums.includes('EMAIL')) {
        if (!input.hasEmailSenders) {
            add(
                v,
                'email.from',
                'Email: no verified sender address is configured for this institute.'
            );
        } else if (!input.email.fromKey) {
            add(v, 'email.from', 'Email: choose the address this is sent from.');
        }
    }

    if (input.mediums.includes('WHATSAPP')) {
        if (!input.whatsapp.templateName) {
            add(v, 'whatsapp.template', 'WhatsApp: choose an approved template.');
        } else if (!input.selectedWaTemplate) {
            add(
                v,
                'whatsapp.template',
                'WhatsApp: the selected template is no longer approved — pick another.'
            );
        } else {
            if (whatsAppHeaderKind(input.selectedWaTemplate) && !input.whatsapp.headerUrl.trim()) {
                add(
                    v,
                    'whatsapp.headerUrl',
                    'WhatsApp: this template has a media header, so a media URL is required.'
                );
            }
            whatsAppVariableNames(input.selectedWaTemplate).forEach((name) => {
                const binding = input.whatsapp.variables[name];
                if (!binding) {
                    add(v, `whatsapp.var.${name}`, `WhatsApp: fill in the “${name}” variable.`);
                } else if (binding.source === 'CUSTOM' && !binding.customValue.trim()) {
                    add(
                        v,
                        `whatsapp.var.${name}`,
                        `WhatsApp: enter the custom text for “${name}”.`
                    );
                }
            });
        }
    }

    if (input.scheduleType === 'ONE_TIME') {
        if (!input.oneTimeStart) {
            add(v, 'schedule.startDate', 'Schedule: pick the date and time to send.');
        } else if (new Date(input.oneTimeStart).getTime() <= Date.now()) {
            v.warnings.push(
                'The scheduled time is in the past for your local clock — check the timezone.'
            );
        }
    }
    if (input.scheduleType === 'RECURRING' && !input.cronExpression.trim()) {
        add(
            v,
            'schedule.cronExpression',
            'Schedule: a cron expression is required for recurring sends.'
        );
    }

    return v;
}

export function validateSection(step: FormSectionId, input: ValidationInput): SectionValidation {
    switch (step) {
        case 'basics':
            return validateBasics(input);
        case 'recipients':
            return validateRecipients(input);
        case 'placements':
            return validatePlacements(input);
        case 'delivery':
            return validateDelivery(input);
        case 'review': {
            const merged = empty();
            (['basics', 'recipients', 'placements', 'delivery'] as FormSectionId[]).forEach((s) => {
                const result = validateSection(s, input);
                Object.assign(merged.errors, result.errors);
                merged.blockers.push(...result.blockers);
                merged.warnings.push(...result.warnings);
            });
            return merged;
        }
        default:
            return empty();
    }
}

export function validateAll(input: ValidationInput): Record<FormSectionId, SectionValidation> {
    return {
        basics: validateSection('basics', input),
        recipients: validateSection('recipients', input),
        placements: validateSection('placements', input),
        delivery: validateSection('delivery', input),
        review: { errors: {}, blockers: [], warnings: [] },
    };
}

export function mergeErrors(map: Record<FormSectionId, SectionValidation>): FieldErrors {
    return Object.values(map).reduce<FieldErrors>(
        (acc, step) => Object.assign(acc, step.errors),
        {}
    );
}
