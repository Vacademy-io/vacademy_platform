/**
 * "When the call ends like this, send that" — the action rules for one AI agent.
 *
 * The agent already offers a quiz link, a brochure and an advisor call on nearly every
 * call and nothing is sent today. Each rule here closes one of those promises. See
 * docs/crm/AI_CALL_ACTIONS.md.
 *
 * Deliberately a questionnaire, not a rule builder: SuchBliss-style admins are not
 * technical, so every rule reads as one sentence — WHEN <trigger> DO <action> USING
 * <template>. The predicate vocabulary is the agent's OWN dispositions and extraction
 * questions, so there is nothing new to learn and nothing to spell correctly.
 */
import { Plus, Trash, WhatsappLogo, EnvelopeSimple, CalendarCheck } from '@phosphor-icons/react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { whatsappTemplateService } from '@/services/whatsapp-template-service';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { fetchEmailTemplates } from '@/routes/calling/ai-agents/-services/ai-agents';
import type { AiCallActionRule } from '@/routes/settings/-components/AiAgentsCard';

type TriggerKind = 'promised' | 'disposition' | 'meeting' | 'extracted';

interface Props {
    rules: AiCallActionRule[];
    dispositions: string[];
    extractionQuestions: string[];
    bookingPages: { id?: string; title?: string }[];
    onChange: (rules: AiCallActionRule[]) => void;
}

/**
 * A stable, spoken-safe key for one artefact. The AI names this key in a mid-call
 * marker and in its post-call report, so it must be plain ASCII with no spaces —
 * anything else is dropped server-side rather than sent.
 */
function slugify(label: string): string {
    return (label || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);
}

function triggerKindOf(rule: AiCallActionRule): TriggerKind {
    const w = rule.when || {};
    if (w.promised) return 'promised';
    if (w.disposition) return 'disposition';
    if (w.meetingRequested) return 'meeting';
    if (w.extracted && Object.keys(w.extracted).length) return 'extracted';
    return 'promised';
}

const BLANK: AiCallActionRule = {
    enabled: true,
    timing: 'POST_CALL',
    actionType: 'SHARE_LINK',
    channel: 'WHATSAPP',
    to: 'phone',
    when: {},
};

