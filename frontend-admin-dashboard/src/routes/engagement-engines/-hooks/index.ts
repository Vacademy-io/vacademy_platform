import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import type { CreateEngineRequest, EngineStatus, TemplateEditRequest } from '../-types';
import {
    ackTask,
    approveTemplate,
    archiveEngine,
    createEngine,
    dismissTask,
    doneTask,
    editPrompt,
    editTemplate,
    enrollEngine,
    getDataPointCatalog,
    getEngine,
    listEngines,
    listTasks,
    listTemplates,
    recommendTemplates,
    reopenTask,
    requestAlternatives,
    sendTask,
    setAutonomy,
    submitTemplate,
    syncTemplates,
    transitionEngine,
    withdrawTemplate,
} from '../-services';

const errMsg = (e: unknown, fallback: string): string => {
    const anyErr = e as { response?: { data?: { message?: string } }; message?: string };
    return anyErr?.response?.data?.message || anyErr?.message || fallback;
};

// ---- Engines ----
export const useEngines = () => {
    const instituteId = getInstituteId() || '';
    return useQuery({
        queryKey: ['engagementEngines', instituteId],
        queryFn: () => listEngines(instituteId),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });
};

export const useEngine = (engineId: string | undefined) => {
    const instituteId = getInstituteId() || '';
    return useQuery({
        queryKey: ['engagementEngine', instituteId, engineId],
        queryFn: () => getEngine(engineId as string, instituteId),
        enabled: !!instituteId && !!engineId,
        staleTime: 15 * 1000,
    });
};

export const useDataPointCatalog = () =>
    useQuery({
        queryKey: ['engagementDataPoints'],
        queryFn: getDataPointCatalog,
        staleTime: 5 * 60 * 1000,
    });

export const useCreateEngine = () => {
    const qc = useQueryClient();
    const instituteId = getInstituteId() || '';
    return useMutation({
        mutationFn: (payload: CreateEngineRequest) => createEngine(instituteId, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['engagementEngines'] });
            toast.success('Engine created');
        },
        onError: (e) => toast.error(errMsg(e, 'Failed to create engine')),
    });
};

export const useTransitionEngine = () => {
    const qc = useQueryClient();
    const instituteId = getInstituteId() || '';
    return useMutation({
        mutationFn: ({ engineId, toStatus }: { engineId: string; toStatus: EngineStatus }) =>
            transitionEngine(engineId, instituteId, toStatus),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: ['engagementEngines'] });
            qc.invalidateQueries({ queryKey: ['engagementEngine', instituteId, vars.engineId] });
            toast.success('Engine updated');
        },
        onError: (e) => toast.error(errMsg(e, 'Could not change status')),
    });
};

export const useSetAutonomy = () => {
    const qc = useQueryClient();
    const instituteId = getInstituteId() || '';
    return useMutation({
        mutationFn: ({ engineId, killed }: { engineId: string; killed: boolean }) =>
            setAutonomy(engineId, instituteId, killed),
        onSuccess: (_d, vars) => {
            qc.invalidateQueries({ queryKey: ['engagementEngine', instituteId, vars.engineId] });
            qc.invalidateQueries({ queryKey: ['engagementEngines'] });
            toast.success(vars.killed ? 'Auto-send off — copilot only' : 'Auto-send allowed');
        },
        onError: (e) => toast.error(errMsg(e, 'Could not change autonomy')),
    });
};

export const useEnrollEngine = () => {
    const qc = useQueryClient();
    const instituteId = getInstituteId() || '';
    return useMutation({
        mutationFn: (engineId: string) => enrollEngine(engineId, instituteId),
        onSuccess: (data, engineId) => {
            qc.invalidateQueries({ queryKey: ['engagementEngine', instituteId, engineId] });
            toast.success(
                `Audience resolved: ${data.newlyEnrolled} added, ${data.exited} exited (${data.audienceSize} total)`
            );
        },
        onError: (e) => toast.error(errMsg(e, 'Enrollment failed')),
    });
};

export const useEditPrompt = () => {
    const qc = useQueryClient();
    const instituteId = getInstituteId() || '';
    return useMutation({
        mutationFn: ({ engineId, deltaText }: { engineId: string; deltaText: string }) =>
            editPrompt(engineId, instituteId, deltaText),
        onSuccess: (_d, vars) => {
            qc.invalidateQueries({ queryKey: ['engagementEngine', instituteId, vars.engineId] });
            toast.success('Amendment added to the brief');
        },
        onError: (e) => toast.error(errMsg(e, 'Could not update the brief')),
    });
};

export const useArchiveEngine = () => {
    const qc = useQueryClient();
    const instituteId = getInstituteId() || '';
    return useMutation({
        mutationFn: (engineId: string) => archiveEngine(engineId, instituteId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['engagementEngines'] });
            toast.success('Engine archived');
        },
        onError: (e) => toast.error(errMsg(e, 'Could not archive')),
    });
};

