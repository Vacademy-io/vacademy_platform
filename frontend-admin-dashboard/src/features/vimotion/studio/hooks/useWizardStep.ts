/**
 * Wizard-step mutations: plan / refine / confirm for one Studio wizard step.
 *
 * plan + refine return a WizardStepPlan (the LLM's proposal); confirm persists
 * the user's ConfirmedStepPlan and returns the updated ProjectResponse.
 * Confirm invalidates the project detail cache so the builds/status reflect
 * the new state.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    confirmWizardStep,
    planWizardStep,
    refineWizardStep,
    type ConfirmedStepPlan,
    type WizardPlanRequest,
    type WizardStep,
} from '../services/studio-api';

interface UseWizardStepOptions {
    apiKey: string | undefined;
    instituteId: string | undefined;
    projectId: string;
    step: WizardStep;
}

export function useWizardStep({
    apiKey,
    instituteId,
    projectId,
    step,
}: UseWizardStepOptions) {
    const qc = useQueryClient();

    const plan = useMutation({
        mutationFn: (req: WizardPlanRequest = {}) =>
            planWizardStep(apiKey as string, projectId, step, req),
    });

    const refine = useMutation({
        mutationFn: (refinementPrompt: string) =>
            refineWizardStep(apiKey as string, projectId, step, {
                refinement_prompt: refinementPrompt,
            }),
    });

    const confirm = useMutation({
        mutationFn: (confirmed: ConfirmedStepPlan) =>
            confirmWizardStep(apiKey as string, projectId, step, { confirmed }),
        onSuccess: (project) => {
            qc.setQueryData(['studio-project', instituteId, projectId], project);
            qc.invalidateQueries({ queryKey: ['studio-projects-list', instituteId] });
        },
    });

    return { plan, refine, confirm };
}
