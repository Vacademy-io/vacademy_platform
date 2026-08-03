import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ChatCircle, PushPin, VideoCamera } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MyDialog } from '@/components/design-system/dialog';
import { Progress } from '@/components/ui/progress';
import { createDirectConversation } from '@/services/chat/chatApi';
import { useLearnerPackagesQuery } from '@/routes/manage-students/students-list/-services/getLearnerPackages';
import { useCreateNote, useMenteeCalls, useStudentTimeline } from '../-hooks/use-mentorship';
import type { MenteeDTO } from '../-types/mentorship-types';

function fmt(v?: string | number | null): string {
    if (v == null) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

interface MenteeDetailDialogProps {
    mentee: MenteeDTO | null;
    instituteId: string | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** A mentee's notes (shared timeline) and scheduled calls (booking), with quick DM. */
export function MenteeDetailDialog({ mentee, instituteId, open, onOpenChange }: MenteeDetailDialogProps) {
    const navigate = useNavigate();
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [messaging, setMessaging] = useState(false);

    const studentUserId = mentee?.student_user_id;
    const timeline = useStudentTimeline(open ? studentUserId : undefined);
    const calls = useMenteeCalls(open ? instituteId : undefined, open ? studentUserId : undefined);
    const createNote = useCreateNote();
    // The mentee's in-progress courses — gives the mentor real learning context.
    const learning = useLearnerPackagesQuery({
        instituteId: instituteId ?? '',
        userId: open ? (studentUserId ?? '') : '',
        type: 'PROGRESS',
        page: 0,
        size: 5,
    });

    if (!mentee) return null;

    const addNote = async () => {
        if (!note.trim() || !studentUserId) return;
        setSaving(true);
        try {
            await createNote.mutateAsync({ studentUserId, title: note.trim() });
            setNote('');
            toast.success('Note added');
        } catch {
            toast.error('Failed to add note');
        } finally {
            setSaving(false);
        }
    };

    const message = async () => {
        if (!studentUserId) return;
        setMessaging(true);
        try {
            const conv = await createDirectConversation({
                targetUserId: studentUserId,
                targetUserName: mentee.name ?? undefined,
                targetUserRole: 'STUDENT',
            });
            navigate({ to: '/chat', search: { conversationId: conv.id } });
        } catch {
            toast.error("Couldn't open the chat. Please try again.");
        } finally {
            setMessaging(false);
        }
    };

    return (
        <MyDialog
            heading={mentee.name || 'Mentee'}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-xl"
            headerActions={
                <MyButton
                    type="button"
                    buttonType="secondary"
                    scale="small"
                    onClick={message}
                    disable={messaging}
                >
                    <ChatCircle size={16} /> Message
                </MyButton>
            }
        >
            <div className="flex flex-col gap-6">
                {mentee.email && (
                    <div className="text-caption text-neutral-500">
                        {mentee.email}
                        {mentee.mobile_number ? ` · ${mentee.mobile_number}` : ''}
                    </div>
                )}

                <section className="flex flex-col gap-3">
                    <span className="text-body font-semibold text-neutral-700">Learning</span>
                    {learning.isLoading ? (
                        <span className="text-caption text-neutral-400">Loading…</span>
                    ) : (learning.data?.content?.length ?? 0) === 0 ? (
                        <span className="text-caption text-neutral-400">No courses in progress.</span>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {(learning.data?.content ?? []).map((c) => {
                                const pct = Math.min(Math.max(c.percentage_completed ?? 0, 0), 100);
                                return (
                                    <div
                                        key={c.package_session_id ?? c.id}
                                        className="flex flex-col gap-1"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-body text-neutral-700">
                                                {c.package_name}
                                            </span>
                                            <span className="text-caption text-neutral-500">
                                                {Math.round(pct)}%
                                            </span>
                                        </div>
                                        <Progress value={pct} className="h-1.5" />
                                        {c.level_name && (
                                            <span className="text-caption text-neutral-400">
                                                {c.level_name}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="flex flex-col gap-3">
                    <span className="text-body font-semibold text-neutral-700">Notes</span>
                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <MyInput
                                input={note}
                                onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setNote(e.target.value)
                                }
                                inputType="text"
                                inputPlaceholder="Add a note…"
                                label="Note"
                            />
                        </div>
                        <MyButton
                            type="button"
                            buttonType="primary"
                            scale="medium"
                            onClick={addNote}
                            disable={saving || !note.trim()}
                        >
                            Add
                        </MyButton>
                    </div>
                    {timeline.isLoading ? (
                        <span className="text-caption text-neutral-400">Loading…</span>
                    ) : (timeline.data?.length ?? 0) === 0 ? (
                        <span className="text-caption text-neutral-400">No notes yet.</span>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {(timeline.data ?? []).map((ev) => (
                                <div key={ev.id} className="rounded-md border border-neutral-100 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-body text-neutral-700">{ev.title}</span>
                                        {ev.is_pinned && (
                                            <PushPin size={14} weight="fill" className="text-primary-500" />
                                        )}
                                    </div>
                                    {ev.description && (
                                        <p className="text-caption text-neutral-500">{ev.description}</p>
                                    )}
                                    <span className="text-caption text-neutral-400">
                                        {ev.actor_name ? `${ev.actor_name} · ` : ''}
                                        {fmt(ev.created_at)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="flex flex-col gap-3">
                    <span className="text-body font-semibold text-neutral-700">Scheduled calls</span>
                    {calls.isLoading ? (
                        <span className="text-caption text-neutral-400">Loading…</span>
                    ) : (calls.data?.length ?? 0) === 0 ? (
                        <span className="text-caption text-neutral-400">No scheduled calls.</span>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {(calls.data ?? []).map((c) => (
                                <div
                                    key={c.id}
                                    className="flex items-center justify-between gap-2 rounded-md border border-neutral-100 p-3"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-body text-neutral-700">
                                            {c.booking_page_title || 'Session'}
                                        </span>
                                        <span className="text-caption text-neutral-400">
                                            {fmt(c.scheduled_start_utc)} · {c.status}
                                        </span>
                                    </div>
                                    {c.meet_link && (
                                        <a
                                            href={c.meet_link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-1 text-caption text-primary-600"
                                        >
                                            <VideoCamera size={14} /> Join
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </MyDialog>
    );
}
