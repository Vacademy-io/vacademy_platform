/**
 * Use-case templates for the workflow builder.
 * Each template defines:
 *  - which trigger events it applies to
 *  - what questions to ask the user (dropdowns, selects)
 *  - how to generate nodes + edges from the answers
 */

import { v4 as uuidv4 } from 'uuid';
import type { Node, Edge } from 'reactflow';

// ─── Question types for the wizard ───

export interface WizardQuestion {
    id: string;
    label: string;
    helpText?: string;
    type: 'batch_select' | 'batch_multi_select' | 'template_select' | 'whatsapp_template_select' | 'audience_select' | 'live_session_select' | 'invite_select' | 'package_select' | 'number' | 'select' | 'text' | 'json_payload';
    required?: boolean;
    options?: Array<{ value: string; label: string }>; // for 'select' type
    defaultValue?: string | number;
    /** Helper text shown ABOVE the JSON editor for json_payload questions. */
    jsonPayloadHint?: string;
    /** Only show this question if another answer matches */
    showIf?: { questionId: string; values: string[] };
    /**
     * Optional override for which entry in SAMPLE_TEMPLATES to offer as a
     * "Use sample" button alongside this template_select question. Defaults to
     * the use-case template's id. Set explicitly when a single use-case has
     * multiple template_select questions that need DIFFERENT pre-built samples
     * (e.g., LIVE_SESSION_END recap → one sample for present, one for absent).
     * Only meaningful for type === 'template_select'.
     */
    sampleTemplateKey?: string;
}

export interface UseCaseTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    /** Which trigger events this template applies to. Empty = applies to scheduled. */
    triggerEvents: string[];
    /** 'EVENT_DRIVEN' | 'SCHEDULED' | 'BOTH' */
    workflowType: 'EVENT_DRIVEN' | 'SCHEDULED' | 'BOTH';
    /** Questions to ask the user */
    questions: WizardQuestion[];
    /** Generate nodes and edges from answers. Some answer types (e.g., audience_select)
     * can be string[] for multi-select questions. */
    generateWorkflow: (answers: Record<string, string | number | string[]>, triggerEvent?: string) => {
        nodes: Node[];
        edges: Edge[];
        workflowName?: string;
        workflowDescription?: string;
    };
}

// ─── Helper: create a ReactFlow node ───

function makeNode(
    type: string,
    name: string,
    config: Record<string, unknown>,
    x: number,
    y: number,
    isStart = false
): Node {
    return {
        id: `node-${uuidv4()}`,
        type: 'workflowNode',
        position: { x, y },
        data: { name, nodeType: type, config, isStartNode: isStart, isEndNode: false },
    };
}

function makeEdge(source: string, target: string, label = ''): Edge {
    return {
        id: `edge-${uuidv4()}`,
        source,
        target,
        label,
        type: 'smoothstep',
        animated: true,
    };
}

// ─── Channel (Email / WhatsApp / Both) helpers ───
//
// Every messaging use case offers a channel choice. Default stays EMAIL so
// existing behavior is unchanged; picking WhatsApp swaps (or adds) a
// SEND_WHATSAPP node that iterates the same list. The SEND_WHATSAPP handler
// extracts the phone from mobileNumber/mobile_number/phone/parentMobile/etc.
// (plus a phone-shaped fallback scan) and auto-resolves the WhatsApp
// template's variables from each item's fields, the workflow context, and
// customFields — the same resolution order SEND_EMAIL uses.

/** showIf for questions that only apply when email is part of the channel. */
const EMAIL_CHANNEL_SHOWIF = { questionId: 'channel', values: ['EMAIL', 'BOTH'] };

function channelQuestion(): WizardQuestion {
    return {
        id: 'channel',
        label: 'Send via',
        helpText: 'Reach recipients over email, WhatsApp, or both.',
        type: 'select',
        required: true,
        defaultValue: 'EMAIL',
        options: [
            { value: 'EMAIL', label: 'Email only' },
            { value: 'WHATSAPP', label: 'WhatsApp only' },
            { value: 'BOTH', label: 'Email + WhatsApp' },
        ],
    };
}

function whatsappTemplateQuestion(overrides: Partial<WizardQuestion> = {}): WizardQuestion {
    return {
        id: 'waTemplateName',
        label: 'Which WhatsApp template to use?',
        helpText:
            'Approved WhatsApp template (Settings → Templates, type WHATSAPP). Its variables '
            + 'auto-fill from each recipient\'s fields — map them later in the builder only if the names differ.',
        type: 'whatsapp_template_select',
        required: true,
        showIf: { questionId: 'channel', values: ['WHATSAPP', 'BOTH'] },
        ...overrides,
    };
}

/**
 * Build the SEND_EMAIL and/or SEND_WHATSAPP node(s) for the chosen channel,
 * chained vertically starting at (x, y). Connect the upstream node to
 * `nodes[0]`; internal chaining edges are returned in `edges`.
 */
function makeChannelSendNodes(
    answers: Record<string, string | number | string[]>,
    opts: {
        on: string;
        x: number;
        y: number;
        /** Node label prefix for the email node (default 'Send'). */
        emailLabelPrefix?: string;
        /** Placeholder → field/SpEL mapping applied to BOTH channels. */
        templateVars?: Record<string, string>;
        /** Email recipient field override (e.g. parentsEmail). */
        recipientField?: string;
        /** Iterate a different list for WhatsApp (defaults to `on`). */
        waOn?: string;
        /** Answer key holding the email template name (default 'templateName'). */
        emailTemplateAnswerKey?: string;
        /** Answer key holding the WhatsApp template name (default 'waTemplateName'). */
        waTemplateAnswerKey?: string;
    }
): { nodes: Node[]; edges: Edge[] } {
    const channel = String(answers.channel ?? 'EMAIL');
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let y = opts.y;
    if (channel === 'EMAIL' || channel === 'BOTH') {
        const emailTemplate = answers[opts.emailTemplateAnswerKey ?? 'templateName'] as string;
        nodes.push(makeNode('SEND_EMAIL', `${opts.emailLabelPrefix ?? 'Send'}: ${emailTemplate}`, {
            templateName: emailTemplate,
            on: opts.on,
            forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            ...(opts.templateVars ? { templateVars: opts.templateVars } : {}),
            ...(opts.recipientField ? { recipientField: opts.recipientField } : {}),
        }, opts.x, y));
        y += 180;
    }
    if (channel === 'WHATSAPP' || channel === 'BOTH') {
        const waTemplate = answers[opts.waTemplateAnswerKey ?? 'waTemplateName'] as string;
        nodes.push(makeNode('SEND_WHATSAPP', `WhatsApp: ${waTemplate}`, {
            templateName: waTemplate,
            on: opts.waOn ?? opts.on,
            forEach: { operation: 'SEND_WHATSAPP', eval: "#ctx['item']" },
            ...(opts.templateVars ? { templateVars: opts.templateVars } : {}),
        }, opts.x, y));
    }
    for (let i = 0; i < nodes.length - 1; i++) {
        edges.push(makeEdge(nodes[i]!.id, nodes[i + 1]!.id));
    }
    return { nodes, edges };
}

