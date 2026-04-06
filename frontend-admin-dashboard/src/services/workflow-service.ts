import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    BASE_URL,
    GET_WORKFLOW_DIAGRAM,
    LIST_WORKFLOWS_WITH_SCHEDULES,
    WORKFLOW_SERVICE_BASE,
} from '@/constants/urls';
import {
    Workflow,
    AutomationDiagram,
    WorkflowSchedule,
    WorkflowTrigger,
    WorkflowBuilderDTO,
    ValidationError,
    WorkflowExecutionLogDTO,
    ExecutionSummary,
} from '@/types/workflow/workflow-types';
import { queryOptions } from '@tanstack/react-query';

// New API response types
interface WorkflowWithScheduleRow {
    workflow_id: string;
    workflow_name: string;
    workflow_description: string;
    workflow_status: string;
    workflow_type: string;
    created_by_user_id: string;
    institute_id: string;
    workflow_created_at: string;
    workflow_updated_at: string;
    // schedule fields (nullable when not present)
    schedule_id: string | null;
    schedule_type: string | null;
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
    // trigger fields (nullable when not present)
    trigger_id: string | null;
    trigger_event_name: string | null;
    trigger_description: string | null;
    trigger_status: string | null;
    trigger_created_at: string | null;
    trigger_updated_at: string | null;
}

interface WorkflowsWithSchedulesResponse {
    content: WorkflowWithScheduleRow[];
    page_number: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
    first: boolean;
}

export const fetchActiveWorkflows = async (instituteId: string): Promise<Workflow[]> => {
    // Use new POST endpoint that returns workflows along with schedules (paginated)
    const response = await authenticatedAxiosInstance<WorkflowsWithSchedulesResponse>({
        method: 'POST',
        url: `${LIST_WORKFLOWS_WITH_SCHEDULES}`,
        params: {
            pageNo: 0,
            pageSize: 100,
        },
        data: {
            institute_id: instituteId,
            workflow_statuses: ['ACTIVE'],
            schedule_statuses: ['ACTIVE'],
        },
    });

    const rows = response.data?.content ?? [];

    // Group by workflow_id and aggregate schedules
    const workflowIdToWorkflow: Record<string, Workflow> = {};

    rows.forEach((row) => {
        if (!workflowIdToWorkflow[row.workflow_id]) {
            workflowIdToWorkflow[row.workflow_id] = {
                id: row.workflow_id,
                name: row.workflow_name,
                description: row.workflow_description,
                status: row.workflow_status,
                workflow_type: row.workflow_type,
                created_by_user_id: row.created_by_user_id,
                institute_id: row.institute_id,
                created_at: row.workflow_created_at,
                updated_at: row.workflow_updated_at,
                schedules: [],
            };
        }

        // If schedule details exist, push into schedules array
        const hasScheduleDetails =
            row.schedule_id !== null ||
            row.schedule_type !== null ||
            row.cron_expression !== null ||
            row.interval_minutes !== null ||
            row.day_of_month !== null ||
            row.timezone !== null;

        if (hasScheduleDetails) {
            const schedule: WorkflowSchedule = {
                schedule_id: row.schedule_id,
                schedule_type: row.schedule_type,
                cron_expression: row.cron_expression,
                interval_minutes: row.interval_minutes,
                day_of_month: row.day_of_month,
                timezone: row.timezone,
                schedule_start_date: row.schedule_start_date,
                schedule_end_date: row.schedule_end_date,
                schedule_status: row.schedule_status,
                last_run_at: row.last_run_at,
                next_run_at: row.next_run_at,
                schedule_created_at: row.schedule_created_at,
                schedule_updated_at: row.schedule_updated_at,
            };
            const wf = workflowIdToWorkflow[row.workflow_id];
            if (wf && wf.schedules) {
                wf.schedules.push(schedule);
            }
        }

        // Attach trigger details if present (for EVENT_DRIVEN / TRIGGER workflows)
        const hasTriggerDetails =
            row.trigger_id !== null ||
            row.trigger_event_name !== null ||
            row.trigger_status !== null;
        if (hasTriggerDetails) {
            const trigger: WorkflowTrigger = {
                trigger_id: row.trigger_id,
                trigger_event_name: row.trigger_event_name,
                trigger_description: row.trigger_description,
                trigger_status: row.trigger_status,
                trigger_created_at: row.trigger_created_at,
                trigger_updated_at: row.trigger_updated_at,
            };
            const wf2 = workflowIdToWorkflow[row.workflow_id];
            if (wf2) {
                wf2.trigger = trigger;
            }
        }
    });

    return Object.values(workflowIdToWorkflow);
};

