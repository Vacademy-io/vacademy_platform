import { useState } from 'react';
import { toast } from 'sonner';
import { SpinnerGap, Sparkle } from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TemplateSelector } from '@/components/templates/TemplateSelector';
import { MessageTemplate } from '@/types/message-template-types';
import { createMessageTemplate } from '@/services/message-template-service';

export type CredentialDeliveryMode = 'DEFAULT' | 'TEMPLATE';

/** Shape of the "Generate sample" seed each caller supplies for its own event. */
export interface SampleTemplateSeed {
    name: string;
    subject: string;
    content: string;
    variables: string[];
}

interface CredentialDeliveryModePickerProps {
    mode: CredentialDeliveryMode;
    onModeChange: (mode: CredentialDeliveryMode) => void;
    selectedTemplate: MessageTemplate | null;
    onTemplateSelect: (template: MessageTemplate | null) => void;
    /** One-line explanation of what the built-in email contains for THIS action. */
    defaultDescription: string;
    /** One-line explanation of what an institute template can do for THIS action. */
    templateDescription: string;
    /** Omit to hide the "Generate sample" shortcut. */
    buildSample?: () => SampleTemplateSeed;
    disabled?: boolean;
}

/**
 * "Use the system default, or use one of our templates" — the choice that sits in front of every
 * admin-triggered credential email.
 *
 * <p>Both options have to stay reachable per send, which is why this is a picker and not a
 * settings toggle. An institute drafting a branded email still needs the working default while
 * they iterate, and an admin dealing with one confused learner may deliberately want the plain
 * platform mail even where a template exists.
 *
 * <p>Picking a template here is remembered for the institute by the caller (each event has its own
 * binding), so the next admin to open the dialog starts from the same choice rather than
 * re-selecting it every time.
 */
export const CredentialDeliveryModePicker = ({
    mode,
    onModeChange,
    selectedTemplate,
    onTemplateSelect,
    defaultDescription,
    templateDescription,
    buildSample,
    disabled = false,
}: CredentialDeliveryModePickerProps) => {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateSample = async () => {
        if (!buildSample) return;
        setIsGenerating(true);
        try {
            const sample = buildSample();
            const created = await createMessageTemplate({
                name: sample.name,
                type: 'EMAIL',
                subject: sample.subject,
                content: sample.content,
                variables: sample.variables,
                templateType: 'transactional',
            });
            onTemplateSelect(created);
            toast.success('Sample template created and selected');
        } catch (error) {
            console.error('Error generating sample template:', error);
            toast.error('Failed to generate sample template. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <RadioGroup
                value={mode}
                onValueChange={(value) => onModeChange(value as CredentialDeliveryMode)}
                disabled={disabled}
                className="flex flex-col gap-2"
            >
                <label
                    htmlFor="delivery-mode-default"
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3 hover:border-primary-200"
                >
                    <RadioGroupItem value="DEFAULT" id="delivery-mode-default" className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-neutral-700">System default</span>
                        <span className="text-xs text-neutral-500">{defaultDescription}</span>
                    </span>
                </label>

                <label
                    htmlFor="delivery-mode-template"
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3 hover:border-primary-200"
                >
                    <RadioGroupItem
                        value="TEMPLATE"
                        id="delivery-mode-template"
                        className="mt-0.5"
                    />
                    <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-neutral-700">
                            Use an email template
                        </span>
                        <span className="text-xs text-neutral-500">{templateDescription}</span>
                    </span>
                </label>
            </RadioGroup>

            {mode === 'TEMPLATE' && (
                <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
                    <TemplateSelector
                        templateType="EMAIL"
                        selectedTemplate={selectedTemplate}
                        onTemplateSelect={onTemplateSelect}
                        variant="dropdown"
                        disabled={disabled || isGenerating}
                        placeholder="Select an email template"
                        // Rendered inside a Dialog: a portalled list can't be scrolled there.
                        portal={false}
                    />

                    {buildSample && (
                        <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-normal text-neutral-500">
                                No suitable template yet?
                            </Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleGenerateSample}
                                disabled={disabled || isGenerating}
                                title="Create a ready-to-edit template with the placeholders already in place"
                            >
                                {isGenerating ? (
                                    <SpinnerGap className="mr-2 size-4 animate-spin" />
                                ) : (
                                    <Sparkle className="mr-2 size-4 text-warning-500" />
                                )}
                                {isGenerating ? 'Generating…' : 'Generate sample'}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
