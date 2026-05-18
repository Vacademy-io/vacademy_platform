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
    type: 'batch_select' | 'batch_multi_select' | 'template_select' | 'audience_select' | 'live_session_select' | 'invite_select' | 'number' | 'select' | 'text';
    required?: boolean;
    options?: Array<{ value: string; label: string }>; // for 'select' type
    defaultValue?: string | number;
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

    // ─── 1. Send email to batch students on event ───
    // VERIFIED: fetch_students_by_batch returns {students: [{email, fullName, ...}]}
    //   on="#ctx['students']" → List<Map> ✓, each has email ✓
    {
        id: 'email_batch_students',
        name: 'Email batch students',
        description: 'Fetch students from a batch and send them an email using a template.',
        icon: '📧',
        triggerEvents: ['LIVE_SESSION_CREATE', 'LIVE_SESSION_START', 'LIVE_SESSION_END', 'LEARNER_BATCH_ENROLLMENT', 'SUB_ORG_MEMBER_ENROLLMENT', 'INSTALLMENT_DUE_REMINDER'],
        workflowType: 'BOTH',
        questions: [
            {
                id: 'batchId',
                label: 'Which batch to fetch students from?',
                helpText: 'Select the batch whose students should receive the email.',
                type: 'batch_select',
                required: true,
            },
            {
                id: 'templateName',
                label: 'Which email template to use?',
                helpText: 'Choose the email template that will be sent to each student.',
                type: 'template_select',
                required: true,
            },
            {
                id: 'recipientField',
                label: 'Send to',
                type: 'select',
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

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
                ...(answers.recipientField ? { recipientField: answers.recipientField } : {}),
            }, 250, 410);

            return {
                nodes: [triggerNode, queryNode, emailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, emailNode.id),
                ],
            };
        },
    },

    // ─── 2. Send confirmation email to audience lead ───
    {
        id: 'audience_lead_confirmation',
        name: 'Send lead confirmation email',
        description: 'When someone fills your audience form, automatically send them a confirmation email.',
        icon: '📝',
        triggerEvents: ['AUDIENCE_LEAD_SUBMISSION'],
        workflowType: 'EVENT_DRIVEN',
        questions: [
            {
                id: 'templateName',
                label: 'Which email template to send?',
                helpText: 'This template will be sent to the person who filled the form.',
                type: 'template_select',
                required: true,
            },
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
            // Resolution order in SendEmailNodeHandler:
            //   item field → context field → customFields[<key>] → SpEL → literal
            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['respondentEmailRequests']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
                templateVars: {
                    parentName: 'Full Name',     // resolves from customFields["Full Name"]
                    fullName: 'Full Name',       // alias, in case template uses {{fullName}}
                    email: 'Email',              // resolves from customFields["Email"]
                    mobileNumber: 'Phone Number',// resolves from customFields["Phone Number"]
                    instituteName: 'instituteName', // resolves from context
                },
            }, 250, 230);

            return {
                nodes: [triggerNode, emailNode],
                edges: [makeEdge(triggerNode.id, emailNode.id)],
                workflowDescription: 'Send confirmation email when a lead submits the audience form.',
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
            {
                id: 'templateName',
                label: 'Which email template to send?',
                helpText: 'Template for the payment failure notification.',
                type: 'template_select',
                required: true,
            },
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

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['ssigm_list']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 410);

            return {
                nodes: [triggerNode, queryNode, emailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, emailNode.id),
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
            {
                id: 'templateName',
                label: 'Which reminder email template?',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Abandoned cart', {
                triggerEvent: triggerEvent ?? 'ABANDONED_CART',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch student details', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: "#ctx['packageSessionId']" },
            }, 250, 230);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 410);

            return {
                nodes: [triggerNode, queryNode, emailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, emailNode.id),
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
            {
                id: 'templateName',
                label: 'Which email template?',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', `Trigger: ${(triggerEvent ?? 'invite event').replace(/_/g, ' ').toLowerCase()}`, {
                triggerEvent: triggerEvent ?? 'INVITE_CREATE',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 410);

            return {
                nodes: [triggerNode, queryNode, emailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, emailNode.id),
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
            {
                id: 'templateName',
                label: 'Which email template for the report?',
                type: 'template_select',
                required: true,
            },
            {
                id: 'daysBack',
                label: 'Report covers last how many days?',
                type: 'number',
                defaultValue: 7,
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
                    // Exclude today's date from the window. The email goes out in the
                    // morning, but more classes happen through the day — without this,
                    // the deep-link "View Full Report" on the portal would show different
                    // numbers than the email when clicked later in the same day.
                    excludeToday: true,
                },
            }, 250, 50, true);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 230);

            return {
                nodes: [queryNode, emailNode],
                edges: [makeEdge(queryNode.id, emailNode.id)],
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
            {
                id: 'templateName',
                label: 'Which follow-up email template?',
                type: 'template_select',
                required: true,
            },
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

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['leads']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 230);

            return {
                nodes: [queryNode, emailNode],
                edges: [makeEdge(queryNode.id, emailNode.id)],
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
            {
                id: 'templateName',
                label: 'Which email template for the reminder?',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers) => {
            const queryNode = makeNode('QUERY', 'Fetch upcoming installments', {
                prebuiltKey: 'getUpcomingFeeInstallments',
                params: {},
            }, 250, 50, true);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['feePaymentList']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 230);

            return {
                nodes: [queryNode, emailNode],
                edges: [makeEdge(queryNode.id, emailNode.id)],
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
            {
                id: 'templateName',
                label: 'Which welcome email template?',
                helpText: 'This will be sent immediately after enrollment.',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Student enrolled', {
                triggerEvent: triggerEvent ?? 'LEARNER_BATCH_ENROLLMENT',
            }, 250, 50, true);

            // Wrap the just-enrolled user in a single-element list so SEND_EMAIL
            // iterates once. We deliberately do NOT fetch batch students here —
            // the welcome email is for the one user who just enrolled, and only
            // the trigger context has their plaintext credentials. Iterating over
            // the whole batch would email everyone the same password (wrong) and
            // would lose access to {{username}}/{{password}} entirely (the
            // students-by-batch query doesn't return those fields).
            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "{#ctx['user']}",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
                recipientField: 'email',
                // Pre-populate the placeholder → context-field mapping so the user
                // doesn't have to do it manually in the workflow builder. Each value
                // is a SpEL expression evaluated against the workflow context at
                // send time. The user can override any of these in the node config.
                templateVars: {
                    fullName: "#ctx['user'].fullName",
                    username: "#ctx['user'].username",
                    password: "#ctx['user'].password",
                    email: "#ctx['user'].email",
                    instituteName: "#ctx['instituteName']",
                },
            }, 250, 230);

            return {
                nodes: [triggerNode, emailNode],
                edges: [makeEdge(triggerNode.id, emailNode.id)],
                workflowDescription: 'Send welcome email when a student enrolls.',
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
            {
                id: 'templateName',
                label: 'Which email template?',
                type: 'template_select',
                required: true,
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

            const emailNode = makeNode('SEND_EMAIL', `Send to parents: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
                recipientField: 'parentsEmail',
            }, 250, 410);

            return {
                nodes: [triggerNode, queryNode, emailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, emailNode.id),
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
            {
                id: 'templateName',
                label: 'Which notification template?',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Member removed', {
                triggerEvent: triggerEvent ?? 'SUB_ORG_MEMBER_TERMINATION',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch student details', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: "#ctx['packageSessionIds']" },
            }, 250, 230);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 410);

            return {
                nodes: [triggerNode, queryNode, emailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, emailNode.id),
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
            {
                id: 'templateName',
                label: 'Which reminder template?',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Session started', {
                triggerEvent: triggerEvent ?? 'LIVE_SESSION_START',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 410);

            return {
                nodes: [triggerNode, queryNode, emailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, emailNode.id),
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
            {
                id: 'templateName',
                label: 'Which follow-up template?',
                helpText: 'Include recording link, feedback form, or next session info.',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Session ended', {
                triggerEvent: triggerEvent ?? 'LIVE_SESSION_END',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 410);

            return {
                nodes: [triggerNode, queryNode, emailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, emailNode.id),
                ],
                workflowDescription: 'Send follow-up email after live session ends.',
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
            {
                id: 'templateName',
                label: 'Which follow-up template?',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Lead submitted', {
                triggerEvent: triggerEvent ?? 'AUDIENCE_LEAD_SUBMISSION',
            }, 250, 50, true);

            const emailNode = makeNode('SEND_EMAIL', `Follow-up: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['respondentEmailRequests']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
                templateVars: {
                    parentName: 'Full Name',
                    fullName: 'Full Name',
                    email: 'Email',
                    mobileNumber: 'Phone Number',
                    instituteName: 'instituteName',
                },
            }, 250, 230);

            return {
                nodes: [triggerNode, emailNode],
                edges: [makeEdge(triggerNode.id, emailNode.id)],
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
            {
                id: 'templateName',
                label: 'Which reminder template?',
                helpText: 'Template for the membership renewal reminder.',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Membership expiring', {
                triggerEvent: triggerEvent ?? 'MEMBERSHIP_EXPIRY',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch expiring memberships', {
                prebuiltKey: 'fetch_expiring_memberships',
                params: { daysUntilExpiry: answers.daysUntilExpiry ?? 7 },
            }, 250, 230);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['expiringMemberships']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 410);

            return {
                nodes: [triggerNode, queryNode, emailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, emailNode.id),
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
            {
                id: 'templateName',
                label: 'Which notification template?',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Assessment created', {
                triggerEvent: triggerEvent ?? 'ASSESSMENT_CREATE',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 410);

            return {
                nodes: [triggerNode, queryNode, emailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, emailNode.id),
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
            {
                id: 'templateName',
                label: 'Which email template?',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', `Trigger: ${(triggerEvent ?? 'assessment event').replace(/_/g, ' ').toLowerCase()}`, {
                triggerEvent: triggerEvent ?? 'ASSESSMENT_END',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 410);

            return {
                nodes: [triggerNode, queryNode, emailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, emailNode.id),
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
            {
                id: 'templateName',
                label: 'Which template?',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers, triggerEvent) => {
            const triggerNode = makeNode('TRIGGER', 'Trigger: Assessment started', {
                triggerEvent: triggerEvent ?? 'ASSESSMENT_START',
            }, 250, 50, true);

            const queryNode = makeNode('QUERY', 'Fetch batch students', {
                prebuiltKey: 'fetch_students_by_batch',
                params: { batchId: answers.batchId as string },
            }, 250, 230);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 410);

            return {
                nodes: [triggerNode, queryNode, emailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, emailNode.id),
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
            {
                id: 'templateName',
                label: 'Which renewal reminder template?',
                type: 'template_select',
                required: true,
            },
        ],
        generateWorkflow: (answers) => {
            const queryNode = makeNode('QUERY', 'Fetch expiring memberships', {
                prebuiltKey: 'fetch_expiring_memberships',
                params: { daysUntilExpiry: answers.daysUntilExpiry ?? 7 },
            }, 250, 50, true);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['expiringMemberships']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 230);

            return {
                nodes: [queryNode, emailNode],
                edges: [makeEdge(queryNode.id, emailNode.id)],
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
            {
                id: 'templateName',
                label: 'Which report template?',
                helpText: 'Template with variables like {{attendancePercentage}}, {{sessionsAttended}}.',
                type: 'template_select',
                required: true,
            },
            {
                id: 'daysBack',
                label: 'Report covers last how many days?',
                type: 'number',
                defaultValue: 7,
            },
        ],
        generateWorkflow: (answers) => {
            const queryNode = makeNode('QUERY', 'Fetch student engagement', {
                prebuiltKey: 'fetch_batch_attendance_report',
                params: {
                    batchId: answers.batchId as string,
                    daysBack: answers.daysBack ?? 7,
                    // Morning email — exclude today so the deep link stays consistent
                    // with the email even after more classes happen during the day.
                    excludeToday: true,
                },
            }, 250, 50, true);

            const emailNode = makeNode('SEND_EMAIL', `Send: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 250, 230);

            return {
                nodes: [queryNode, emailNode],
                edges: [makeEdge(queryNode.id, emailNode.id)],
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
            {
                id: 'templateName',
                label: 'Which template for parents?',
                type: 'template_select',
                required: true,
            },
            {
                id: 'daysBack',
                label: 'Report covers last how many days?',
                type: 'number',
                defaultValue: 7,
            },
        ],
        generateWorkflow: (answers) => {
            const queryNode = makeNode('QUERY', 'Fetch student data', {
                prebuiltKey: 'fetch_batch_attendance_report',
                params: {
                    batchId: answers.batchId as string,
                    daysBack: answers.daysBack ?? 7,
                    // Morning email — exclude today so the deep link stays consistent
                    // with the email even after more classes happen during the day.
                    excludeToday: true,
                },
            }, 250, 50, true);

            const emailNode = makeNode('SEND_EMAIL', `Send to parents: ${answers.templateName}`, {
                templateName: answers.templateName as string,
                on: "#ctx['students']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
                recipientField: 'parentsEmail',
            }, 250, 230);

            return {
                nodes: [queryNode, emailNode],
                edges: [makeEdge(queryNode.id, emailNode.id)],
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
            {
                id: 'presentTemplate',
                label: 'Email template for students who attended',
                helpText: 'Sent to learners marked PRESENT in the class.',
                type: 'template_select',
                required: true,
                sampleTemplateKey: 'live_session_recap_present',
            },
            {
                id: 'absentTemplate',
                label: 'Email template for students who missed it',
                helpText: 'Sent to learners marked ABSENT in the class.',
                type: 'template_select',
                required: true,
                sampleTemplateKey: 'live_session_recap_absent',
            },
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

            const presentEmailNode = makeNode('SEND_EMAIL', `Send to present: ${answers.presentTemplate}`, {
                templateName: answers.presentTemplate as string,
                on: "#ctx['presentStudents']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 50, 410);

            const absentEmailNode = makeNode('SEND_EMAIL', `Send to absent: ${answers.absentTemplate}`, {
                templateName: answers.absentTemplate as string,
                on: "#ctx['absentStudents']",
                forEach: { operation: 'SEND_EMAIL', eval: "#ctx['item']" },
            }, 450, 410);

            return {
                nodes: [triggerNode, queryNode, presentEmailNode, absentEmailNode],
                edges: [
                    makeEdge(triggerNode.id, queryNode.id),
                    makeEdge(queryNode.id, presentEmailNode.id, 'present'),
                    makeEdge(queryNode.id, absentEmailNode.id, 'absent'),
                ],
                workflowDescription: 'Post-class recap emails to present and absent students for every live class in the institute.',
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
