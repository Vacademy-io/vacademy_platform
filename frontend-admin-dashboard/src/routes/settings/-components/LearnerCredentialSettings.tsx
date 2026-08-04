import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { TemplateSelector } from '@/components/templates';
import { MessageTemplate } from '@/types/message-template-types';
import { getMessageTemplate } from '@/services/message-template-service';
import { getInstituteId } from '@/constants/helper';
import {
    getCredentialTemplateConfig,
    setCredentialTemplateConfig,
    clearCredentialTemplateConfig,
    type CredentialChannel,
} from '@/services/student-list-section/updateStudentCredentials';

/**
 * Picks the template used whenever a learner is sent their portal credentials —
 * from the Portal Access → Edit Credentials dialog today, and from any future
 * flow bound to the same LEARNER_CREDENTIALS_SHARED event.
 *
 * One selector per channel, because they are bound independently server-side: an
 * institute can run email only, add WhatsApp later, or use wording on WhatsApp
 * that its provider has approved while email stays fully branded.
 *
 * A channel with nothing selected sends nothing. That is deliberate — falling
 * back to generic platform wording would put an unapproved message in front of
 * that institute's learners.
 */
function CredentialTemplateChannel({
    channel,
    label,
    description,
}: {
    channel: CredentialChannel;
    label: string;
    description: string;
}) {
    const queryClient = useQueryClient();
    const instituteId = getInstituteId() ?? '';
    const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);

    const queryKey = ['learner-credential-template-config', instituteId, channel];

    const { data: config, isLoading } = useQuery({
        queryKey,
        queryFn: () => getCredentialTemplateConfig(instituteId, channel),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });

    useEffect(() => {
        if (!config?.template_id) {
            setSelectedTemplate(null);
            return;
        }
        getMessageTemplate(config.template_id)
            .then(setSelectedTemplate)
            .catch(() => setSelectedTemplate(null));
    }, [config?.template_id]);

    const { mutate: saveSelection } = useMutation({
        mutationFn: (templateId: string | null) =>
            templateId
                ? setCredentialTemplateConfig(instituteId, channel, templateId)
                : clearCredentialTemplateConfig(instituteId, channel),
        onSuccess: () => {
            toast.success(`${label} updated`);
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => {
            toast.error(`Failed to update ${label.toLowerCase()}`);
        },
    });

    const handleTemplateSelect = (template: MessageTemplate | null) => {
        setSelectedTemplate(template);
        saveSelection(template?.id ?? null);
    };

    return (
        <div className="flex flex-col gap-2">
            <Label>{label}</Label>
            <p className="text-caption text-neutral-500">{description}</p>
            {isLoading ? (
                <div className="text-body text-neutral-500">Loading template selection…</div>
            ) : (
                <TemplateSelector
                    templateType={channel}
                    selectedTemplate={selectedTemplate}
                    onTemplateSelect={handleTemplateSelect}
                    variant="dropdown"
                    placeholder={`No template selected — ${channel === 'EMAIL' ? 'emails' : 'WhatsApp messages'} are skipped until one is chosen`}
                />
            )}
        </div>
    );
}

export default function LearnerCredentialSettings() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Learner Credential Messages</CardTitle>
                <CardDescription>
                    Choose the template used when an admin sends a learner their username and
                    password. Templates can use <code>{'{{user_name}}'}</code>,{' '}
                    <code>{'{{user_password}}'}</code>, <code>{'{{user_full_name}}'}</code>,{' '}
                    <code>{'{{portal_url}}'}</code> and <code>{'{{institute_name}}'}</code>.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <CredentialTemplateChannel
                    channel="EMAIL"
                    label="Credential Email Template"
                    description="Sent from the Edit Credentials dialog when an admin picks Email."
                />
                <CredentialTemplateChannel
                    channel="WHATSAPP"
                    label="Credential WhatsApp Template"
                    description="Must be a template your WhatsApp provider has already approved — it is dispatched by name."
                />
            </CardContent>
        </Card>
    );
}
