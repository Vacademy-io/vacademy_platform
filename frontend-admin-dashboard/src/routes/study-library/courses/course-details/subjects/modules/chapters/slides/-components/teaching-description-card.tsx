import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChalkboardTeacher, CircleNotch, FloppyDisk } from '@phosphor-icons/react';
import { Textarea } from '@/components/ui/textarea';
import { MyButton } from '@/components/design-system/button';
import { getTutorSlidePlan, putTutorSourceDescription } from '@/services/tutor';

interface TeachingDescriptionCardProps {
    slideId: string;
    kind: 'video' | 'pdf';
}

/**
 * "What this video / PDF teaches" — the only source the Live AI Tutor has for
 * slides whose body is not text. Saving parks the slide's plan as STALE so the
 * course page's "Prepare for teaching" compiles it (design §4.2).
 */
export const TeachingDescriptionCard: React.FC<TeachingDescriptionCardProps> = ({ slideId, kind }) => {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [saved, setSaved] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getTutorSlidePlan(slideId, true)
            .then((p) => {
                if (cancelled) return;
                const d = p.source_description ?? '';
                setText(d);
                setSaved(d);
            })
            .catch(() => {
                /* no plan yet: empty */
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [slideId]);

    const save = async () => {
        setSaving(true);
        try {
            await putTutorSourceDescription(slideId, text.trim());
            setSaved(text.trim());
            toast.success('Saved. Open the course’s Tutor Mode tab and press “Prepare for teaching”.');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Could not save');
        } finally {
            setSaving(false);
        }
    };

    const what = kind === 'video' ? 'video' : 'PDF';
    return (
        <div className="mt-3 rounded-md border border-neutral-200 bg-white">
            <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                onClick={() => setOpen((v) => !v)}
            >
                <ChalkboardTeacher className="size-4 text-primary-500" />
                AI teacher: what this {what} teaches
                {loading ? (
                    <CircleNotch className="size-3 animate-spin text-neutral-400" />
                ) : saved ? (
                    <span className="text-xs font-normal text-success-700">described</span>
                ) : (
                    <span className="text-xs font-normal text-warning-700">not described yet</span>
                )}
                <span className="ml-auto text-xs font-normal text-neutral-500">{open ? 'Hide' : 'Edit'}</span>
            </button>
            {open && (
                <div className="space-y-2 border-t border-neutral-100 p-3">
                    <p className="text-xs text-neutral-600">
                        The AI teacher cannot watch or read this {what}. Write the points it covers (3–10
                        sentences). In tutor mode the teacher asks the learner to {kind === 'video' ? 'watch' : 'read'}{' '}
                        it, then checks those points before moving on.
                    </p>
                    <Textarea
                        value={text}
                        rows={5}
                        maxLength={8000}
                        placeholder={`This ${what} explains…`}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <div className="flex justify-end">
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            layoutVariant="default"
                            disable={saving || text.trim().length < 10 || text.trim() === saved}
                            onClick={() => void save()}
                        >
                            {saving ? <CircleNotch className="size-4 animate-spin" /> : <FloppyDisk className="size-4" />}
                            Save
                        </MyButton>
                    </div>
                </div>
            )}
        </div>
    );
};
