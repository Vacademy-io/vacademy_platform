import { useEffect, useState } from 'react';
import { X, EnvelopeSimple, Plus, WhatsappLogo, Warning } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useChatbotFlowStore } from '../-stores/chatbot-flow-store';
import {
    ChatbotFlowSettings,
    ESCALATION_TEMPLATE_VARIABLES,
} from '@/types/chatbot-flow/chatbot-flow-types';
import {
    listTemplates,
    type WhatsAppTemplateDTO,
} from '@/routes/communication/whatsapp-templates/-services/template-api';

interface Props {
    onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Digits, optionally prefixed with +. Spaces, dashes and brackets are stripped before this runs. */
const PHONE_RE = /^\+?\d{8,15}$/;

/**
 * Flow-level settings, stored on `ChatbotFlow.settings`.
 *
 * Decides who hears about a chatbot hand-over ("a learner is waiting for your reply") and which of
 * the institute's existing notification templates renders that alert on each channel. An AI node
 * escalates when the answer isn't in its context (see its "When the AI doesn't know" section);
 * this panel decides who is told and how it reads.
 */
export function FlowSettingsPanel({ onClose }: Props) {
    const flowSettings = useChatbotFlowStore((s) => s.flowSettings);
    const setFlowSettings = useChatbotFlowStore((s) => s.setFlowSettings);
    const instituteId = useChatbotFlowStore((s) => s.instituteId);

    const emails = flowSettings.notificationEmails || [];
    const phones = flowSettings.notificationPhones || [];
    const notifyOnEscalation = flowSettings.notifyOnEscalation !== false;
    const renotifyMinutes = flowSettings.escalationRenotifyMinutes ?? 120;
    const emailTemplate = flowSettings.escalationEmailTemplate || '';
    const whatsappTemplate = flowSettings.escalationWhatsappTemplate || '';

    const [emailTemplates, setEmailTemplates] = useState<WhatsAppTemplateDTO[]>([]);
    const [waTemplates, setWaTemplates] = useState<WhatsAppTemplateDTO[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    useEffect(() => {
        if (!instituteId) return;
        setLoadingTemplates(true);
        Promise.all([listTemplates(instituteId, 'EMAIL'), listTemplates(instituteId, 'WHATSAPP')])
            .then(([email, whatsapp]) => {
                setEmailTemplates(email);
                // Only APPROVED WhatsApp templates can carry a business-initiated message.
                setWaTemplates(whatsapp.filter((t) => t.status === 'APPROVED'));
            })
            .catch(() => toast.error('Could not load notification templates'))
            .finally(() => setLoadingTemplates(false));
    }, [instituteId]);

    const patch = (changes: Partial<ChatbotFlowSettings>) =>
        setFlowSettings({ ...flowSettings, ...changes });

    const selectedWaTemplate = waTemplates.find((t) => t.name === whatsappTemplate);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="flex max-h-full w-full max-w-lg flex-col rounded-lg bg-white shadow-xl">
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
                    <h3 className="text-title font-semibold text-gray-800">Flow Settings</h3>
                    <button
                        onClick={onClose}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <p className="mb-4 text-caption text-gray-500">
                        Who to tell when the chatbot can’t answer and hands a conversation to a human.
                        The same conversations show as <b>Unanswered</b> in the WhatsApp Inbox until
                        someone replies.
                    </p>

                    {/* ---------- Email ---------- */}
                    <SectionHeading icon={<EnvelopeSimple size={16} />} label="Email Recipients" />
                    <RecipientEditor
                        values={emails}
                        placeholder="admin@yourinstitute.com"
                        inputType="email"
                        emptyText="No addresses yet."
                        validate={(v) =>
                            EMAIL_RE.test(v) ? null : 'That doesn’t look like an email address'
                        }
                        normalize={(v) => v.trim().toLowerCase()}
                        onChange={(next) => patch({ notificationEmails: next })}
                    />

                    <TemplateSelect
                        label="Email template"
                        value={emailTemplate}
                        templates={emailTemplates}
                        loading={loadingTemplates}
                        emptyOptionLabel="Built-in layout (no template)"
                        onChange={(name) => patch({ escalationEmailTemplate: name })}
                        hint="Leave on the built-in layout and we’ll compose the email for you."
                    />

                    {/* ---------- WhatsApp ---------- */}
                    <div className="mt-6">
                        <SectionHeading icon={<WhatsappLogo size={16} />} label="WhatsApp Recipients" />
                    </div>
                    <RecipientEditor
                        values={phones}
                        placeholder="919812345678"
                        inputType="tel"
                        emptyText="No numbers yet."
                        validate={(v) =>
                            PHONE_RE.test(v) ? null : 'Enter a full number with country code'
                        }
                        normalize={(v) => v.replace(/[\s()-]/g, '').trim()}
                        onChange={(next) => patch({ notificationPhones: next })}
                    />

                    <TemplateSelect
                        label="WhatsApp template"
                        value={whatsappTemplate}
                        templates={waTemplates}
                        loading={loadingTemplates}
                        emptyOptionLabel="— Select an approved template —"
                        onChange={(name) => patch({ escalationWhatsappTemplate: name })}
                        hint="Only APPROVED templates are listed."
                    />

                    {/* WhatsApp cannot send a business-initiated message without a template, so a
                        number list with no template chosen would silently never fire. Say so. */}
                    {phones.length > 0 && !whatsappTemplate && (
                        <div className="mt-2 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 p-2 text-caption text-amber-800">
                            <Warning size={14} className="mt-px shrink-0" />
                            <span>
                                Pick a WhatsApp template — without one these numbers won’t be
                                messaged. WhatsApp only allows business-initiated messages from an
                                approved template.
                            </span>
                        </div>
                    )}

                    {selectedWaTemplate?.bodyText && (
                        <p className="mt-1 truncate text-caption text-gray-400">
                            {selectedWaTemplate.bodyText}
                        </p>
                    )}

                    {/* ---------- Variables reference ---------- */}
                    {(emailTemplate || whatsappTemplate) && (
                        <div className="mt-4 rounded border bg-gray-50 p-2">
                            <p className="mb-1 text-caption font-medium text-gray-600">
                                Available placeholders
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {ESCALATION_TEMPLATE_VARIABLES.map((v) => (
                                    <span
                                        key={v.key}
                                        title={v.description}
                                        className="rounded bg-white px-1.5 py-px font-mono text-caption text-gray-600 ring-1 ring-gray-200"
                                    >
                                        {`{{${v.key}}}`}
                                    </span>
                                ))}
                            </div>
                            <p className="mt-1 text-caption text-gray-400">
                                Name your template’s variables to match these and they’ll be filled in
                                automatically.
                            </p>
                        </div>
                    )}

                    {/* ---------- Delivery controls ---------- */}
                    <label className="mt-6 flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            checked={notifyOnEscalation}
                            onChange={(e) => patch({ notifyOnEscalation: e.target.checked })}
                            className="rounded"
                        />
                        <span className="text-body">Send these alerts on hand-over</span>
                    </label>

                    <div className="mt-3">
                        <label className="mb-1 block text-caption font-medium text-gray-600">
                            Don’t re-alert the same conversation for (minutes)
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={10080}
                            value={renotifyMinutes}
                            onChange={(e) =>
                                patch({
                                    escalationRenotifyMinutes: parseInt(e.target.value, 10) || 120,
                                })
                            }
                            className="w-32 rounded border px-2 py-1.5 text-body"
                        />
                        <p className="mt-1 text-caption text-gray-400">
                            A learner who keeps asking while nobody has answered still produces one
                            reminder, not a flood.
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 justify-end gap-2 border-t px-4 py-3">
                    <button
                        onClick={onClose}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-body text-white hover:bg-blue-700"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

function SectionHeading({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="mb-1.5 flex items-center gap-1.5 text-body font-medium text-gray-700">
            {icon} {label}
        </div>
    );
}

/** Chip editor shared by the email and phone lists. */
function RecipientEditor({
    values,
    placeholder,
    inputType,
    emptyText,
    validate,
    normalize,
    onChange,
}: {
    values: string[];
    placeholder: string;
    inputType: 'email' | 'tel';
    emptyText: string;
    validate: (value: string) => string | null;
    normalize: (value: string) => string;
    onChange: (next: string[]) => void;
}) {
    const [draft, setDraft] = useState('');
    const [error, setError] = useState<string | null>(null);

    const add = () => {
        const candidate = normalize(draft);
        if (!candidate) return;
        const problem = validate(candidate);
        if (problem) {
            setError(problem);
            return;
        }
        if (values.includes(candidate)) {
            setError('Already on the list');
            return;
        }
        onChange([...values, candidate]);
        setDraft('');
        setError(null);
    };

    return (
        <>
            <div className="mb-2 flex flex-wrap gap-1.5">
                {values.length === 0 && (
                    <span className="text-caption italic text-gray-400">{emptyText}</span>
                )}
                {values.map((value) => (
                    <span
                        key={value}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-caption text-gray-700"
                    >
                        {value}
                        <button
                            onClick={() => onChange(values.filter((v) => v !== value))}
                            className="text-gray-400 hover:text-red-500"
                            title={`Remove ${value}`}
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}
            </div>

            <div className="flex gap-2">
                <input
                    type={inputType}
                    value={draft}
                    onChange={(e) => {
                        setDraft(e.target.value);
                        setError(null);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            add();
                        }
                    }}
                    placeholder={placeholder}
                    className="flex-1 rounded border px-2 py-1.5 text-body"
                />
                <button
                    onClick={add}
                    className="inline-flex items-center gap-1 rounded bg-gray-800 px-3 py-1.5 text-body text-white hover:bg-gray-700"
                >
                    <Plus size={14} /> Add
                </button>
            </div>
            {error && <p className="mt-1 text-caption text-red-500">{error}</p>}
        </>
    );
}

function TemplateSelect({
    label,
    value,
    templates,
    loading,
    emptyOptionLabel,
    hint,
    onChange,
}: {
    label: string;
    value: string;
    templates: WhatsAppTemplateDTO[];
    loading: boolean;
    emptyOptionLabel: string;
    hint: string;
    onChange: (name: string) => void;
}) {
    // A template named in settings but missing from the list (deleted, or no longer approved) must
    // stay visible — silently resetting it to "none" would change behaviour without saying so.
    const isOrphan = value !== '' && !templates.some((t) => t.name === value);

    return (
        <div className="mt-3">
            <label className="mb-1 block text-caption font-medium text-gray-600">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-body"
                disabled={loading}
            >
                <option value="">{loading ? 'Loading templates…' : emptyOptionLabel}</option>
                {isOrphan && <option value={value}>{value} (not found)</option>}
                {templates.map((t) => (
                    <option key={t.id || t.name} value={t.name}>
                        {t.name}
                        {t.language ? ` (${t.language})` : ''}
                    </option>
                ))}
            </select>
            {isOrphan ? (
                <p className="mt-1 text-caption text-amber-600">
                    “{value}” isn’t in this institute’s templates any more.
                </p>
            ) : (
                <p className="mt-1 text-caption text-gray-400">{hint}</p>
            )}
        </div>
    );
}