// ---- Tasks ----
export const useTasks = (statuses: string, page: number, size: number) => {
    const instituteId = getInstituteId() || '';
    return useQuery({
        queryKey: ['engagementTasks', instituteId, statuses, page, size],
        queryFn: () => listTasks(instituteId, statuses, page, size),
        enabled: !!instituteId,
        staleTime: 10 * 1000,
    });
};

export const useTaskAction = () => {
    const qc = useQueryClient();
    const instituteId = getInstituteId() || '';
    return useMutation({
        mutationFn: async ({
            taskId,
            verb,
            editedBody,
        }: {
            taskId: string;
            verb: 'ack' | 'done' | 'dismiss' | 'reopen' | 'send';
            editedBody?: string;
        }) => {
            switch (verb) {
                case 'ack':
                    return ackTask(taskId, instituteId);
                case 'done':
                    return doneTask(taskId, instituteId);
                case 'dismiss':
                    return dismissTask(taskId, instituteId);
                case 'reopen':
                    return reopenTask(taskId, instituteId);
                case 'send':
                    return sendTask(taskId, instituteId, editedBody);
            }
        },
        onSuccess: (_d, vars) => {
            qc.invalidateQueries({ queryKey: ['engagementTasks'] });
            const msg: Record<string, string> = {
                ack: 'Task acknowledged',
                done: 'Marked done',
                dismiss: 'Dismissed',
                reopen: 'Reopened',
                send: 'Sent',
            };
            toast.success(msg[vars.verb] ?? 'Done');
        },
        onError: (e) => toast.error(errMsg(e, 'Action failed')),
    });
};

// ---- Templates ----
export const useTemplates = (engineId: string | undefined) => {
    const instituteId = getInstituteId() || '';
    return useQuery({
        queryKey: ['engagementTemplates', instituteId, engineId],
        queryFn: () => listTemplates(engineId as string, instituteId),
        enabled: !!instituteId && !!engineId,
        staleTime: 10 * 1000,
    });
};

export const useTemplateMutation = () => {
    const qc = useQueryClient();
    const instituteId = getInstituteId() || '';
    const invalidate = (engineId?: string) => {
        qc.invalidateQueries({ queryKey: ['engagementTemplates', instituteId, engineId] });
        if (engineId) qc.invalidateQueries({ queryKey: ['engagementEngine', instituteId, engineId] });
    };
    return {
        recommend: useMutation({
            mutationFn: ({ engineId, count }: { engineId: string; count?: number }) =>
                recommendTemplates(engineId, instituteId, count),
            onSuccess: (_d, v) => {
                invalidate(v.engineId);
                toast.success('AI proposed templates');
            },
            onError: (e) => toast.error(errMsg(e, 'Could not propose templates')),
        }),
        alternatives: useMutation({
            mutationFn: ({ engineId, feedback }: { engineId: string; feedback?: string }) =>
                requestAlternatives(engineId, instituteId, feedback),
            onSuccess: (_d, v) => {
                invalidate(v.engineId);
                toast.success('New options proposed');
            },
            onError: (e) => toast.error(errMsg(e, 'Could not get alternatives')),
        }),
        edit: useMutation({
            mutationFn: ({
                id,
                payload,
            }: {
                id: string;
                engineId: string;
                payload: TemplateEditRequest;
            }) => editTemplate(id, instituteId, payload),
            onSuccess: (_d, v) => {
                invalidate(v.engineId);
                toast.success('Template updated');
            },
            onError: (e) => toast.error(errMsg(e, 'Could not save the template')),
        }),
        approve: useMutation({
            mutationFn: ({ id }: { id: string; engineId: string }) => approveTemplate(id, instituteId),
            onSuccess: (_d, v) => {
                invalidate(v.engineId);
                toast.success('Template approved');
            },
            onError: (e) => toast.error(errMsg(e, 'Could not approve')),
        }),
        submit: useMutation({
            mutationFn: ({ id }: { id: string; engineId: string }) => submitTemplate(id, instituteId),
            onSuccess: (_d, v) => {
                invalidate(v.engineId);
                toast.success('Submitted to Meta');
            },
            onError: (e) => toast.error(errMsg(e, 'Submission failed')),
        }),
        withdraw: useMutation({
            mutationFn: ({ id }: { id: string; engineId: string }) => withdrawTemplate(id, instituteId),
            onSuccess: (_d, v) => {
                invalidate(v.engineId);
                toast.success('Template withdrawn');
            },
            onError: (e) => toast.error(errMsg(e, 'Could not withdraw')),
        }),
        sync: useMutation({
            mutationFn: ({ engineId }: { engineId: string }) => syncTemplates(instituteId).then((r) => ({ ...r, engineId })),
            onSuccess: (r) => {
                invalidate(r.engineId);
                toast.success(r.changed > 0 ? `${r.changed} template(s) updated` : 'No changes from Meta yet');
            },
            onError: (e) => toast.error(errMsg(e, 'Could not check Meta')),
        }),
    };
};
