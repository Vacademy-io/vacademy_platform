import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkle, PencilSimple, FileText, Plus, Minus } from '@phosphor-icons/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
    CriteriaJson,
    CriteriaItem,
    CriteriaSource,
    generateAICriteria,
    listCriteriaTemplates,
    createCriteriaTemplate,
    EvaluationCriteriaTemplate,
    calculateTotalMarks,
    validateCriteriaMarks,
} from '../../../-services/criteria-services';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { MyInput } from '@/components/design-system/input';
import SelectField from '@/components/design-system/select-field';
import { toast } from 'sonner';
import { useMutation, useQuery } from '@tanstack/react-query';
import { DashboardLoader } from '@/components/core/dashboard-loader';

interface QuestionData {
    id?: string;
    text: string;
    question_type: string;
    max_marks: number;
    subject?: string;
}

interface AddEditCriteriaDialogProps {
    question: QuestionData;
    existingCriteria?: CriteriaJson;
    open: boolean;
    onSave: (criteria: CriteriaJson, source: CriteriaSource) => void;
    onClose: () => void;
}

export const AddEditCriteriaDialog = ({
    question,
    existingCriteria,
    open,
    onSave,
    onClose,
}: AddEditCriteriaDialogProps) => {
    const [selectedTab, setSelectedTab] = useState<'ai' | 'manual' | 'template'>('manual');
    const [aiGeneratedCriteria, setAiGeneratedCriteria] = useState<CriteriaJson | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [manualCriteria, setManualCriteria] = useState<CriteriaItem[]>(
        existingCriteria?.criteria || [{ name: '', description: '', max_marks: 0 }]
    );
    const [saveAsTemplate, setSaveAsTemplate] = useState<boolean>(false);

    // Generate AI Criteria Mutation
    const generateMutation = useMutation({
        mutationFn: () =>
            generateAICriteria({
                question_text: question.text,
                question_type: question.question_type,
                subject: question.subject || '',
                max_marks: question.max_marks,
            }),
        onSuccess: (data) => {
            setAiGeneratedCriteria(data);
            toast.success('Criteria generated successfully!');
        },
        onError: () => {
            toast.error('Failed to generate criteria. Please try again.');
        },
    });

    // List Templates Query
    const { data: templates = [], isLoading: templatesLoading } = useQuery({
        queryKey: ['criteria-templates', question.subject, question.question_type],
        queryFn: () =>
            listCriteriaTemplates({
                subject: question.subject,
                question_type: question.question_type,
            }),
        enabled: open && selectedTab === 'template',
    });

    // Create Template Mutation
    const createTemplateMutation = useMutation({
        mutationFn: createCriteriaTemplate,
        onSuccess: () => {
            toast.success('Criteria saved as template!');
        },
        onError: () => {
            toast.error('Failed to save template');
        },
    });

    const handleSave = async () => {
        let criteriaToSave: CriteriaJson | null = null;
        let source: CriteriaSource = 'manual';

        if (selectedTab === 'ai' && aiGeneratedCriteria) {
            criteriaToSave = aiGeneratedCriteria;
            source = 'ai';
        } else if (selectedTab === 'manual') {
            const totalMarks = calculateTotalMarks(manualCriteria);
            const validation = validateCriteriaMarks(totalMarks, question.max_marks);

            if (!validation.isValid) {
                toast.error(validation.message || 'Invalid marks distribution');
                return;
            }

            criteriaToSave = {
                max_marks: question.max_marks,
                criteria: manualCriteria.filter((c) => c.name.trim() !== ''),
            };
            source = 'manual';

            // Save as template if checkbox is checked
            if (saveAsTemplate) {
                const templateName = `${question.question_type} - ${question.max_marks} marks`;
                try {
                    await createTemplateMutation.mutateAsync({
                        name: templateName,
                        subject: question.subject || 'General',
                        questionType: question.question_type,
                        description: `Manual criteria template for ${question.question_type}`,
                        criteriaJson: criteriaToSave,
                    });
                } catch (error) {
                    // Template save failed, but continue with saving criteria
                    console.error('Template save failed:', error);
                }
            }
        } else if (selectedTab === 'template' && selectedTemplate) {
            const template = templates.find((t) => t.id === selectedTemplate);
            if (template) {
                criteriaToSave = template.criteriaJson;
                source = 'template';
            }
        }

        if (criteriaToSave) {
            onSave(criteriaToSave, source);
            onClose();
            toast.success('Criteria saved successfully!');
        } else {
            toast.error('Please complete the criteria before saving');
        }
    };

    const addManualCriteriaRow = () => {
        setManualCriteria([...manualCriteria, { name: '', description: '', max_marks: 0 }]);
    };

    const removeManualCriteriaRow = (index: number) => {
        setManualCriteria(manualCriteria.filter((_, i) => i !== index));
    };

    const updateManualCriteria = (index: number, field: keyof CriteriaItem, value: any) => {
        const updated = [...manualCriteria];
        updated[index] = { ...updated[index], [field]: value } as CriteriaItem;
        setManualCriteria(updated);
    };

    const manualTotalMarks = calculateTotalMarks(manualCriteria);
    const isManualValid = manualTotalMarks === question.max_marks;

    return (
        <MyDialog
            open={open}
            onOpenChange={onClose}
            heading={`${existingCriteria ? 'Edit' : 'Add'} Evaluation Criteria`}
            dialogWidth="max-w-3xl"
            footer={
                <>
                    <MyButton type="button" scale="large" buttonType="secondary" onClick={onClose}>
                        Cancel
                    </MyButton>
                    <MyButton type="button" scale="large" buttonType="primary" onClick={handleSave}>
                        Save Criteria
                    </MyButton>
                </>
            }
        >
            {/* Question Info */}
            <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-sm text-neutral-600">
                    <strong>Question Type:</strong> {question.question_type}
                </p>
                <p className="text-sm text-neutral-600">
                    <strong>Max Marks:</strong> {question.max_marks}
                </p>
            </div>

            {/* Tabs */}
            <Tabs
                value={selectedTab}
                onValueChange={(v) => setSelectedTab(v as any)}
                className="flex flex-1 flex-col overflow-hidden"
            >
                <TabsList className="grid w-full grid-cols-3 bg-neutral-100">
                    <TabsTrigger value="manual" className="flex items-center gap-2">
                        <PencilSimple size={16} weight="bold" />
                        Manual
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="flex items-center gap-2">
                        <Sparkle size={16} weight="fill" />
                        AI Generate
                    </TabsTrigger>
                    <TabsTrigger value="template" className="flex items-center gap-2">
                        <FileText size={16} weight="fill" />
                        Use Template
                    </TabsTrigger>
                </TabsList>

                {/* Manual Tab */}
                <TabsContent value="manual" className="flex-1 space-y-4 overflow-y-auto">
                    <div className="space-y-3">
                        {manualCriteria.map((item, index) => (
                            <div
                                key={index}
                                className="space-y-3 rounded-md border border-neutral-200 bg-white p-3"
                            >
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-neutral-700">
                                        Criteria {index + 1}
                                    </h4>
                                    {manualCriteria.length > 1 && (
                                        <button
                                            onClick={() => removeManualCriteriaRow(index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <Minus size={20} />
                                        </button>
                                    )}
                                </div>
                                <MyInput
                                    inputType="text"
                                    inputPlaceholder="e.g., Content Quality"
                                    label="Criteria Name"
                                    input={item.name}
                                    onChangeFunction={(e) =>
                                        updateManualCriteria(index, 'name', e.target.value)
                                    }
                                    required
                                />
                                <MyInput
                                    inputType="text"
                                    inputPlaceholder="e.g., Depth and accuracy of content"
                                    label="Description"
                                    input={item.description}
                                    onChangeFunction={(e) =>
                                        updateManualCriteria(index, 'description', e.target.value)
                                    }
                                />
                                <MyInput
                                    inputType="number"
                                    inputPlaceholder="0"
                                    label="Max Marks"
                                    input={String(item.max_marks)}
                                    onChangeFunction={(e) =>
                                        updateManualCriteria(
                                            index,
                                            'max_marks',
                                            Number(e.target.value)
                                        )
                                    }
                                    required
                                />
                            </div>
                        ))}
                    </div>
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="secondary"
                        onClick={addManualCriteriaRow}
                    >
                        <Plus size={16} className="mr-2" />
                        Add Criteria
                    </MyButton>

                    {/* Save as Template Checkbox */}
                    <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 p-3">
                        <input
                            type="checkbox"
                            id="saveAsTemplate"
                            checked={saveAsTemplate}
                            onChange={(e) => setSaveAsTemplate(e.target.checked)}
                            className="size-4 cursor-pointer rounded border-primary-300 text-primary-600 focus:ring-2 focus:ring-primary-500"
                        />
                        <label
                            htmlFor="saveAsTemplate"
                            className="cursor-pointer text-sm font-medium text-primary-700"
                        >
                            Save as template for reuse ({question.question_type} -{' '}
                            {question.max_marks} marks)
                        </label>
                    </div>

                    <div
                        className={`rounded-md p-3 ${isManualValid ? 'border border-green-200 bg-green-50' : 'border border-yellow-200 bg-yellow-50'}`}
                    >
                        <p
                            className={`text-sm font-medium ${isManualValid ? 'text-green-700' : 'text-yellow-700'}`}
                        >
                            Total: {manualTotalMarks} / {question.max_marks} marks
                            {isManualValid ? ' ✓' : ' (must match question marks)'}
                        </p>
                    </div>
                </TabsContent>

                {/* AI Tab */}
                <TabsContent value="ai" className="flex-1 space-y-4 overflow-y-auto">
                    {generateMutation.isPending ? (
                        <DashboardLoader />
                    ) : aiGeneratedCriteria ? (
                        <>
                            <div className="rounded-md border border-green-200 bg-green-50 p-3">
                                <p className="text-sm font-medium text-green-700">
                                    ✓ Criteria generated successfully!
                                </p>
                            </div>
                            <div className="space-y-3">
                                {aiGeneratedCriteria.criteria.map((item, index) => (
                                    <div
                                        key={index}
                                        className="rounded-md border border-neutral-200 bg-white p-3"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-neutral-800">
                                                    {index + 1}. {item.name}
                                                </h4>
                                                <p className="mt-1 text-sm text-neutral-600">
                                                    {item.description}
                                                </p>
                                            </div>
                                            <span className="ml-3 rounded-md bg-primary-50 px-2 py-1 text-sm font-semibold text-primary-600">
                                                {item.max_marks} marks
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="secondary"
                                onClick={() => {
                                    setAiGeneratedCriteria(null);
                                    generateMutation.mutate();
                                }}
                            >
                                Regenerate
                            </MyButton>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8">
                            <Sparkle size={48} weight="fill" className="mb-4 text-primary-400" />
                            <p className="mb-4 text-neutral-600">
                                Let AI generate evaluation criteria for this question
                            </p>
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="primary"
                                onClick={() => generateMutation.mutate()}
                            >
                                <Sparkle size={16} weight="fill" className="mr-2" />
                                Generate with AI
                            </MyButton>
                        </div>
                    )}
                </TabsContent>

                {/* Template Tab */}
                <TabsContent value="template" className="flex-1 space-y-4 overflow-y-auto">
                    {templatesLoading ? (
                        <DashboardLoader />
                    ) : templates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <FileText size={48} className="mb-4 text-neutral-300" />
                            <p className="text-neutral-500">
                                No templates found for this question type
                            </p>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-neutral-600">Select a template to use:</p>
                            <div className="space-y-2">
                                {templates.map((template) => (
                                    <div
                                        key={template.id}
                                        onClick={() => setSelectedTemplate(template.id || null)}
                                        className={`cursor-pointer rounded-md border p-3 transition-colors ${
                                            selectedTemplate === template.id
                                                ? 'border-primary-500 bg-primary-50'
                                                : 'border-neutral-200 bg-white hover:border-primary-200'
                                        }`}
                                    >
                                        <h4 className="font-medium text-neutral-800">
                                            {template.name}
                                        </h4>
                                        <p className="mt-1 text-sm text-neutral-600">
                                            {template.description}
                                        </p>
                                        <p className="mt-2 text-xs text-neutral-500">
                                            {template.criteriaJson.criteria.length} criteria •{' '}
                                            {template.criteriaJson.max_marks} marks
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </TabsContent>
            </Tabs>
        </MyDialog>
    );
};
