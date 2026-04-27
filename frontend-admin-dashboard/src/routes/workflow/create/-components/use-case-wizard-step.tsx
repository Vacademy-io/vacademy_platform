/**
 * Step 4 in workflow creation: Choose a use-case template or build from scratch.
 * Shows cards for available templates based on the selected trigger event.
 * When a template is picked, shows a wizard with questions (batch dropdown, template dropdown, etc.)
 * and auto-generates the workflow nodes.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Wrench, Lightning, CheckCircle, ArrowRight, Sparkle } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { INIT_INSTITUTE, AUDIENCE_CAMPAIGNS_LIST, CREATE_MESSAGE_TEMPLATE, MESSAGE_TEMPLATE_EXISTS } from '@/constants/urls';
import { getMessageTemplates } from '@/services/message-template-service';
import { useWorkflowBuilderStore } from '../-stores/workflow-builder-store';
import { getTemplatesForTrigger, type UseCaseTemplate, type WizardQuestion } from './use-case-templates';
import { SAMPLE_TEMPLATES } from './sample-email-templates';
import { getInstituteId } from '@/constants/helper';

// ─── Hooks for fetching dropdown options ───

function useBatchOptions(instituteId: string) {
    return useQuery({
        queryKey: ['wizard-batches', instituteId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(`${INIT_INSTITUTE}/${instituteId}`);
            const batches = response.data?.batches_for_sessions ?? [];
            if (!Array.isArray(batches)) return [];
            return batches.map((batch: Record<string, unknown>) => {
                const pkg = (batch.package_dto ?? {}) as Record<string, string>;
                const level = (batch.level ?? {}) as Record<string, string>;
                const session = (batch.session ?? {}) as Record<string, string>;
                return {
                    value: (batch.id as string) ?? '',
                    label: `${pkg.package_name ?? 'Unknown'} - ${level.level_name ?? ''} / ${session.session_name ?? ''}`.replace(/ - \/ $/, '').replace(/ \/ $/, ''),
                };
            });
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!instituteId,
    });
}

function useAudienceOptions(instituteId: string) {
    return useQuery({
        queryKey: ['wizard-audiences', instituteId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.post(AUDIENCE_CAMPAIGNS_LIST, {
                institute_id: instituteId,
                page: 0,
                size: 100,
            });
            const content = response.data?.content ?? response.data ?? [];
            if (!Array.isArray(content)) return [];
            return content.map((item: Record<string, string>) => ({
                value: item.campaign_id ?? item.id ?? '',
                label: item.campaign_name ?? item.name ?? 'Unknown',
            }));
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!instituteId,
    });
}

function useEmailTemplateOptions() {
    return useQuery({
        queryKey: ['wizard-email-templates'],
        queryFn: async () => {
            const result = await getMessageTemplates('EMAIL', 0, 100);
            return (result.templates ?? []).map((t: { name?: string; id?: string }) => ({
                value: t.name ?? t.id ?? '',
                label: t.name ?? 'Untitled',
            }));
        },
        staleTime: 5 * 60 * 1000,
    });
}

// ─── Question renderer ───

function QuestionField({
    question,
    value,
    onChange,
    instituteId,
    useCaseId,
}: {
    question: WizardQuestion;
    value: string | number | undefined;
    onChange: (val: string | number) => void;
    instituteId: string;
    useCaseId?: string;
}) {
    const { data: batchOptions = [], isLoading: batchLoading } = useBatchOptions(instituteId);
    const { data: audienceOptions = [], isLoading: audienceLoading } = useAudienceOptions(instituteId);
    const { data: templateOptions = [], isLoading: templateLoading } = useEmailTemplateOptions();
    const [creatingSample, setCreatingSample] = useState(false);
    const queryClient = useQueryClient();

    const renderDropdown = (
        options: Array<{ value: string; label: string }>,
        loading: boolean,
        placeholder: string,
        allowEmpty = false
    ) => (
        <select
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
        >
            <option value="">{allowEmpty ? `All (no restriction)` : placeholder}</option>
            {loading && <option disabled>Loading...</option>}
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    );

    return (
        <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
                {question.label}
                {question.required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            {question.helpText && (
                <p className="text-xs text-gray-400">{question.helpText}</p>
            )}

            {question.type === 'batch_select' && renderDropdown(batchOptions, batchLoading, '-- Select a batch --', !question.required)}
            {question.type === 'audience_select' && renderDropdown(audienceOptions, audienceLoading, '-- Select an audience --', !question.required)}
            {question.type === 'template_select' && (
                <div className="space-y-2">
                    {renderDropdown(templateOptions, templateLoading, '-- Select an email template --')}
                    {/* Sample template option */}
                    {useCaseId && SAMPLE_TEMPLATES[useCaseId] && (
                        <button
                            type="button"
                            disabled={creatingSample}
                            className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed border-primary-200 bg-primary-50/50 px-3 py-2.5 text-left transition-all hover:border-primary-400 hover:bg-primary-50 disabled:opacity-50"
                            onClick={async () => {
                                const sample = SAMPLE_TEMPLATES[useCaseId!];
                                if (!sample) return;
                                setCreatingSample(true);
                                try {
                                    const instId = getInstituteId();

                                    // Check if a template with this name already exists for this institute.
                                    // If yes, just use it — avoid hitting the unique-constraint 400.
                                    let alreadyExists = false;
                                    try {
                                        const existsResp = await authenticatedAxiosInstance.get(
                                            MESSAGE_TEMPLATE_EXISTS(instId ?? '', sample.name)
                                        );
                                        alreadyExists = existsResp.data?.exists === true;
                                    } catch {
                                        // If exists check fails, attempt create anyway
                                    }

                                    if (!alreadyExists) {
                                        await authenticatedAxiosInstance.post(
                                            CREATE_MESSAGE_TEMPLATE,
                                            {
                                                type: 'EMAIL',
                                                vendorId: 'default',
                                                instituteId: instId,
                                                name: sample.name,
                                                subject: sample.subject,
                                                content: sample.html,
                                                contentType: 'text/html',
                                                settingJson: {
                                                    variables: sample.variables,
                                                    isDefault: false,
                                                    templateType: 'utility',
                                                },
                                                dynamicParameters: {},
                                                canDelete: true,
                                                createdBy: 'current-user',
                                                updatedBy: 'current-user',
                                            }
                                        );
                                    }

                                    // Invalidate the templates list so the dropdown refreshes
                                    // and the newly-created sample appears immediately.
                                    await queryClient.invalidateQueries({
                                        queryKey: ['wizard-email-templates'],
                                    });
                                    onChange(sample.name);
                                } catch (err) {
                                    console.error('Failed to create sample template:', err);
                                    // Even if create failed (e.g. unique-key 400 from duplicate),
                                    // refresh the dropdown — the template likely already exists in DB.
                                    await queryClient.invalidateQueries({
                                        queryKey: ['wizard-email-templates'],
                                    });
                                    // Fallback: use the name anyway — it may already exist
                                    onChange(sample.name);
                                } finally {
                                    setCreatingSample(false);
                                }
                            }}
                        >
                            <Sparkle size={16} weight="fill" className="text-primary-500 shrink-0" />
                            <div className="flex-1">
                                <div className="text-xs font-semibold text-primary-700">
                                    {creatingSample ? 'Creating...' : `Use sample: "${SAMPLE_TEMPLATES[useCaseId!]!.name}"`}
                                </div>
                                <div className="text-[10px] text-primary-400 mt-0.5">
                                    Pre-built template with the right variables — added to your template library
                                </div>
                            </div>
                        </button>
                    )}
                </div>
            )}
            {question.type === 'live_session_select' && renderDropdown([], false, '-- Select a live session --', !question.required)}
            {question.type === 'invite_select' && renderDropdown([], false, '-- Select an invite --', !question.required)}

            {question.type === 'select' && (
                <select
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm"
                    value={(value as string) ?? (question.defaultValue as string) ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {(question.options ?? []).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            )}

            {question.type === 'number' && (
                <Input
                    type="number"
                    value={value ?? question.defaultValue ?? ''}
                    onChange={(e) => onChange(parseInt(e.target.value) || 0)}
                    className="w-32"
                    min={0}
                />
            )}

            {question.type === 'text' && (
                <Input
                    value={(value as string) ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}
        </div>
    );
}

// ─── Main component ───

export function UseCaseWizardStep({
    onComplete,
    onAdvanced,
    onBack,
    instituteId,
}: {
    onComplete: () => void;
    onAdvanced: () => void;
    onBack: () => void;
    instituteId: string;
}) {
    const { workflowType, triggerConfig, setNodes, setEdges, setWorkflowName, setWorkflowDescription } = useWorkflowBuilderStore();

    const templates = getTemplatesForTrigger(triggerConfig.eventName || undefined, workflowType);

    const [selectedTemplate, setSelectedTemplate] = useState<UseCaseTemplate | null>(null);
    const [answers, setAnswers] = useState<Record<string, string | number>>({});

    // Reset answers when template changes
    useEffect(() => {
        if (selectedTemplate) {
            const defaults: Record<string, string | number> = {};
            selectedTemplate.questions.forEach((q) => {
                if (q.defaultValue !== undefined) {
                    defaults[q.id] = q.defaultValue;
                }
            });
            setAnswers(defaults);
        } else {
            setAnswers({});
        }
    }, [selectedTemplate]);

    const canGenerate = selectedTemplate
        ? selectedTemplate.questions
            .filter((q) => q.required)
            .every((q) => {
                const val = answers[q.id];
                return val !== undefined && val !== '' && val !== 0;
            })
        : false;

    const handleGenerate = () => {
        if (!selectedTemplate) return;
        const result = selectedTemplate.generateWorkflow(answers, triggerConfig.eventName || undefined);

        // Add routing config to connect nodes
        const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));
        for (const edge of result.edges) {
            const sourceNode = nodeMap.get(edge.source);
            if (sourceNode) {
                const config = sourceNode.data.config as Record<string, unknown>;
                const routing = (config.routing as Array<Record<string, string>>) ?? [];
                routing.push({ label: '', type: 'goto', targetNodeId: edge.target });
                config.routing = routing;
            }
        }

        // Find end nodes (no outgoing edges)
        const sourcesSet = new Set(result.edges.map((e) => e.source));
        result.nodes.forEach((n) => {
            if (!sourcesSet.has(n.id)) {
                const config = n.data.config as Record<string, unknown>;
                const routing = (config.routing as Array<Record<string, string>>) ?? [];
                routing.push({ type: 'end' });
                config.routing = routing;
                n.data.isEndNode = true;
            }
        });

        setNodes(result.nodes);
        setEdges(result.edges);
        if (result.workflowName) setWorkflowName(result.workflowName);
        if (result.workflowDescription) setWorkflowDescription(result.workflowDescription);

        onComplete();
    };

    // ─── Template picker view ───
    if (!selectedTemplate) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">How would you like to build this workflow?</h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Pick a ready-made template below, or build your workflow from scratch using the visual editor.
                    </p>
                </div>

                {/* Template cards */}
                {templates.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Templates for this trigger</h3>
                        <div className="grid grid-cols-1 gap-3">
                            {templates.map((tmpl) => (
                                <button
                                    key={tmpl.id}
                                    className="group rounded-xl border-2 border-gray-200 bg-white p-5 text-left transition-all hover:border-primary-400 hover:shadow-md"
                                    onClick={() => setSelectedTemplate(tmpl)}
                                >
                                    <div className="flex items-start gap-4">
                                        <span className="text-3xl">{tmpl.icon}</span>
                                        <div className="flex-1">
                                            <h4 className="text-base font-semibold text-gray-800 group-hover:text-primary-600 transition-colors">
                                                {tmpl.name}
                                            </h4>
                                            <p className="mt-1 text-sm text-gray-500">{tmpl.description}</p>
                                            <div className="mt-2 flex items-center gap-1.5 text-xs text-primary-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                Use this template <ArrowRight size={12} />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {templates.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                        <p className="text-sm text-gray-500">No pre-built templates available for this trigger yet.</p>
                        <p className="mt-1 text-xs text-gray-400">Use the advanced builder to create your workflow from scratch.</p>
                    </div>
                )}

                {/* Divider */}
                <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                    <div className="relative flex justify-center">
                        <span className="bg-gray-50 px-4 text-xs text-gray-400 uppercase tracking-wider">or</span>
                    </div>
                </div>

                {/* Advanced mode button */}
                <button
                    className="w-full rounded-xl border-2 border-gray-200 bg-white p-5 text-left transition-all hover:border-gray-400 hover:shadow-sm"
                    onClick={onAdvanced}
                >
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-gray-100 p-3">
                            <Wrench size={24} className="text-gray-500" />
                        </div>
                        <div>
                            <h4 className="text-base font-semibold text-gray-800">Build from scratch</h4>
                            <p className="mt-0.5 text-sm text-gray-500">
                                Use the visual drag-and-drop editor to build a custom workflow with full control.
                            </p>
                        </div>
                    </div>
                </button>

                <div className="flex justify-start">
                    <Button variant="outline" size="lg" onClick={onBack} className="gap-2">
                        <ArrowLeft size={16} /> Back
                    </Button>
                </div>
            </div>
        );
    }

    // ─── Question wizard view ───
    const visibleQuestions = selectedTemplate.questions.filter((q) => {
        if (!q.showIf) return true;
        const depVal = String(answers[q.showIf.questionId] ?? '');
        return q.showIf.values.includes(depVal);
    });

    return (
        <div className="space-y-6">
            <div>
                <button
                    className="flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-700 mb-3 transition-colors"
                    onClick={() => setSelectedTemplate(null)}
                >
                    <ArrowLeft size={14} /> Back to templates
                </button>
                <div className="flex items-center gap-3">
                    <span className="text-3xl">{selectedTemplate.icon}</span>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">{selectedTemplate.name}</h2>
                        <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border bg-white p-6 space-y-5">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Configure your workflow</h3>

                {visibleQuestions.map((q) => (
                    <QuestionField
                        key={q.id}
                        question={q}
                        value={answers[q.id]}
                        onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
                        instituteId={instituteId}
                        useCaseId={selectedTemplate.id}
                    />
                ))}
            </div>

            {/* Preview — auto-detect pipeline shape from template */}
            <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-4">
                <h4 className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">What will be created</h4>
                <div className="flex flex-wrap items-center gap-1.5 text-sm text-primary-700">
                    {(() => {
                        // Generate a preview by running the generator with placeholder answers
                        const previewAnswers: Record<string, string | number> = {};
                        selectedTemplate.questions.forEach((q) => {
                            if (q.defaultValue !== undefined) previewAnswers[q.id] = q.defaultValue;
                            else if (q.type === 'text') previewAnswers[q.id] = 'admin@example.com';
                            else if (q.type === 'number') previewAnswers[q.id] = 1;
                            else previewAnswers[q.id] = 'preview';
                        });
                        const preview = selectedTemplate.generateWorkflow(previewAnswers, triggerConfig.eventName || undefined);

                        const nodeColors: Record<string, string> = {
                            TRIGGER: 'bg-green-100 text-green-700',
                            QUERY: 'bg-cyan-100 text-cyan-700',
                            SEND_EMAIL: 'bg-purple-100 text-purple-700',
                            DELAY: 'bg-slate-100 text-slate-700',
                            CONDITION: 'bg-yellow-100 text-yellow-700',
                            FILTER: 'bg-teal-100 text-teal-700',
                        };

                        return preview.nodes.map((n, i) => (
                            <span key={n.id} className="flex items-center gap-1.5">
                                {i > 0 && <span className="text-gray-300">→</span>}
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${nodeColors[n.data.nodeType as string] ?? 'bg-blue-100 text-blue-700'}`}>
                                    {(n.data.nodeType as string).replace(/_/g, ' ')}
                                </span>
                            </span>
                        ));
                    })()}
                </div>
            </div>

            <div className="flex justify-between">
                <Button variant="outline" size="lg" onClick={() => setSelectedTemplate(null)} className="gap-2">
                    <ArrowLeft size={16} /> Back
                </Button>
                <Button size="lg" onClick={handleGenerate} disabled={!canGenerate} className="gap-2 px-8">
                    <CheckCircle size={16} /> Generate Workflow
                </Button>
            </div>
        </div>
    );
}