export const getActiveWorkflowsQuery = (instituteId: string) =>
    queryOptions({
        queryKey: ['GET_ACTIVE_WORKFLOWS_WITH_SCHEDULES', instituteId],
        queryFn: () => fetchActiveWorkflows(instituteId),
        staleTime: 300000, // 5 minutes
        enabled: !!instituteId,
    });

export const fetchWorkflowDiagram = async (workflowId: string): Promise<AutomationDiagram> => {
    const response = await authenticatedAxiosInstance<AutomationDiagram>({
        method: 'GET',
        url: `${GET_WORKFLOW_DIAGRAM}/${workflowId}/diagram`,
    });
    return response.data;
};

export const getWorkflowDiagramQuery = (workflowId: string) =>
    queryOptions({
        queryKey: ['GET_WORKFLOW_DIAGRAM', workflowId],
        queryFn: () => fetchWorkflowDiagram(workflowId),
        staleTime: 300000, // 5 minutes
        enabled: !!workflowId,
    });

// Builder API functions
export const createWorkflow = async (
    dto: WorkflowBuilderDTO,
    userId: string
): Promise<WorkflowBuilderDTO> => {
    const response = await authenticatedAxiosInstance<WorkflowBuilderDTO>({
        method: 'POST',
        url: `${WORKFLOW_SERVICE_BASE}`,
        params: { userId },
        data: dto,
    });
    return response.data;
};

export const getWorkflowForEditing = async (
    workflowId: string
): Promise<WorkflowBuilderDTO> => {
    const response = await authenticatedAxiosInstance<WorkflowBuilderDTO>({
        method: 'GET',
        url: `${WORKFLOW_SERVICE_BASE}/${workflowId}/edit`,
    });
    return response.data;
};

export const deleteWorkflow = async (workflowId: string): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'DELETE',
        url: `${WORKFLOW_SERVICE_BASE}/${workflowId}`,
    });
};

export const validateWorkflow = async (
    dto: WorkflowBuilderDTO
): Promise<ValidationError[]> => {
    const response = await authenticatedAxiosInstance<ValidationError[]>({
        method: 'POST',
        url: `${WORKFLOW_SERVICE_BASE}/validate`,
        data: dto,
    });
    return response.data;
};

export const testRunWorkflow = async (
    workflowId: string,
    sampleContext?: Record<string, unknown>
): Promise<Record<string, unknown>> => {
    const response = await authenticatedAxiosInstance<Record<string, unknown>>({
        method: 'POST',
        url: `${WORKFLOW_SERVICE_BASE}/${workflowId}/test-run`,
        data: sampleContext ?? {},
    });
    return response.data;
};

export interface WorkflowTemplateItem {
    id: string;
    name: string;
    description: string;
    category: string;
    template_json: string;
    is_system: boolean;
}

export const fetchWorkflowTemplates = async (instituteId: string): Promise<WorkflowTemplateItem[]> => {
    const response = await authenticatedAxiosInstance<WorkflowTemplateItem[]>({
        method: 'GET',
        url: `${WORKFLOW_SERVICE_BASE}/templates`,
        params: { instituteId },
    });
    return response.data;
};

export const getWorkflowTemplatesQuery = (instituteId: string) =>
    queryOptions({
        queryKey: ['GET_WORKFLOW_TEMPLATES', instituteId],
        queryFn: () => fetchWorkflowTemplates(instituteId),
        staleTime: 600000, // 10 minutes (templates don't change often)
        enabled: !!instituteId,
    });

export const applyWorkflowTemplate = async (
    templateId: string,
    instituteId: string,
    userId: string,
    workflowName?: string
): Promise<WorkflowBuilderDTO> => {
    const response = await authenticatedAxiosInstance<WorkflowBuilderDTO>({
        method: 'POST',
        url: `${WORKFLOW_SERVICE_BASE}/templates/apply`,
        params: { templateId, instituteId, userId, workflowName },
    });
    return response.data;
};