// ═══════════════════════════════════════════════════
// USE CASE DEFINITIONS
//
// VERIFICATION: Each template below has been traced through:
//   SendEmailNodeHandler.handle() → on (List) → forEach (Map) →
//   createEmailRequest() → extractEmailAddress() → template resolution
//
// Requirements for SEND_EMAIL to work:
//   1. `on` must evaluate to a List of Maps (not Strings)
//   2. Each Map must have an `email` (or `to`, `parentsEmail` etc.) field
//   3. `forEach.eval` must evaluate to a Map (the same item)
//   4. DELAY nodes >60s require the Quartz resume job (currently disabled)
// ═══════════════════════════════════════════════════

export const USE_CASE_TEMPLATES: UseCaseTemplate[] = [

    // ─── 0. AI-call new leads ───
    // When a lead is submitted, place an AI voice-agent call first. The AI
    // outcome (via the end-of-call webhook → AiCallOutcomeProcessor) decides
    // whether a counsellor is assigned — configured in Settings → AI Calling.
    {
        id: 'ai_call_new_lead',
        name: 'AI-call new leads',
        description:
            'When a lead comes in, the AI voice agent calls them first, then routes on the call disposition: interested leads get one status, everyone else a follow-up status. Pick the two statuses in the builder.',
        icon: '📞',
        triggerEvents: ['AUDIENCE_LEAD_SUBMISSION'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            {
                id: 'campaignName',
                label: 'AI agent (optional)',
                helpText:
                    'Name of the AI agent/campaign to use (from Settings → AI Calling → Campaigns). Provider-agnostic — it resolves to the right campaign id for whichever provider is active. Leave blank to use the institute default.',
                type: 'text',
                required: false,
            },
        ],
        generateWorkflow: (answers) => {
            const campaignName = ((answers.campaignName as string) || '').trim();

            // CALL_AI (start) — places the AI voice-agent call. Provider-agnostic: the
            // institute's active provider + this agent NAME resolve to the right campaign id
            // downstream (raw ids are never hardcoded here). The end-of-call webhook →
            // AiCallOutcomeProcessor injects #ctx['callOutcome'] (ASSIGN | STOP | RETRY),
            // #ctx['callDisposition'] (raw) and #ctx['callAnswers'] (the extracted data)
            // onto the workflow context before the engine resumes.
            const callNode = makeNode(
                'CALL_AI',
                'AI Call',
                campaignName ? { campaignName } : {},
                250,
                80,
                true
            );

            // CONDITION — branch on the AI outcome. The engine's ConditionNodeHandler
            // SpEL-evaluates `config.condition`; ASSIGN means the bot qualified the
            // lead as interested. trueLabel/falseLabel are the builder's display
            // labels for the two branches.
            const conditionNode = makeNode(
                'CONDITION',
                'Interested?',
                {
                    condition: "#ctx['callOutcome'] == 'ASSIGN'",
                    trueLabel: 'Interested / assign',
                    falseLabel: 'Not interested / follow-up',
                },
                250,
                220
            );

            // SET_LEAD_STATUS (true branch) — statusKey left blank on purpose so the
            // builder's validation prompts the admin to pick their own status.
            const assignedNode = makeNode(
                'SET_LEAD_STATUS',
                'Set status: interested',
                { statusKey: '' },
                80,
                360
            );

            // SET_LEAD_STATUS (false branch) — likewise blank for the admin to fill.
            const followupNode = makeNode(
                'SET_LEAD_STATUS',
                'Set status: follow-up',
                { statusKey: '' },
                420,
                360
            );

            return {
                nodes: [callNode, conditionNode, assignedNode, followupNode],
                // CONDITION true/false convention (matches WorkflowBuilderService
                // round-trip): the true branch edge is labelled 'true', the false
                // branch edge 'false'. applyEdgesAsRouting pairs them into one
                // `conditional` route (trueNodeId / falseNodeId).
                edges: [
                    makeEdge(callNode.id, conditionNode.id),
                    makeEdge(conditionNode.id, assignedNode.id, 'true'),
                    makeEdge(conditionNode.id, followupNode.id, 'false'),
                ],
                workflowName: 'AI-call new leads',
                workflowDescription:
                    'Place an AI call when a lead is submitted, then route on the call disposition: callOutcome == ASSIGN sets the interested status, otherwise the follow-up status.',
            };
        },
    },

    // ─── 1. Send email to batch students on event ───
    // VERIFIED: fetch_students_by_batch returns {students: [{email, fullName, ...}]}
    //   on="#ctx['students']" → List<Map> ✓, each has email ✓
    {
        id: 'email_batch_students',
        name: 'Message batch students',
        description: 'Fetch students from a batch and send them an email and/or WhatsApp message using a template.',
        icon: '📧',
        triggerEvents: ['LIVE_SESSION_CREATE', 'LIVE_SESSION_START', 'LIVE_SESSION_END', 'LEARNER_BATCH_ENROLLMENT', 'SUB_ORG_MEMBER_ENROLLMENT', 'INSTALLMENT_DUE_REMINDER'],
        workflowType: 'BOTH',
        questions: [
            {
                id: 'batchId',
                label: 'Which batch to fetch students from?',
                helpText: 'Select the batch whose students should receive the message.',
                type: 'batch_select',
                required: true,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which email template to use?',
                helpText: 'Choose the email template that will be sent to each student.',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion({
                helpText: 'Sent to each student\'s mobile number. Variables auto-fill from student fields (fullName, email, ...).',
            }),
            {
                id: 'recipientField',
                label: 'Send email to',
                type: 'select',
                showIf: EMAIL_CHANNEL_SHOWIF,
                options: [
                    { value: '', label: 'Student email (default)' },
                    { value: 'parentsEmail', label: 'Parent email' },
                    { value: 'guardianEmail', label: 'Guardian email' },
                ],
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', `Trigger: ${(triggerEvent ?? 'event').replace(/_/g, ' ').toLowerCase()}`, {
                triggerEvent: triggerEvent ?? '',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 410,
                ...(answers.recipientField ? { recipientField: answers.recipientField as string } : {}),
            });

            return {
                nodes: [triggerNode, queryNode, ...send.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, send.nodes[0]!.id),
                    ...send.edges,
                ],
            };
        },
    },

    // ─── 2. Send confirmation email to audience lead ───
    {
        id: 'audience_lead_confirmation',
        name: 'Send lead confirmation message',
        description: 'When someone fills your audience form, automatically send them a confirmation email and/or WhatsApp message.',
        icon: '📝',
        triggerEvents: ['AUDIENCE_LEAD_SUBMISSION'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which email template to send?',
                helpText: 'This template will be sent to the person who filled the form.',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion({
                helpText: 'Sent to the phone number the lead entered on the form. Variables auto-fill from the form\'s custom fields.',
            }),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Audience form submitted', {
                triggerEvent: triggerEvent ?? 'AUDIENCE_LEAD_SUBMISSION',
            }, 250, 50, true);

            // respondentEmailRequests = list of email requests for the LEAD
            // (always populated by AudienceService for any lead submission).
            // adminEmailRequests = list for notifying admins (often empty when
            // audience.toNotify is not configured) — wrong list for "send to lead".
            //
            // templateVars maps the sample template's placeholder names to the
            // actual context fields. Without these, {{parentName}} stays literal.
            // Resolution order in SendEmailNodeHandler (and, since the WhatsApp
            // enrichment, SendWhatsAppNodeHandler too):
            //   item field → context field → customFields[<key>] → SpEL → literal
            //
            // WhatsApp iterates {#ctx['user']} instead — respondentEmailRequests
            // items only carry to/subject/body (no phone), while the lead's
            // UserDTO carries mobile_number (extracted by the handler).
            const send = makeChannelSendNodes(answers, {
                on: "#ctx['respondentEmailRequests']",
                waOn: "{#ctx['user']}",
                x: 250,
                y: 230,
                templateVars: {
                    parentName: 'Full Name',     // resolves from customFields["Full Name"]
                    fullName: 'Full Name',       // alias, in case template uses {{fullName}}
                    name: 'Full Name',           // canonical spelling — the default scaffold uses {{name}}
                    email: 'Email',              // resolves from customFields["Email"]
                    mobileNumber: 'Phone Number',// resolves from customFields["Phone Number"]
                    instituteName: 'instituteName', // resolves from context
                },
            });

            return {
                nodes: [triggerNode, ...send.nodes],
                edges: [makeEdge(triggerNode.id, send.nodes[0]!.id), ...send.edges],
                workflowDescription: 'Send confirmation message when a lead submits the audience form.',
            };
        },
    },

    // ─── 3. Payment failed retry email ───
    // VERIFIED: PaymentLogService puts packageSessionIds as List<String> in context
    //   fetch_ssigm_by_package natively handles List for packageSessionIds ✓
    //   Output: ssigm_list with email, fullName (camelCase aliases added) ✓
    {
        id: 'payment_failed_email',
        name: 'Payment failed notification',
        description: 'Send an email to the user when their payment fails, with retry instructions.',
        icon: '💳',
        triggerEvents: ['PAYMENT_FAILED'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which email template to send?',
                helpText: 'Template for the payment failure notification.',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Payment failed', {
                triggerEvent: triggerEvent ?? 'PAYMENT_FAILED',
            }, 250, 50, true);

            // Use fetch_ssigm_by_package because PaymentLogService puts packageSessionIds as List<String>
            // fetch_ssigm_by_package handles List natively, fetch_students_by_batch expects String
            const queryNode = makeNode('QUERY', 'Fetch student details', {
                prebuiltKey: 'fetch_ssigm_by_package',
                params: { packageSessionIds: "#ctx['packageSessionIds']" },
            }, 250, 230);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['ssigm_list']",
                x: 250,
                y: 410,
            });

            return {
                nodes: [triggerNode, queryNode, ...send.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, send.nodes[0]!.id),
                    ...send.edges,
                ],
            };
        },
    },

    // ─── 4. Abandoned cart reminder ───
    // VERIFIED: fetch_students_by_batch returns students with email ✓
    //   packageSessionId comes from LearnerEnrollmentEntryService context ✓
    {
        id: 'abandoned_cart_reminder',
        name: 'Abandoned cart reminder',
        description: 'When someone starts enrollment but doesn\'t complete payment, send them a reminder email.',
        icon: '🛒',
        triggerEvents: ['ABANDONED_CART'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which reminder email template?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Abandoned cart', {
                triggerEvent: triggerEvent ?? 'ABANDONED_CART',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch student details', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: "#ctx['packageSessionId']" },
            }, 250, 230);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 410,
            });

            return {
                nodes: [triggerNode, queryNode, ...send.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, send.nodes[0]!.id),
                    ...send.edges,
                ],
            };
        },
    },

    // ─── 5. Invite-related: Email batch students when invite is created ───
    // VERIFIED: fetch_students_by_batch returns students with email ✓
    //   User selects which batch to notify about the invite ✓
    {
        id: 'invite_notify_batch',
        name: 'Notify batch about new invite',
        description: 'When a new enrollment invite is created, email students in a batch about it.',
        icon: '✉️',
        triggerEvents: ['INVITE_CREATE', 'INVITE_FORM_FILL'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            {
                id: 'batchId',
                label: 'Which batch to notify?',
                type: 'batch_select',
                required: true,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which email template?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', `Trigger: ${(triggerEvent ?? 'invite event').replace(/_/g, ' ').toLowerCase()}`, {
                triggerEvent: triggerEvent ?? 'INVITE_CREATE',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 410,
            });

            return {
                nodes: [triggerNode, queryNode, ...send.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, send.nodes[0]!.id),
                    ...send.edges,
                ],
            };
        },
    },

    // ─── 6. Scheduled: Daily batch report email ───
    {
        id: 'scheduled_batch_report',
        name: 'Daily/weekly attendance report',
        description: 'Send a batch attendance report email to admin on a schedule.',
        icon: '📊',
        triggerEvents: [],
        workflowType: 'SCHEDULED',
        questions: [
            {
                id: 'batchId',
                label: 'Which batch(es) to report on?',
                helpText: 'Pick one or more batches. Leave all unchecked to report across every active batch in your institute.',
                type: 'batch_multi_select',
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which email template for the report?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
            {
                id: 'daysBack',
                label: 'Report covers last how many days?',
                type: 'number',
                defaultValue: 7,
            },
            {
                id: 'excludeToday',
                label: "Include today's classes?",
                helpText:
                    'For morning-sent emails: pick "exclude today" so the report covers up through yesterday only. '
                    + "This keeps the email and the View Full Report deep-link consistent — they won't drift "
                    + "apart as more classes happen later in the day. "
                    + "Pick \"include today\" only if the workflow runs in the evening or you want a partial-day snapshot.",
                type: 'select',
                required: true,
                defaultValue: 'exclude',
                options: [
                    { value: 'exclude', label: "Exclude today (recommended — N full days ending yesterday)" },
                    { value: 'include', label: "Include today (window ends now — may show a partial day)" },
                ],
            },
        ],
        generateWorkflow: (answers) => {
            // batchId may be a string (legacy single-select) or string[] (multi-select).
            // Backend QueryServiceImpl.fetchBatchAttendanceReport splits on "," — emit
            // a CSV. Empty value triggers the "all active batches" fallback.
            const batchCsv = Array.isArray(answers.batchId)
                ? (answers.batchId as string[]).filter(Boolean).join(',')
                : (answers.batchId as string | undefined) ?? '';

            const queryNode = makeNode('QUERY', 'Fetch attendance report', {
                prebuiltKey: 'fetch_batch_attendance_report',
                params: {
                    ...(batchCsv ? { batchId: batchCsv } : {}),
                    daysBack: answers.daysBack ?? 7,
                    // Only set excludeToday=true when the admin picked "exclude" (default).
                    // When "include" is picked, omit the param entirely so the backend
                    // uses its original semantics (today + N days back).
                    ...(answers.excludeToday !== 'include' ? { excludeToday: true } : {}),
                },
            }, 250, 50, true);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 230,
            });

            return {
                nodes: [queryNode, ...send.nodes],
                edges: [makeEdge(queryNode.id, send.nodes[0]!.id), ...send.edges],
            };
        },
    },

    // ─── 7. Scheduled: Audience follow-up ───
    {
        id: 'scheduled_audience_followup',
        name: 'Audience follow-up emails',
        description: 'Send follow-up emails to audience leads who submitted forms in the last N days.',
        icon: '🔄',
        triggerEvents: [],
        workflowType: 'SCHEDULED',
        questions: [
            {
                id: 'audienceId',
                label: 'Which audience/campaign(s)?',
                helpText: 'Pick one or more campaigns. Leave all unchecked to follow up across every campaign.',
                type: 'audience_select',
            },
            {
                id: 'daysAgo',
                label: 'Send follow-up exactly how many days after submission?',
                helpText: 'Targets leads whose submission date is exactly this many days ago. Schedule this workflow daily. To follow up on day 3, 5, and 7 create three separate workflows.',
                type: 'number',
                defaultValue: 3,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which follow-up email template?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion({
                helpText: 'Sent to each lead\'s phone number from the form. Variables auto-fill from the lead\'s fields.',
            }),
        ],
        generateWorkflow: (answers) => {
            // audienceId may be a string (legacy single-select) or string[] (multi-select).
            // Backend QueryServiceImpl splits on "," — emit a CSV. Empty value
            // triggers the institute-wide fallback in fetchAudienceResponsesFiltered.
            const audienceCsv = Array.isArray(answers.audienceId)
                ? (answers.audienceId as string[]).filter(Boolean).join(',')
                : (answers.audienceId as string | undefined) ?? '';

            const queryNode = makeNode('QUERY', 'Fetch recent leads', {
                prebuiltKey: 'fetch_audience_responses_filtered',
                params: {
                    ...(audienceCsv ? { audienceId: audienceCsv } : {}),
                    daysAgo: answers.daysAgo ?? 3,
                },
            }, 250, 50, true);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['leads']",
                x: 250,
                y: 230,
            });

            return {
                nodes: [queryNode, ...send.nodes],
                edges: [makeEdge(queryNode.id, send.nodes[0]!.id), ...send.edges],
            };
        },
    },

    // ─── 8. Scheduled: Fee installment reminders ───
    // VERIFIED: getUpcomingFeeInstallments returns {feePaymentList: [{email, studentName, ...}]}
    //   Items have email (recipient or parent) ✓, has amount/dueDate for template vars ✓
    {
        id: 'scheduled_fee_reminder',
        name: 'Fee installment reminders',
        description: 'Send reminders to students with upcoming fee installments.',
        icon: '💰',
        triggerEvents: [],
        workflowType: 'SCHEDULED',
        questions: [
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which email template for the reminder?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
        ],
        generateWorkflow: (answers) => {
            const queryNode = makeNode('QUERY', 'Fetch upcoming installments', {
                prebuiltKey: 'getUpcomingFeeInstallments',
                params: {},
            }, 250, 50, true);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['feePaymentList']",
                x: 250,
                y: 230,
            });

            return {
                nodes: [queryNode, ...send.nodes],
                edges: [makeEdge(queryNode.id, send.nodes[0]!.id), ...send.edges],
            };
        },
    },

    // ═══════════════════════════════════════════════════
    // ENROLLMENT & ONBOARDING USE CASES
    // ═══════════════════════════════════════════════════

    // ─── 9. Welcome email to newly enrolled student ───
    {
        id: 'welcome_enrolled_student',
        name: 'Welcome email to student',
        description: 'Send a welcome email to a student right after they are enrolled in a batch.',
        icon: '🎓',
        triggerEvents: ['LEARNER_BATCH_ENROLLMENT', 'SUB_ORG_MEMBER_ENROLLMENT'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which welcome email template?',
                helpText: 'This will be sent immediately after enrollment.',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion({
                helpText: 'Sent to the new student\'s mobile number right after enrollment. Variables like fullName/username auto-fill from the enrolled user.',
            }),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Student enrolled', {
                triggerEvent: triggerEvent ?? 'LEARNER_BATCH_ENROLLMENT',
            }, 250, 50, true);

            // Wrap the just-enrolled user in a single-element list so SEND_EMAIL /
            // SEND_WHATSAPP iterate once. We deliberately do NOT fetch batch students
            // here — the welcome message is for the one user who just enrolled, and
            // only the trigger context has their plaintext credentials. Iterating over
            // the whole batch would message everyone the same password (wrong) and
            // would lose access to {{username}}/{{password}} entirely (the
            // students-by-batch query doesn't return those fields).
            //
            // Pre-populate the placeholder → context-field mapping so the user
            // doesn't have to do it manually in the workflow builder. Each value
            // is a SpEL expression evaluated against the workflow context at
            // send time. The user can override any of these in the node config.
            const send = makeChannelSendNodes(answers, {
                on: "{#ctx['user']}",
                x: 250,
                y: 230,
                recipientField: 'email',
                templateVars: {
                    fullName: "#ctx['user'].fullName",
                    username: "#ctx['user'].username",
                    password: "#ctx['user'].password",
                    email: "#ctx['user'].email",
                    instituteName: "#ctx['instituteName']",
                },
            });

            return {
                nodes: [triggerNode, ...send.nodes],
                edges: [makeEdge(triggerNode.id, send.nodes[0]!.id), ...send.edges],
                workflowDescription: 'Send welcome message when a student enrolls.',
            };
        },
    },

    // Template #10 REMOVED: SEND_EMAIL requires each item in `on` list to be a Map with `email` field.
    // Static admin email strings are rejected by the handler. Needs backend enhancement to support.

    // ─── 11. Send to parents instead of students ───
    {
        id: 'email_parents_batch',
        name: 'Email parents of batch students',
        description: 'Fetch students from a batch and send an email to their parents instead.',
        icon: '👪',
        triggerEvents: ['LIVE_SESSION_CREATE', 'LIVE_SESSION_START', 'LEARNER_BATCH_ENROLLMENT', 'SUB_ORG_MEMBER_ENROLLMENT', 'INSTALLMENT_DUE_REMINDER'],
        workflowType: 'BOTH',
        questions: [
            {
                id: 'batchId',
                label: 'Which batch?',
                type: 'batch_select',
                required: true,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which email template?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion({
                helpText: 'Note: the student roster only stores the student\'s mobile number, so the WhatsApp message goes to the student\'s phone (parent emails stay email-only).',
            }),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', `Trigger: ${(triggerEvent ?? 'event').replace(/_/g, ' ').toLowerCase()}`, {
                triggerEvent: triggerEvent ?? '',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 410,
                emailLabelPrefix: 'Send to parents',
                recipientField: 'parentsEmail',
            });

            return {
                nodes: [triggerNode, queryNode, ...send.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, send.nodes[0]!.id),
                    ...send.edges,
                ],
            };
        },
    },

    // ─── 12. Member termination notice ───
    {
        id: 'termination_notice',
        name: 'Member removal notification',
        description: 'Notify the student/member when they are removed from a sub-organization.',
        icon: '🚪',
        triggerEvents: ['SUB_ORG_MEMBER_TERMINATION'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which notification template?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Member removed', {
                triggerEvent: triggerEvent ?? 'SUB_ORG_MEMBER_TERMINATION',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch student details', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: "#ctx['packageSessionIds']" },
            }, 250, 230);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 410,
            });

            return {
                nodes: [triggerNode, queryNode, ...send.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, send.nodes[0]!.id),
                    ...send.edges,
                ],
            };
        },
    },

    // ═══════════════════════════════════════════════════
    // LIVE SESSION USE CASES
    // ═══════════════════════════════════════════════════

    // ─── 13. Session start reminder ───
    {
        id: 'session_start_reminder',
        name: 'Live session start reminder',
        description: 'When a live session starts, send a reminder email to all students in a batch.',
        icon: '🔴',
        triggerEvents: ['LIVE_SESSION_START'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            {
                id: 'batchId',
                label: 'Which batch to notify?',
                type: 'batch_select',
                required: true,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which reminder template?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Session started', {
                triggerEvent: triggerEvent ?? 'LIVE_SESSION_START',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 410,
            });

            return {
                nodes: [triggerNode, queryNode, ...send.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, send.nodes[0]!.id),
                    ...send.edges,
                ],
                workflowDescription: 'Notify batch students when a live session starts.',
            };
        },
    },

    // ─── 14. Post-session follow-up ───
    {
        id: 'post_session_followup',
        name: 'Post-session follow-up',
        description: 'After a live session ends, send a follow-up email (recording link, feedback form, etc.).',
        icon: '📹',
        triggerEvents: ['LIVE_SESSION_END'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            {
                id: 'batchId',
                label: 'Which batch to email?',
                type: 'batch_select',
                required: true,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which follow-up template?',
                helpText: 'Include recording link, feedback form, or next session info.',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Session ended', {
                triggerEvent: triggerEvent ?? 'LIVE_SESSION_END',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 410,
            });

            return {
                nodes: [triggerNode, queryNode, ...send.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, send.nodes[0]!.id),
                    ...send.edges,
                ],
                workflowDescription: 'Send follow-up message after live session ends.',
            };
        },
    },

    // Template #15 REMOVED: LIVE_SESSION_FORM_SUBMISSION trigger not integrated in any service yet.
    // Context data structure unknown — can't verify template will work.

    // ═══════════════════════════════════════════════════
    // CRM & LEAD NURTURING USE CASES
    // ═══════════════════════════════════════════════════

    // Template #16 REMOVED: Same issue as #10 — static email not supported by SEND_EMAIL handler.

    // ─── 17. Lead follow-up with different template ───
    // VERIFIED: respondentEmailRequests is List<Map> with the lead's email,
    //   always populated by AudienceService for each form submission.
    {
        id: 'lead_followup_email',
        name: 'Lead follow-up email',
        description: 'Send a follow-up or nurture email to leads who fill your audience form (use a scheduled workflow for delayed follow-ups).',
        icon: '⏰',
        triggerEvents: ['AUDIENCE_LEAD_SUBMISSION'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which follow-up template?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion({
                helpText: 'Sent to the phone number the lead entered on the form. Variables auto-fill from the form\'s custom fields.',
            }),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Lead submitted', {
                triggerEvent: triggerEvent ?? 'AUDIENCE_LEAD_SUBMISSION',
            }, 250, 50, true);

            // WhatsApp iterates {#ctx['user']} — respondentEmailRequests items only
            // carry to/subject/body (no phone); the lead's UserDTO carries mobile_number.
            const send = makeChannelSendNodes(answers, {
                on: "#ctx['respondentEmailRequests']",
                waOn: "{#ctx['user']}",
                x: 250,
                y: 230,
                emailLabelPrefix: 'Follow-up',
                templateVars: {
                    parentName: 'Full Name',
                    fullName: 'Full Name',
                    email: 'Email',
                    mobileNumber: 'Phone Number',
                    instituteName: 'instituteName',
                },
            });

            return {
                nodes: [triggerNode, ...send.nodes],
                edges: [makeEdge(triggerNode.id, send.nodes[0]!.id), ...send.edges],
            };
        },
    },

    // ─── 18. Membership expiry reminder ───
    {
        id: 'membership_expiry_reminder',
        name: 'Membership expiry reminder',
        description: 'Send a renewal reminder when a membership or subscription is about to expire.',
        icon: '⚠️',
        triggerEvents: ['MEMBERSHIP_EXPIRY'],
        workflowType: 'BOTH',
        questions: [
            {
                id: 'daysUntilExpiry',
                label: 'How many days before expiry to send reminder?',
                type: 'number',
                defaultValue: 7,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which reminder template?',
                helpText: 'Template for the membership renewal reminder.',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Membership expiring', {
                triggerEvent: triggerEvent ?? 'MEMBERSHIP_EXPIRY',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch expiring memberships', {
                prebuiltKey: 'fetch_expiring_memberships',
                params: { daysUntilExpiry: answers.daysUntilExpiry ?? 7 },
            }, 250, 230);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['expiringMemberships']",
                x: 250,
                y: 410,
            });

            return {
                nodes: [triggerNode, queryNode, ...send.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, send.nodes[0]!.id),
                    ...send.edges,
                ],
                workflowDescription: 'Send renewal reminders for expiring memberships.',
            };
        },
    },

    // ═══════════════════════════════════════════════════
    // ASSESSMENT USE CASES
    // ═══════════════════════════════════════════════════

    // ─── 19. Notify students about new assessment ───
    {
        id: 'assessment_created_notify',
        name: 'Notify students about new assessment',
        description: 'When a new assessment is created, email students in a batch to let them know.',
        icon: '📝',
        triggerEvents: ['ASSESSMENT_CREATE'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            {
                id: 'batchId',
                label: 'Which batch to notify?',
                type: 'batch_select',
                required: true,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which notification template?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Assessment created', {
                triggerEvent: triggerEvent ?? 'ASSESSMENT_CREATE',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 410,
            });

            return {
                nodes: [triggerNode, queryNode, ...send.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, send.nodes[0]!.id),
                    ...send.edges,
                ],
                workflowDescription: 'Notify batch students about a new assessment.',
            };
        },
    },

    // ─── 20. Assessment: email batch students ───
    // VERIFIED: Same pattern as #1 — fetch_students_by_batch returns email ✓
    //   Note: ASSESSMENT triggers are not yet integrated in services
    {
        id: 'assessment_email_batch',
        name: 'Assessment: email batch students',
        description: 'When an assessment event fires, email students in a specific batch.',
        icon: '🏆',
        triggerEvents: ['ASSESSMENT_END', 'ASSESSMENT_FORM_SUBMISSION'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            {
                id: 'batchId',
                label: 'Which batch to notify?',
                type: 'batch_select',
                required: true,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which email template?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', `Trigger: ${(triggerEvent ?? 'assessment event').replace(/_/g, ' ').toLowerCase()}`, {
                triggerEvent: triggerEvent ?? 'ASSESSMENT_END',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 410,
            });

            return {
                nodes: [triggerNode, queryNode, ...send.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, send.nodes[0]!.id),
                    ...send.edges,
                ],
            };
        },
    },

    // ─── 21. Assessment start reminder ───
    {
        id: 'assessment_start_notify',
        name: 'Assessment start notification',
        description: 'Notify batch students when an assessment window opens / a student starts an attempt.',
        icon: '📋',
        triggerEvents: ['ASSESSMENT_START'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            {
                id: 'batchId',
                label: 'Which batch to notify?',
                type: 'batch_select',
                required: true,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which template?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Assessment started', {
                triggerEvent: triggerEvent ?? 'ASSESSMENT_START',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 410,
            });

            return {
                nodes: [triggerNode, queryNode, ...send.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, send.nodes[0]!.id),
                    ...send.edges,
                ],
            };
        },
    },

    // ═══════════════════════════════════════════════════
    // SCHEDULED REPORTS & AUTOMATION
    // ═══════════════════════════════════════════════════

    // ─── 22. Scheduled: Membership expiry check ───
    {
        id: 'scheduled_expiry_check',
        name: 'Expiring membership emails',
        description: 'Run daily/weekly to find memberships expiring soon and send renewal reminders.',
        icon: '🔁',
        triggerEvents: [],
        workflowType: 'SCHEDULED',
        questions: [
            {
                id: 'daysUntilExpiry',
                label: 'How many days before expiry to warn?',
                type: 'number',
                defaultValue: 7,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which renewal reminder template?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion(),
        ],
        generateWorkflow: (answers) => {
            const queryNode = makeNode('QUERY', 'Fetch expiring memberships', {
                prebuiltKey: 'fetch_expiring_memberships',
                params: { daysUntilExpiry: answers.daysUntilExpiry ?? 7 },
            }, 250, 50, true);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['expiringMemberships']",
                x: 250,
                y: 230,
            });

            return {
                nodes: [queryNode, ...send.nodes],
                edges: [makeEdge(queryNode.id, send.nodes[0]!.id), ...send.edges],
                workflowDescription: `Send renewal reminders ${answers.daysUntilExpiry} days before membership expires.`,
            };
        },
    },

    // ─── 23. Scheduled: Batch engagement summary ───
    {
        id: 'scheduled_engagement_summary',
        name: 'Student engagement report',
        description: 'Send each student a personalized summary of their attendance and engagement.',
        icon: '📈',
        triggerEvents: [],
        workflowType: 'SCHEDULED',
        questions: [
            {
                id: 'batchId',
                label: 'Which batch?',
                type: 'batch_select',
                required: true,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which report template?',
                helpText: 'Template with variables like {{attendancePercentage}}, {{sessionsAttended}}.',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion({
                helpText: 'Variables like attendancePercentage and sessionsAttended auto-fill from each student\'s report data.',
            }),
            {
                id: 'daysBack',
                label: 'Report covers last how many days?',
                type: 'number',
                defaultValue: 7,
            },
            {
                id: 'excludeToday',
                label: "Include today's classes?",
                helpText:
                    'For morning-sent emails: pick "exclude today" so numbers in the email match the deep-link view '
                    + 'even after more classes happen during the day.',
                type: 'select',
                required: true,
                defaultValue: 'exclude',
                options: [
                    { value: 'exclude', label: "Exclude today (recommended for morning sends)" },
                    { value: 'include', label: "Include today (may show a partial day)" },
                ],
            },
        ],
        generateWorkflow: (answers) => {
            const queryNode = makeNode('QUERY', 'Fetch student engagement', {
                prebuiltKey: 'fetch_batch_attendance_report',
                params: {
                    batchId: answers.batchId as string,
                    daysBack: answers.daysBack ?? 7,
                    ...(answers.excludeToday !== 'include' ? { excludeToday: true } : {}),
                },
            }, 250, 50, true);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 230,
            });

            return {
                nodes: [queryNode, ...send.nodes],
                edges: [makeEdge(queryNode.id, send.nodes[0]!.id), ...send.edges],
                workflowDescription: `Weekly engagement report for batch students (last ${answers.daysBack} days).`,
            };
        },
    },

    // ─── 24. Scheduled: Parents attendance update ───
    {
        id: 'scheduled_parents_attendance',
        name: 'Send attendance update to parents',
        description: 'Send parents a weekly update on their child\'s attendance and engagement.',
        icon: '👨‍👩‍👧',
        triggerEvents: [],
        workflowType: 'SCHEDULED',
        questions: [
            {
                id: 'batchId',
                label: 'Which batch?',
                type: 'batch_select',
                required: true,
            },
            channelQuestion(),
            {
                id: 'templateName',
                label: 'Which template for parents?',
                type: 'template_select',
                required: true,
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion({
                helpText: 'Note: the roster only stores the student\'s mobile number, so the WhatsApp update goes to the student\'s phone (parent emails stay email-only).',
            }),
            {
                id: 'daysBack',
                label: 'Report covers last how many days?',
                type: 'number',
                defaultValue: 7,
            },
            {
                id: 'excludeToday',
                label: "Include today's classes?",
                helpText:
                    'For morning-sent emails: pick "exclude today" so numbers in the email match the deep-link view '
                    + 'even after more classes happen during the day.',
                type: 'select',
                required: true,
                defaultValue: 'exclude',
                options: [
                    { value: 'exclude', label: "Exclude today (recommended for morning sends)" },
                    { value: 'include', label: "Include today (may show a partial day)" },
                ],
            },
        ],
        generateWorkflow: (answers) => {
            const queryNode = makeNode('QUERY', 'Fetch student data', {
                prebuiltKey: 'fetch_batch_attendance_report',
                params: {
                    batchId: answers.batchId as string,
                    daysBack: answers.daysBack ?? 7,
                    ...(answers.excludeToday !== 'include' ? { excludeToday: true } : {}),
                },
            }, 250, 50, true);

            const send = makeChannelSendNodes(answers, {
                on: "#ctx['students']",
                x: 250,
                y: 230,
                emailLabelPrefix: 'Send to parents',
                recipientField: 'parentsEmail',
            });

            return {
                nodes: [queryNode, ...send.nodes],
                edges: [makeEdge(queryNode.id, send.nodes[0]!.id), ...send.edges],
                workflowDescription: `Weekly attendance update sent to parents (last ${answers.daysBack} days).`,
            };
        },
    },

    // Template #25: Onboarding drip REMOVED — uses multi-day delays which require
    // the Quartz resume job (currently disabled). Will be re-added when persistent
    // delay is enabled. For now, create separate scheduled workflows for Day 3 and Day 7.

    // ─── 26. Live class ended: post-class email to present & absent students ───
    // VERIFIED: backend prebuilt query fetch_live_session_attendance returns
    //   { presentStudents: [{email, fullName, sessionTitle, instituteName, ...}],
    //     absentStudents: [...] }
    // Each item is a Map with `email` ✓, so SEND_EMAIL handler iterates correctly.
    // Every key on each item auto-becomes a placeholder via the per-item enrichment
    // in SendEmailNodeHandler — no templateVars mapping needed. Placeholders
    // available in the chosen email template:
    //   {{fullName}}  {{name}}  {{sessionTitle}}  {{instituteName}}
    //   {{date}}  {{time}}  {{attendanceStatus}}  {{mobileNumber}}
    //   Present-only attendance metrics (zeros/blank for absent students):
    //   {{joinTime}}  {{attendedMinutes}}  {{attendancePercentage}}  {{sessionDurationMinutes}}
    //   Pre-rendered HTML snippet — empty string when provider hasn't synced
    //   join-time data, so the email cleanly omits the attendance section:
    //   {{attendanceBlockHtml}}
    {
        id: 'live_session_end_recap',
        name: 'Post-class email to present & absent students',
        description: 'When any live class in your institute ends, send one email to students who attended and a different one to students who missed it.',
        icon: '📨',
        triggerEvents: ['LIVE_SESSION_END'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            channelQuestion(),
            {
                id: 'presentTemplate',
                label: 'Email template for students who attended',
                helpText: 'Sent to learners marked PRESENT in the class.',
                type: 'template_select',
                required: true,
                sampleTemplateKey: 'live_session_recap_present',
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            {
                id: 'absentTemplate',
                label: 'Email template for students who missed it',
                helpText: 'Sent to learners marked ABSENT in the class.',
                type: 'template_select',
                required: true,
                sampleTemplateKey: 'live_session_recap_absent',
                showIf: EMAIL_CHANNEL_SHOWIF,
            },
            whatsappTemplateQuestion({
                id: 'waPresentTemplate',
                label: 'WhatsApp template for students who attended',
                helpText: 'Sent to learners marked PRESENT. Variables like fullName/sessionTitle auto-fill from attendance data.',
            }),
            whatsappTemplateQuestion({
                id: 'waAbsentTemplate',
                label: 'WhatsApp template for students who missed it',
                helpText: 'Sent to learners marked ABSENT. Variables like fullName/sessionTitle auto-fill from attendance data.',
            }),
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Live class ended', {
                triggerEvent: triggerEvent ?? 'LIVE_SESSION_END',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch attendance', {
                prebuiltKey: 'fetch_live_session_attendance',
                params: {
                    sessionId: "#ctx['sessionId']",
                    scheduleId: "#ctx['scheduleId']",
                },
            }, 250, 230);

            const presentSend = makeChannelSendNodes(answers, {
                on: "#ctx['presentStudents']",
                x: 50,
                y: 410,
                emailLabelPrefix: 'Send to present',
                emailTemplateAnswerKey: 'presentTemplate',
                waTemplateAnswerKey: 'waPresentTemplate',
            });

            const absentSend = makeChannelSendNodes(answers, {
                on: "#ctx['absentStudents']",
                x: 450,
                y: 410,
                emailLabelPrefix: 'Send to absent',
                emailTemplateAnswerKey: 'absentTemplate',
                waTemplateAnswerKey: 'waAbsentTemplate',
            });

            return {
                nodes: [triggerNode, queryNode, ...presentSend.nodes, ...absentSend.nodes],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, presentSend.nodes[0]!.id, 'present'),
                    makeEdge(queryNode.id, absentSend.nodes[0]!.id, 'absent'),
                    ...presentSend.edges,
                    ...absentSend.edges,
                ],
                workflowDescription: 'Post-class recap messages to present and absent students for every live class in the institute.',
            };
        },
    },

    // ─── 27. Send enrollment data to external webhook (Pabbly / Zapier / n8n / etc.) ───
    // Single HTTP_REQUEST node — no QUERY needed, because LEARNER_BATCH_ENROLLMENT
    // already puts user (UserDTO with fullName/email/mobileNumber) and packageName
    // (added by StudentRegistrationManager) on the workflow context. triggerTime is
    // injected by WorkflowTriggerService.
    //
    // Scoping:
    //   - "institute" → no filter, fires on every enrollment in the institute
    //   - "course"    → prepended CONDITION node that checks #ctx['packageId']
    //                   == <chosen packageId>. Uses CONDITION instead of trigger-level
    //                   scoping because LEARNER_BATCH_ENROLLMENT fires per-batch
    //                   (packageSessionId) and there's no trigger-matching layer for
    //                   packageId today. CONDITION adds one tiny check per enrollment
    //                   globally — negligible overhead.
    //
    // Payload: admin-editable JSON object. Values can be SpEL expressions referencing
    // #ctx['...']. The HTTP_REQUEST body evaluator (HttpHelperUtils.evaluateBodyExpressions)
    // SpEL-evaluates any string containing #ctx or #root; non-SpEL values pass through
    // as literals.
    {
        id: 'webhook_on_enrollment',
        name: 'Send enrollment data to webhook',
        description: 'When a learner enrolls, POST their details to an external webhook (Pabbly, Zapier, n8n, Make, etc.). Payload is fully configurable.',
        icon: '🔗',
        triggerEvents: ['LEARNER_BATCH_ENROLLMENT'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            {
                id: 'webhookUrl',
                label: 'Webhook URL',
                helpText: 'The POST endpoint that will receive the enrollment data. Get this from your Pabbly Connect workflow, Zapier Catch Hook, n8n Webhook node, etc.',
                type: 'text',
                required: true,
            },
            {
                id: 'scope',
                label: 'When should this fire?',
                helpText: 'Pick "institute-wide" to fire on every learner enrollment in your institute, or "specific course" to fire only when learners enroll in one chosen course.',
                type: 'select',
                required: true,
                defaultValue: 'institute',
                options: [
                    { value: 'institute', label: 'For every enrollment in this institute' },
                    { value: 'course', label: 'Only when learners enroll in a specific course' },
                ],
            },
            {
                id: 'courseId',
                label: 'Which course?',
                helpText: 'The webhook will only fire when learners enroll in batches of this course.',
                type: 'package_select',
                required: true,
                showIf: { questionId: 'scope', values: ['course'] },
            },
            {
                id: 'payloadJson',
                label: 'Webhook payload (JSON)',
                type: 'json_payload',
                required: true,
                jsonPayloadHint:
                    'Edit the JSON below. Each value can be a literal string OR a SpEL expression. ' +
                    'Available variables on the context:  ' +
                    '#ctx[\'triggerTime\'] (ISO timestamp), ' +
                    '#ctx[\'user\'].fullName / .email / .mobileNumber / .username, ' +
                    '#ctx[\'packageName\'] (course), ' +
                    '#ctx[\'packageId\'], #ctx[\'packageSessionIds\'] (batch), ' +
                    '#ctx[\'instituteName\'], #ctx[\'instituteId\'], ' +
                    '#ctx[\'enrollmentStatus\'] (SSIGM status: ACTIVE/INVITED/...), ' +
                    '#ctx[\'enrollmentId\'], #ctx[\'enrolledAt\'], ' +
                    '#ctx[\'paymentStatus\'] (PAID/PENDING/null), #ctx[\'paymentOrderId\'], ' +
                    '#ctx[\'paymentAmount\'], #ctx[\'paymentCurrency\'], #ctx[\'paymentVendor\'], ' +
                    '#ctx[\'paymentDate\'], #ctx[\'hasPayment\'] (boolean).',
                defaultValue: JSON.stringify(
                    {
                        Timestamp: "#ctx['triggerTime']",
                        Name: "#ctx['user'].fullName",
                        Phone: "#ctx['user'].mobileNumber",
                        Email: "#ctx['user'].email",
                        CourseName: "#ctx['packageName']",
                        EnrollmentStatus: "#ctx['enrollmentStatus']",
                        PaymentStatus: "#ctx['paymentStatus']",
                        PaymentOrderId: "#ctx['paymentOrderId']",
                        PaymentAmount: "#ctx['paymentAmount']",
                        PaymentCurrency: "#ctx['paymentCurrency']",
                    },
                    null,
                    2,
                ),
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Student enrolled', {
                triggerEvent: triggerEvent ?? 'LEARNER_BATCH_ENROLLMENT',
            }, 250, 50, true);

            // QUERY node fetches the learner's SSIGM enrollment status + latest
            // PaymentLog and merges them onto the context (enrollmentStatus,
            // paymentStatus, paymentOrderId, paymentAmount, paymentCurrency, etc.).
            // Without this, the trigger context only has user + packageName — payment
            // & enrollment status would render as literal {{...}} in the webhook body.
            // The QUERY auto-injects instituteId; userId and packageSessionId are
            // pulled from the trigger context via SpEL.
            const enrichNode = makeNode('QUERY', 'Fetch enrollment & payment status', {
                prebuiltKey: 'fetch_enrollment_details',
                params: {
                    userId: "#ctx['user'].id",
                    packageSessionId: "#ctx['packageSessionIds']",
                },
            }, 250, 200);

            // Parse the admin-supplied JSON payload. The wizard validates live, but
            // be defensive on generate — fall back to a minimal default if the JSON
            // is somehow unparseable at this point so we don't emit an empty body.
            let body: Record<string, unknown> = {};
            try {
                const raw = (answers.payloadJson as string) ?? '{}';
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    body = parsed as Record<string, unknown>;
                }
            } catch {
                body = {
                    Timestamp: "#ctx['triggerTime']",
                    Email: "#ctx['user'].email",
                    Name: "#ctx['user'].fullName",
                };
            }

            // Course-level scoping uses the HTTP_REQUEST node's built-in `condition`
            // field — the handler evaluates it before firing and skips the request
            // when false. This avoids needing a separate CONDITION node (and avoids
            // the wizard's auto-routing inserting wrong goto entries on a CONDITION).
            // For institute-wide scope, no condition is set.
            const courseCondition =
                answers.scope === 'course' && answers.courseId
                    ? `#ctx['packageId'] == '${String(answers.courseId).replace(/'/g, "\\'")}'`
                    : undefined;

            const webhookNode = makeNode('HTTP_REQUEST', 'POST enrollment to webhook', {
                // Plain string — the HTTP_REQUEST handler now passes literals through
                // (only invokes SpEL when the value contains #, T(, or '...').
                resultKey: 'webhookResponse',
                config: {
                    requestType: 'EXTERNAL',
                    method: 'POST',
                    url: answers.webhookUrl as string,
                    ...(courseCondition ? { condition: courseCondition } : {}),
                    body,
                },
            }, 250, 380);

            return {
                nodes: [triggerNode, enrichNode, webhookNode],
                edges: [
                    makeEdge(triggerNode.id, enrichNode.id),
                    makeEdge(enrichNode.id, webhookNode.id),
                ],
                workflowDescription:
                    answers.scope === 'course' && answers.courseId
                        ? 'Fetch enrollment + payment status and POST to external webhook — fires only when learners enroll in the selected course.'
                        : 'Fetch enrollment + payment status and POST to external webhook on every new enrollment in this institute.',
            };
        },
    },

    // ─── 28. Send abandoned-cart data to external webhook ───
    // Mirrors webhook_on_enrollment but fires when a learner starts the enrollment
    // form but hasn't completed payment yet. Backend (LearnerEnrollmentEntryService)
    // now puts the same context shape on this trigger as LEARNER_BATCH_ENROLLMENT
    // (user UserDTO + packageName + packageId + triggerTime), so the webhook
    // payload uses the SAME SpEL — minus payment fields, which don't exist yet
    // at abandoned-cart time.
    //
    // No QUERY enrichment node here. We could fetch the SSIGM row (it's saved
    // before the trigger fires), but adding the same after-commit deferral fix
    // we applied to LEARNER_BATCH_ENROLLMENT is a separate concern — for now
    // the trigger context's direct fields are enough to identify the lead in
    // the CRM/Pabbly.
    {
        id: 'webhook_on_abandoned_cart',
        name: 'Send abandoned cart data to webhook',
        description: 'When a learner fills the enrollment form but does not complete payment, POST their details to an external webhook (Pabbly, Zapier, n8n) for re-targeting / nurture campaigns.',
        icon: '🛒',
        triggerEvents: ['ABANDONED_CART'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            {
                id: 'webhookUrl',
                label: 'Webhook URL',
                helpText: 'The POST endpoint that will receive the abandoned-cart data. Get this from your Pabbly Connect / Zapier / n8n / Make workflow.',
                type: 'text',
                required: true,
            },
            {
                id: 'scope',
                label: 'When should this fire?',
                helpText: 'Pick "institute-wide" to fire on every abandoned cart in your institute, or "specific course" to fire only for one course.',
                type: 'select',
                required: true,
                defaultValue: 'institute',
                options: [
                    { value: 'institute', label: 'For every abandoned cart in this institute' },
                    { value: 'course', label: 'Only when carts are abandoned for a specific course' },
                ],
            },
            {
                id: 'courseId',
                label: 'Which course?',
                helpText: 'The webhook will only fire when carts are abandoned for batches of this course.',
                type: 'package_select',
                required: true,
                showIf: { questionId: 'scope', values: ['course'] },
            },
            {
                id: 'payloadJson',
                label: 'Webhook payload (JSON)',
                type: 'json_payload',
                required: true,
                jsonPayloadHint:
                    'Edit the JSON below. Each value can be a literal string OR a SpEL expression. '
                    + 'Available on the context:  '
                    + '#ctx[\'triggerTime\'] (ISO timestamp), '
                    + '#ctx[\'user\'].fullName / .email / .mobileNumber / .username, '
                    + '#ctx[\'packageName\'] (course), '
                    + '#ctx[\'packageId\'], #ctx[\'packageSessionIds\'] (batch), '
                    + '#ctx[\'userId\'], #ctx[\'userPlanId\'] (often null at abandoned-cart time), '
                    + '#ctx[\'instituteName\'], #ctx[\'instituteId\']. '
                    + 'Payment fields are NOT available — the cart was abandoned before payment started.',
                defaultValue: JSON.stringify(
                    {
                        Timestamp: "#ctx['triggerTime']",
                        Name: "#ctx['user'].fullName",
                        Phone: "#ctx['user'].mobileNumber",
                        Email: "#ctx['user'].email",
                        CourseName: "#ctx['packageName']",
                        Status: 'ABANDONED_CART',
                    },
                    null,
                    2,
                ),
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Cart abandoned', {
                triggerEvent: triggerEvent ?? 'ABANDONED_CART',
            }, 250, 50, true);

            let body: Record<string, unknown> = {};
            try {
                const raw = (answers.payloadJson as string) ?? '{}';
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    body = parsed as Record<string, unknown>;
                }
            } catch {
                body = {
                    Timestamp: "#ctx['triggerTime']",
                    Email: "#ctx['user'].email",
                    Name: "#ctx['user'].fullName",
                    Status: 'ABANDONED_CART',
                };
            }

            // Course-level scoping via HTTP_REQUEST's `condition` field — same
            // pattern as webhook_on_enrollment. The handler evaluates the
            // condition before firing and skips the request when false.
            const courseCondition =
                answers.scope === 'course' && answers.courseId
                    ? `#ctx['packageId'] == '${String(answers.courseId).replace(/'/g, "\\'")}'`
                    : undefined;

            const webhookNode = makeNode('HTTP_REQUEST', 'POST abandoned cart to webhook', {
                resultKey: 'webhookResponse',
                config: {
                    requestType: 'EXTERNAL',
                    method: 'POST',
                    url: answers.webhookUrl as string,
                    ...(courseCondition ? { condition: courseCondition } : {}),
                    body,
                },
            }, 250, 230);

            return {
                nodes: [triggerNode, webhookNode],
                edges: [makeEdge(triggerNode.id, webhookNode.id)],
                workflowDescription:
                    answers.scope === 'course' && answers.courseId
                        ? 'POST abandoned-cart data to external webhook — fires only for the selected course.'
                        : 'POST abandoned-cart data to external webhook on every abandoned cart in this institute.',
            };
        },
    },
];

/** Get templates matching a trigger event (or scheduled) */
export function getTemplatesForTrigger(
    triggerEvent: string | undefined,
    workflowType: 'EVENT_DRIVEN' | 'SCHEDULED'
): UseCaseTemplate[] {
    if (workflowType === 'SCHEDULED') {
        return USE_CASE_TEMPLATES.filter(
            (t) => t.workflowType === 'SCHEDULED' || t.workflowType === 'BOTH'
        );
    }
    if (!triggerEvent) return [];
    return USE_CASE_TEMPLATES.filter(
        (t) =>
            (t.workflowType === 'EVENT_DRIVEN' || t.workflowType === 'BOTH') &&
            t.triggerEvents.includes(triggerEvent)
    );
}