export function SendRulesEditor({
    rules,
    dispositions,
    extractionQuestions,
    bookingPages,
    onChange,
}: Props) {
    // Only APPROVED templates are offered. An unapproved name is accepted by us and
    // then rejected by Meta at send time, which surfaces as a failed action hours
    // later instead of as a validation error while the admin is still looking.
    const templatesQuery = useQuery({
        queryKey: ['whatsapp-templates-approved'],
        queryFn: () => whatsappTemplateService.getMetaTemplates(),
        staleTime: 5 * 60 * 1000,
        retry: false,
    });
    const templates = (templatesQuery.data ?? []).filter(
        (t) => (t.status || '').toUpperCase() === 'APPROVED'
    );
    // Three distinct states, and the admin must be able to tell them apart. Falling back
    // to a bare text box for all of them (the first cut) reads as "they forgot to build
    // the dropdown" when the real cause is that this institute has never synced its
    // templates — getMetaTemplates reads the STORED list, it does not call Meta.
    const templatesLoading = templatesQuery.isLoading;
    const templatesFailed = templatesQuery.isError;

    const emailTemplatesQuery = useQuery({
        queryKey: ['institute-email-templates'],
        queryFn: () => fetchEmailTemplates(getCurrentInstituteId() || ''),
        staleTime: 5 * 60 * 1000,
        retry: false,
    });
    const emailTemplates = (emailTemplatesQuery.data ?? []).filter(
        (t) => (t.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
    );

    const [advancedOpen, setAdvancedOpen] = useState<Record<number, boolean>>({});

    const update = (i: number, patch: Partial<AiCallActionRule>) => {
        const next = rules.map((r, n) => (n === i ? { ...r, ...patch } : r));
        onChange(next);
    };

    const setTrigger = (i: number, kind: TriggerKind) => {
        const rule = rules[i];
        if (!rule) return;
        // One predicate at a time. Carrying the old one over would silently AND them
        // together and the rule would stop firing for reasons nothing on screen explains.
        const when: AiCallActionRule['when'] =
            kind === 'promised'
                ? { promised: rule.artefact || slugify(rule.label || '') }
                : kind === 'disposition'
                  ? { disposition: dispositions[0] || '' }
                  : kind === 'meeting'
                    ? { meetingRequested: true }
                    : { extracted: { [extractionQuestions[0] || '']: 'present' } };
        update(i, { when });
    };

    const add = () => onChange([...rules, { ...BLANK, when: {} }]);
    const remove = (i: number) => onChange(rules.filter((_, n) => n !== i));

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <Label>What to send after a call</Label>
                    <p className="text-caption text-neutral-500">
                        The agent promises links and brochures on calls. Add a rule for each
                        promise so it is actually delivered.
                    </p>
                </div>
                <MyButton type="button" buttonType="secondary" scale="small" onClick={add}>
                    <Plus size={14} /> Add rule
                </MyButton>
            </div>

            {rules.length === 0 && (
                <p className="rounded-md border border-dashed border-neutral-200 p-4 text-caption text-neutral-500">
                    No rules yet — this agent sends nothing after a call.
                </p>
            )}

            {rules.map((rule, i) => {
                const kind = triggerKindOf(rule);
                const isMeeting = rule.actionType === 'BOOK_MEETING';
                const isWhatsApp = !isMeeting && rule.channel === 'WHATSAPP';
                return (
                    <div
                        key={rule.id || `new-${i}`}
                        className="space-y-3 rounded-md border border-neutral-200 p-3"
                    >
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={rule.enabled !== false}
                                onCheckedChange={(v) => update(i, { enabled: v })}
                            />
                            <Input
                                className="h-8 flex-1"
                                placeholder="Name this rule, e.g. Course brochure"
                                value={rule.label || ''}
                                onChange={(e) => {
                                    const label = e.target.value;
                                    // The key follows the label only until the rule is saved.
                                    // After that the backend owns the id and the key is part
                                    // of what the AI was told, so renaming must not move it.
                                    const patch: Partial<AiCallActionRule> = { label };
                                    if (!rule.id) {
                                        const key = slugify(label);
                                        patch.artefact = key;
                                        if (triggerKindOf(rule) === 'promised') {
                                            patch.when = { promised: key };
                                        }
                                    }
                                    update(i, patch);
                                }}
                            />
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                onClick={() => remove(i)}
                                aria-label="Remove rule"
                            >
                                <Trash size={14} />
                            </MyButton>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-caption">What the agent asks on the call</Label>
                            <Input
                                className="h-8"
                                placeholder="Kya main aapko WhatsApp par details bhej doon?"
                                value={rule.askLine || ''}
                                onChange={(e) => update(i, { askLine: e.target.value })}
                            />
                            <p className="text-caption text-neutral-500">
                                Write it the way the agent should say it. It is added to the
                                call prompt automatically — don&apos;t also put it in the system
                                prompt. Leave blank if the caller usually brings this up first.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label className="text-caption">When</Label>
                                <Select value={kind} onValueChange={(v) => setTrigger(i, v as TriggerKind)}>
                                    <SelectTrigger className="h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="promised">
                                            The caller accepted this on the call
                                        </SelectItem>
                                        <SelectItem value="disposition">
                                            The call ended with a disposition
                                        </SelectItem>
                                        <SelectItem value="meeting">
                                            The caller agreed to a meeting time
                                        </SelectItem>
                                        <SelectItem value="extracted">
                                            An answer was captured
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                {kind === 'disposition' && (
                                    <Select
                                        value={rule.when?.disposition || ''}
                                        onValueChange={(v) => update(i, { when: { disposition: v } })}
                                    >
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Pick a disposition" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {dispositions.map((d) => (
                                                <SelectItem key={d} value={d}>
                                                    {d}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                {kind === 'extracted' && (
                                    <Select
                                        value={Object.keys(rule.when?.extracted || {})[0] || ''}
                                        onValueChange={(v) =>
                                            update(i, { when: { extracted: { [v]: 'present' } } })
                                        }
                                    >
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Pick a question" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {extractionQuestions.map((q) => (
                                                <SelectItem key={q} value={q}>
                                                    {q}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                {kind === 'disposition' && dispositions.length === 0 && (
                                    <p className="text-caption text-warning-600">
                                        Add dispositions to this agent first.
                                    </p>
                                )}
                                {kind === 'extracted' && extractionQuestions.length === 0 && (
                                    <p className="text-caption text-warning-600">
                                        Add extraction questions to this agent first.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-caption">Do</Label>
                                <Select
                                    value={isMeeting ? 'BOOK_MEETING' : rule.channel || 'WHATSAPP'}
                                    onValueChange={(v) =>
                                        update(
                                            i,
                                            v === 'BOOK_MEETING'
                                                ? {
                                                      actionType: 'BOOK_MEETING',
                                                      channel: undefined,
                                                      to: 'phone',
                                                  }
                                                : {
                                                      actionType: 'SHARE_LINK',
                                                      channel: v as 'WHATSAPP' | 'EMAIL',
                                                      to: v === 'EMAIL' ? 'email' : 'phone',
                                                  }
                                        )
                                    }
                                >
                                    <SelectTrigger className="h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="WHATSAPP">
                                            <span className="flex items-center gap-2">
                                                <WhatsappLogo size={14} /> Send on WhatsApp
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="EMAIL">
                                            <span className="flex items-center gap-2">
                                                <EnvelopeSimple size={14} /> Send by email
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="BOOK_MEETING">
                                            <span className="flex items-center gap-2">
                                                <CalendarCheck size={14} /> Book a meeting
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                {isMeeting ? (
                                    <Select
                                        value={rule.bookingPageId || 'DEFAULT'}
                                        onValueChange={(v) =>
                                            update(i, {
                                                bookingPageId: v === 'DEFAULT' ? undefined : v,
                                            })
                                        }
                                    >
                                        <SelectTrigger className="h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DEFAULT">
                                                Use the agent&apos;s booking page
                                            </SelectItem>
                                            {bookingPages.map((bp) => (
                                                <SelectItem key={bp.id} value={bp.id ?? ''}>
                                                    {bp.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : isWhatsApp && templatesLoading ? (
                                    <Select disabled value="">
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Loading templates..." />
                                        </SelectTrigger>
                                        <SelectContent />
                                    </Select>
                                ) : isWhatsApp && templates.length > 0 ? (
                                    <Select
                                        value={rule.template || ''}
                                        onValueChange={(v) => {
                                            const t = templates.find((x) => x.name === v);
                                            update(i, {
                                                template: v,
                                                templateLanguage: t?.language || undefined,
                                            });
                                        }}
                                    >
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Pick an approved template" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {templates.map((t) => (
                                                <SelectItem key={`${t.name}-${t.language}`} value={t.name}>
                                                    {t.name}
                                                    {t.language ? ` · ${t.language}` : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : isWhatsApp ? (
                                    <>
                                        <Input
                                            className="h-8"
                                            placeholder="Approved template name"
                                            value={rule.template || ''}
                                            onChange={(e) =>
                                                update(i, { template: e.target.value })
                                            }
                                        />
                                        <p className="text-caption text-warning-600">
                                            {templatesFailed
                                                ? 'Could not load your WhatsApp templates. Type the name exactly as Meta approved it.'
                                                : 'No approved templates for this institute yet. Sync them under Settings, WhatsApp Templates, or type the name exactly as Meta approved it.'}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        {emailTemplates.length > 0 && (
                                            <Select
                                                value=""
                                                onValueChange={(v) => {
                                                    const t = emailTemplates.find(
                                                        (x) => x.id === v
                                                    );
                                                    if (!t) return;
                                                    // Copy, do not reference: the email path
                                                    // sends draft_body verbatim, so the rule
                                                    // has to own the text.
                                                    const subject = (t.subject || t.name || '').trim();
                                                    const content = (t.content || '').trim();
                                                    update(i, {
                                                        messageBody: subject
                                                            ? subject + '\n\n' + content
                                                            : content,
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="h-8">
                                                    <SelectValue placeholder="Start from one of your email templates" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {emailTemplates.map((t) => (
                                                        <SelectItem key={t.id} value={t.id}>
                                                            {t.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    <Textarea
                                        rows={4}
                                        placeholder={`Subject line goes here

Namaste {{name}}, ...`}
                                        value={rule.messageBody || ''}
                                        onChange={(e) => update(i, { messageBody: e.target.value })}
                                    />
                                    </>
                                )}
                            </div>
                        </div>

                        {!isMeeting && !isWhatsApp && (
                            <p className="text-caption text-neutral-500">
                                Email is sent exactly as written — the first line becomes the
                                subject. Variables are filled from the lead&apos;s own record:{' '}
                                {'{{name}}'}, {'{{phone}}'}, {'{{email}}'}, any field your form
                                captured (e.g. {'{{course_interested}}'}), and anything the agent
                                captured on the call. A variable that lead has no value for is
                                left as written — so pick a template that matches the data you
                                collect.
                            </p>
                        )}

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label className="text-caption">Send it</Label>
                                <Select
                                    value={rule.timing || 'POST_CALL'}
                                    onValueChange={(v) =>
                                        update(i, { timing: v as 'POST_CALL' | 'MID_CALL' })
                                    }
                                >
                                    <SelectTrigger className="h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="POST_CALL">
                                            After the call ends
                                        </SelectItem>
                                        <SelectItem value="MID_CALL">
                                            During the call, as soon as they say yes
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div />
                        </div>

                        <div>
                            <MyButton
                                type="button"
                                buttonType="text"
                                scale="small"
                                onClick={() =>
                                    setAdvancedOpen((o) => ({ ...o, [i]: !o[i] }))
                                }
                            >
                                {advancedOpen[i] ? 'Hide advanced' : 'Advanced'}
                            </MyButton>
                            {advancedOpen[i] && (
                                <div className="mt-2 space-y-1.5">
                                    <Label className="text-caption">Reference name</Label>
                                    <Input
                                        className="h-8 font-mono text-caption"
                                        value={rule.artefact || ''}
                                        onChange={(e) =>
                                            update(i, { artefact: slugify(e.target.value) })
                                        }
                                    />
                                    <p className="text-caption text-neutral-500">
                                        The short name the AI uses for this item when it reports
                                        what the caller agreed to. Filled in from the rule name.
                                        You only need to change it if two rules would end up with
                                        the same one.
                                    </p>
                                </div>
                            )}
                        </div>

                        {rule.timing === 'MID_CALL' && (
                            <p className="text-caption text-neutral-500">
                                The agent sends this the moment the caller agrees, without
                                waiting for the call to end.
                            </p>
                        )}
                    </div>
                );
            })}

        </div>
    );
}