// Execution logs
export async function fetchExecutionLogs(executionId: string): Promise<WorkflowExecutionLogDTO[]> {
    const response = await authenticatedAxiosInstance.get(
        `${BASE_URL}/admin-core-service/workflow/logs/execution/${executionId}`
    );
    return response.data;
}

export function getExecutionLogsQuery(executionId: string) {
    return queryOptions({
        queryKey: ['EXECUTION_LOGS', executionId],
        queryFn: () => fetchExecutionLogs(executionId),
        staleTime: 60_000,
        enabled: !!executionId,
    });
}

// Execution summary
export async function fetchExecutionSummary(
    workflowId: string,
    startDate?: string,
    endDate?: string
): Promise<ExecutionSummary> {
    const params = new URLSearchParams({ workflowId });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await authenticatedAxiosInstance.get(
        `${BASE_URL}/admin-core-service/v1/workflow-execution/summary?${params.toString()}`
    );
    return response.data;
}

export function getExecutionSummaryQuery(workflowId: string, startDate?: string, endDate?: string) {
    return queryOptions({
        queryKey: ['EXECUTION_SUMMARY', workflowId, startDate, endDate],
        queryFn: () => fetchExecutionSummary(workflowId, startDate, endDate),
        staleTime: 60_000,
        enabled: !!workflowId,
    });
}

// Context schema for variable picker
export interface ContextVariableDTO {
    key: string;
    type: string;
    source_node_id: string;
    source_node_name: string;
    source_node_type: string;
    description: string;
    spel_expression: string;
}

export interface ContextSchemaRequest {
    target_node_id: string;
    upstream_nodes: Array<{
        node_id: string;
        node_name: string;
        node_type: string;
        config: Record<string, unknown>;
    }>;
}

export async function fetchContextSchema(request: ContextSchemaRequest): Promise<ContextVariableDTO[]> {
    const response = await authenticatedAxiosInstance.post(
        `${WORKFLOW_SERVICE_BASE}/context-schema`,
        request
    );
    return response.data;
}

// Catalog types
export interface CatalogItem {
    key: string;
    label: string;
    description: string;
    category: string;
    required_params: string[];
}

export interface TemplateItem {
    id: string;
    name: string;
    subject?: string;
    content?: string;
    dynamic_parameters?: string; // JSON string
    status: string;
    type: string;
}

// Catalog fetch functions
export async function fetchQueryKeys(): Promise<CatalogItem[]> {
    const response = await authenticatedAxiosInstance.get(
        `${WORKFLOW_SERVICE_BASE}/catalog/query-keys`
    );
    return response.data;
}

export function getQueryKeysQuery() {
    return queryOptions({
        queryKey: ['WORKFLOW_CATALOG_QUERY_KEYS'],
        queryFn: fetchQueryKeys,
        staleTime: 600_000,
    });
}

export async function fetchTriggerEventsCatalog(): Promise<CatalogItem[]> {
    const response = await authenticatedAxiosInstance.get(
        `${WORKFLOW_SERVICE_BASE}/catalog/trigger-events`
    );
    return response.data;
}

export function getTriggerEventsCatalogQuery() {
    return queryOptions({
        queryKey: ['WORKFLOW_CATALOG_TRIGGER_EVENTS'],
        queryFn: fetchTriggerEventsCatalog,
        staleTime: 600_000,
    });
}

export async function fetchActionTypes(): Promise<CatalogItem[]> {
    const response = await authenticatedAxiosInstance.get(
        `${WORKFLOW_SERVICE_BASE}/catalog/actions`
    );
    return response.data;
}

export function getActionTypesQuery() {
    return queryOptions({
        queryKey: ['WORKFLOW_CATALOG_ACTIONS'],
        queryFn: fetchActionTypes,
        staleTime: 600_000,
    });
}

export async function fetchTemplatesByType(instituteId: string, type: string): Promise<TemplateItem[]> {
    const response = await authenticatedAxiosInstance.get(
        `${BASE_URL}/admin-core-service/institute/template/v1/institute/${instituteId}/type/${type}`
    );
    return response.data;
}

export function getTemplatesByTypeQuery(instituteId: string, type: string) {
    return queryOptions({
        queryKey: ['TEMPLATES_BY_TYPE', instituteId, type],
        queryFn: () => fetchTemplatesByType(instituteId, type),
        staleTime: 300_000,
        enabled: !!instituteId,
    });
}
