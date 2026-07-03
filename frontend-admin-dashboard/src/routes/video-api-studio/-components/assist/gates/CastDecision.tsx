import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getUserId } from '@/utils/userDetails';
import {
    ArrowCounterClockwise,
    Check,
    UploadSimple,
    User as UserIcon,
    UsersThree,
} from '@phosphor-icons/react';
import type {
    CastGateCharacter,
    DecisionAnswer,
    DecisionRequest,
} from '../../../-services/video-generation';

interface CastDecisionProps {
    decision: DecisionRequest;
    isSubmitting?: boolean;
    onSubmit: (answer: DecisionAnswer) => void;
}

interface CharState {
    /** Uploaded replacement portrait. */
    url?: string;
    /** Redo-with-note toggle + text. */
    redo?: boolean;
    note?: string;
}

/**
 * Cast gate — approve the characters' portraits BEFORE any dialogue clip is
 * filmed. A wrong face here multiplies across every scene (and every clip
 * costs real money), so this is the cheapest moment to fix it: keep, upload
 * your own image (your mascot, a real person), or regenerate with a note.
 */
export function CastDecision({ decision, isSubmitting, onSubmit }: CastDecisionProps) {
    const characters = useMemo<CastGateCharacter[]>(() => {
        const raw = (decision.payload?.characters as CastGateCharacter[]) ?? [];
        return Array.isArray(raw) ? raw.filter((c) => c && c.name) : [];
    }, [decision.payload]);

    const [state, setState] = useState<Record<string, CharState>>({});
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const pendingUploadFor = useRef<string | null>(null);
    const { uploadFile, getPublicUrl } = useFileUpload();

    const patch = (name: string, p: CharState) =>
        setState((prev) => ({ ...prev, [name]: { ...prev[name], ...p } }));

    const startUpload = (name: string) => {
        pendingUploadFor.current = name;
        fileInputRef.current?.click();
    };

    const onFilePicked = async (file: File | null) => {
        const name = pendingUploadFor.current;
        pendingUploadFor.current = null;
        if (!file || !name) return;
        setUploadingFor(name);
        try {
            const fileId = await uploadFile({
                file,
                setIsUploading: () => {},
                userId: getUserId(),
                source: 'AI_INPUT_IMAGE',
                sourceId: 'ADMIN',
                publicUrl: true,
            });
            const url = fileId ? await getPublicUrl(fileId) : null;
            if (!url) throw new Error('Upload failed');
            patch(name, { url, redo: false, note: undefined });
        } catch {
            toast.error('Upload failed. Try a smaller image.');
        } finally {
            setUploadingFor(null);
        }
    };

    const changes = characters.filter((c) => {
        const st = state[c.name] ?? {};
        return st.url || (st.redo && st.note?.trim());
    }).length;
    const hasEmptyRedoNote = characters.some((c) => {
        const st = state[c.name] ?? {};
        return st.redo && !st.note?.trim() && !st.url;
    });

    const submit = () => {
        if (changes === 0) {
            onSubmit({ kind: 'accept_recommended' });
            return;
        }
        const edits: Array<{ name: string; url?: string; regen_note?: string }> = [];
        for (const c of characters) {
            const st = state[c.name] ?? {};
            if (st.url) edits.push({ name: c.name, url: st.url });
            else if (st.redo && st.note?.trim())
                edits.push({ name: c.name, regen_note: st.note.trim() });
        }
        onSubmit({ kind: 'edit', gate_type: 'cast', characters: edits });
    };

    return (
        <div className="rounded-xl border bg-white shadow-sm dark:bg-card">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-foreground">
                <span className="flex size-7 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
                    <UsersThree className="size-4 text-violet-600" />
                </span>
                Meet your cast · {characters.length}
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2">
                {characters.map((c) => {
                    const st = state[c.name] ?? {};
                    const shownUrl = st.url ?? c.sheet_url ?? null;
                    const edited = !!(st.url || (st.redo && st.note?.trim()));
                    return (
                        <div
                            key={c.name}
                            className={cn(
                                'overflow-hidden rounded-lg border',
                                edited && 'border-violet-500 ring-1 ring-violet-500'
                            )}
                        >
                            {shownUrl ? (
                                <img
                                    src={shownUrl}
                                    alt={c.name}
                                    className="aspect-square w-full bg-muted object-cover object-top"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="flex aspect-square w-full items-center justify-center bg-muted">
                                    <UserIcon className="size-8 text-muted-foreground/40" />
                                </div>
                            )}
                            <div className="space-y-1.5 p-2.5">
                                <p className="text-sm font-medium text-foreground">
                                    {c.name}
                                    {c.voice_hint ? (
                                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                                            · {c.voice_hint}
                                        </span>
                                    ) : null}
                                </p>
                                {c.visual_description ? (
                                    <p className="line-clamp-2 text-xs text-muted-foreground">
                                        {c.visual_description}
                                    </p>
                                ) : null}
                                <div className="flex gap-1.5 pt-0.5">
                                    <Button
                                        variant={st.redo ? 'secondary' : 'ghost'}
                                        size="sm"
                                        disabled={isSubmitting}
                                        onClick={() =>
                                            patch(c.name, { redo: !st.redo, url: undefined })
                                        }
                                        className="h-6 gap-1 px-1.5 text-xs"
                                    >
                                        <ArrowCounterClockwise className="size-3" />
                                        Redo
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={isSubmitting || uploadingFor === c.name}
                                        onClick={() => startUpload(c.name)}
                                        className="h-6 gap-1 px-1.5 text-xs"
                                    >
                                        <UploadSimple className="size-3" />
                                        {uploadingFor === c.name
                                            ? 'Uploading…'
                                            : st.url
                                              ? 'Replace'
                                              : 'Use my image'}
                                    </Button>
                                </div>
                                {st.redo && !st.url && (
                                    <Textarea
                                        value={st.note ?? ''}
                                        disabled={isSubmitting}
                                        onChange={(e) => patch(c.name, { note: e.target.value })}
                                        placeholder="What should change? e.g. older, warmer smile, formal saree…"
                                        className="min-h-14 text-xs"
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
                <span className="text-xs text-muted-foreground">
                    {changes > 0
                        ? `${changes} portrait${changes === 1 ? '' : 's'} will be updated before filming.`
                        : 'These faces will appear in every scene.'}
                </span>
                <Button
                    size="sm"
                    disabled={isSubmitting || uploadingFor !== null || hasEmptyRedoNote}
                    onClick={submit}
                    className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
                >
                    <Check className="size-4" />
                    {changes > 0 ? `Update ${changes} & film` : 'Approve cast & film'}
                </Button>
            </div>
        </div>
    );
}
