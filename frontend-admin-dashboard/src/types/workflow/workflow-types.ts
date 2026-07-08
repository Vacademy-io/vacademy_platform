export interface Workflow {
    id: string;
    name: string;
    description: string;
    status: string;
    workflow_type: string;
    created_by_user_id: string;
    institute_id: string;
    created_at: string;
    updated_at: string;
    // Optional schedules for SCHEDULED workflows
    schedules?: WorkflowSchedule[];
    // Optional trigger for EVENT_DRIVEN/trigger workflows
    trigger?: WorkflowTrigger;
}

export interface WorkflowListResponse {
    workflows: Workflow[];
    totalCount: number;
}

export interface WorkflowSchedule {
    schedule_id: string | null;
    schedule_type: string | null; // e.g., CRON, INTERVAL
    cron_expression: string | null;
    interval_minutes: number | null;
    day_of_month: number | null;
    timezone: string | null;
    schedule_start_date: string | null;
    schedule_end_date: string | null;
    schedule_status: string | null;
    last_run_at: string | null;
    next_run_at: string | null;
    schedule_created_at: string | null;
    schedule_updated_at: string | null;
}

export interface WorkflowTrigger {
    trigger_id: string | null;
    trigger_event_name: string | null;
    trigger_description: string | null;
    event_applied_type: string | null;
    event_id: string | null;
    trigger_status: string | null;
    trigger_created_at: string | null;
    trigger_updated_at: string | null;
}

export type NodeType =
    | 'TRIGGER'
    | 'ACTION'
    | 'DECISION'
    | 'EMAIL'
    | 'NOTIFICATION'
    | 'DATABASE'
    | 'WEBHOOK'
    | 'UNKNOWN';

export interface WorkflowNode {
    id: string;
    title: string;
    description?: string;
    type: NodeType;
    details?: Record<string, unknown>;
}

export interface WorkflowEdge {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    label: string;
}

