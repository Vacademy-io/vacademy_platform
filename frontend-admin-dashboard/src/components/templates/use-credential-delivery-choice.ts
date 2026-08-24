import { useEffect, useState } from 'react';
import { MessageTemplate } from '@/types/message-template-types';
import { getMessageTemplate } from '@/services/message-template-service';
import type { CredentialDeliveryMode } from './CredentialDeliveryModePicker';

interface UseCredentialDeliveryChoiceArgs {
    /** Only loads while the dialog is open — these dialogs are mounted per learner row. */
    enabled: boolean;
    /** Reads the institute's standing binding for this event/channel. */
    loadBoundTemplateId: () => Promise<string | null | undefined>;
    /** Persists the admin's pick as the new standing binding. */
    saveBoundTemplateId: (templateId: string) => Promise<void>;
}

/**
 * The "system default or a template" choice, and the institute-level memory behind it.
 *
 * <p>Opening on the institute's bound template rather than always on DEFAULT is the point: an
 * institute that has authored a branded email chose it deliberately, and making every admin
 * re-select it on every send is how sends go out on the wrong body. DEFAULT stays one click away.
 *
 * <p>Persisting the pick is best-effort. Failing to remember a preference must never block the
 * send the admin is in the middle of — the chosen template is passed with the send explicitly,
 * so it applies either way.
 */
export const useCredentialDeliveryChoice = ({
    enabled,
    loadBoundTemplateId,
    saveBoundTemplateId,
}: UseCredentialDeliveryChoiceArgs) => {
    const [mode, setMode] = useState<CredentialDeliveryMode>('DEFAULT');
    const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;

        (async () => {
            try {
                const templateId = await loadBoundTemplateId();
                if (cancelled || !templateId) return;
                const template = await getMessageTemplate(templateId);
                if (cancelled) return;
                setSelectedTemplate(template);
                setMode('TEMPLATE');
            } catch {
                // No binding, or it points at a template that has since been deleted. Either way
                // the system default is the correct thing to open on.
            }
        })();

        return () => {
            cancelled = true;
        };
        // loadBoundTemplateId is redefined on every render at most call sites; re-running on it
        // would loop. `enabled` is the real trigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    const handleTemplateSelect = (template: MessageTemplate | null) => {
        setSelectedTemplate(template);
        if (!template) return;
        saveBoundTemplateId(template.id).catch(() => {
            /* preference only — the send still uses the template picked here */
        });
    };

    return { mode, setMode, selectedTemplate, handleTemplateSelect };
};
