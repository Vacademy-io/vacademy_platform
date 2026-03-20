import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_WORKFLOW_DIAGRAM, LIST_WORKFLOWS_WITH_SCHEDULES } from '@/constants/urls';
import {
    Workflow,
    AutomationDiagram,
    WorkflowSchedule,
    WorkflowTrigger,
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