export interface AutomationDiagram {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

// Builder types
export interface WorkflowBuilderNode {
    id: string;
    name: string;
    node_type: string;
    config: Record<string, unknown>;
    position_x: number;
    position_y: number;
    is_start_node?: boolean;
    is_end_node?: boolean;
}

export interface WorkflowBuilderEdge {
    id: string;
    source_node_id: string;
    target_node_id: string;
    label?: string;
    condition?: string;
}

export interface WorkflowBuilderSchedule {
    schedule_type: string;
    cron_expression?: string;
    interval_minutes?: number;
    timezone?: string;
    start_date?: string;
    end_date?: string;
}

export interface WorkflowBuilderTrigger {
    trigger_event_name: string;
    description?: string;
    event_applied_type?: string;
    event_id?: string;
    /** Multiple event IDs — one trigger row created per ID */
    event_ids?: string[];
}

export interface WorkflowBuilderDTO {
    id?: string;
    name: string;
    description?: string;
    status: string;
    workflow_type: string;
    institute_id: string;
    nodes: WorkflowBuilderNode[];
    edges: WorkflowBuilderEdge[];
    schedule?: WorkflowBuilderSchedule;
    trigger?: WorkflowBuilderTrigger;
}

export interface ValidationError {
    nodeId: string | null;
    field: string;
    message: string;
    severity: 'ERROR' | 'WARNING';
}

// --- AI-assisted workflow drafting (see WORKFLOW_AI_ASSIST_DESIGN.md) ---

export interface AiDraftRequest {
    goal: string;
    instituteId: string;
    answers?: Array<Record<string, unknown>>;
}

export interface AiDraftClarifyingQuestion {
    id: string;
    question: string;
    entityType?: string;
}

export interface AiDraftRationale {
    nodeId?: string;
    explains?: string;
}

export interface AiDraftResponse {
    workflow?: WorkflowBuilderDTO;
    rationale?: AiDraftRationale[];
    clarifyingQuestions?: AiDraftClarifyingQuestion[];
    templateUsed?: string;
    validationErrors?: ValidationError[];
    warnings?: string[];
    error?: string;
}

export const WORKFLOW_NODE_TYPES = [
    { type: 'TRIGGER', label: 'Trigger', icon: '⚡', color: 'green', category: 'Triggers' },
    { type: 'QUERY', label: 'Query', icon: '🔍', color: 'cyan', category: 'Data' },
    { type: 'TRANSFORM', label: 'Transform', icon: '🔄', color: 'amber', category: 'Data' },
    { type: 'ACTION', label: 'Action', icon: '⚙️', color: 'blue', category: 'Actions' },
    { type: 'SEND_EMAIL', label: 'Send Email', icon: '📧', color: 'purple', category: 'Notifications' },
    { type: 'SEND_WHATSAPP', label: 'Send WhatsApp', icon: '💬', color: 'green', category: 'Notifications' },
    { type: 'HTTP_REQUEST', label: 'HTTP Request', icon: '🔗', color: 'orange', category: 'Integrations' },
    { type: 'COMBOT', label: 'Combot', icon: '🤖', color: 'indigo', category: 'Integrations' },
    { type: 'DELAY', label: 'Delay', icon: '⏱️', color: 'slate', category: 'Logic' },
    { type: 'FILTER', label: 'Filter', icon: '🔽', color: 'teal', category: 'Data' },
    { type: 'AGGREGATE', label: 'Aggregate', icon: '📊', color: 'rose', category: 'Data' },
    { type: 'CONDITION', label: 'If/Else', icon: '🔀', color: 'yellow', category: 'Logic' },
    { type: 'LOOP', label: 'For Each', icon: '🔁', color: 'violet', category: 'Logic' },
    { type: 'MERGE', label: 'Merge', icon: '🔗', color: 'pink', category: 'Logic' },
    { type: 'SCHEDULE_TASK', label: 'Schedule Task', icon: '📅', color: 'sky', category: 'Actions' },
    { type: 'UPDATE_RECORD', label: 'Update Record', icon: '📝', color: 'lime', category: 'Data' },
    { type: 'SEND_PUSH_NOTIFICATION', label: 'Push Notification', icon: '🔔', color: 'fuchsia', category: 'Notifications' },
    { type: 'SET_LEAD_STATUS', label: 'Set Lead Status', icon: '🏷️', color: 'purple', category: 'Actions' },
    { type: 'ROUTER', label: 'Router', icon: '🔀', color: 'yellow', category: 'Logic' },
    { type: 'CALL_AI', label: 'AI Call', icon: '📞', color: 'emerald', category: 'Actions' },
] as const;

export const TRIGGER_EVENTS = [
    'LEARNER_BATCH_ENROLLMENT',
    'GENERATE_ADMIN_LOGIN_URL_FOR_LEARNER_PORTAL',
    'SEND_LEARNER_CREDENTIALS',
    'SUB_ORG_MEMBER_ENROLLMENT',
    'SUB_ORG_MEMBER_TERMINATION',
    'AUDIENCE_LEAD_SUBMISSION',
    'INSTALLMENT_DUE_REMINDER',
    // Lead TAT / Follow-up SLA (emit-only; backend emits, workflow delivers).
    // Also surfaced dynamically via the backend trigger-events catalog.
    'LEAD_ASSIGNED_TO_COUNSELOR',
    'LEAD_TAT_REMINDER_BEFORE',
    'LEAD_TAT_OVERDUE',
    'FOLLOW_UP_DUE',
    'FOLLOW_UP_OVERDUE',
    'LEAD_STATUS_CHANGED',
] as const;

// Execution Log types
export interface WorkflowExecutionLogDTO {
    id: string;
    workflow_execution_id: string;
    node_template_id: string;
    node_type: string;
    status: 'RUNNING' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'SKIPPED';
    started_at: string | null;
    completed_at: string | null;
    execution_time_ms: number | null;
    details: Record<string, unknown> | null;
    error_message: string | null;
    error_type: string | null;
    created_at: string;
    updated_at: string;
}

export interface ExecutionSummary {
    total_executions: number;
    completed: number;
    failed: number;
    processing: number;
    pending: number;
    avg_execution_time_ms: number;
    success_rate: number;
}

export type ExecutionLogStatus = 'RUNNING' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'SKIPPED';

export type WorkflowExecutionStatus =
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'PAUSED';

/** One node/step within an enrollment workflow run (tick/cross checklist item). */
export interface EnrollmentWorkflowStep {
    /** Absent for not-yet-run (pending) steps sourced from the workflow definition. */
    log_id?: string | null;
    node_template_id: string;
    node_name: string;
    node_type: string;
    /** null => the step has not run yet (pending), e.g. for a workflow that will fire on enrollment. */
    status: ExecutionLogStatus | null;
    error_message: string | null;
    error_type: string | null;
    started_at: string | null;
    completed_at: string | null;
    execution_time_ms: number | null;
}

/**
 * An enrollment workflow execution (e.g. a LEARNER_BATCH_ENROLLMENT run) attached
 * to a learner enrollment / a course's package sessions, with its ordered steps.
 * Backed by GET /admin-core-service/workflow/enrollment-runs.
 */
export interface EnrollmentWorkflowRun {
    /** Absent for a PENDING run (configured to fire on enrollment but not yet executed). */
    execution_id?: string | null;
    workflow_id: string | null;
    workflow_name: string | null;
    event_name: string | null;
    event_id: string | null;
    status: WorkflowExecutionStatus;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    steps: EnrollmentWorkflowStep[];
}
