/**
 * Assistive intake — the wizard's chat-first mode. The AI interviews the
 * admin (one question per turn), requests uploads (logo / photos /
 * inspiration screenshots) when they'd lift the result, and assembles a
 * composer-ready brief. On completion the wizard takes over with the
 * existing confirm → generate → review flow.
 */
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CircleNotch, PaperPlaneTilt, Image as ImageIcon, Sparkle, X } from '@phosphor-icons/react';
import { useToast } from '@/hooks/use-toast';
import { ImageUploadField } from './ImageUploadField';
import {
    intakeAiTurn, IntakeTurn, IntakeResponse, AiPageImage, AiCourseSnapshotItem,
} from '../-services/ai-page-service';

export interface IntakeResult {
    brief: string;
    pageType: string;
    wholeSite: boolean;
    images: AiPageImage[];
    inspiration: string[];
}

const UPLOAD_LABELS: Record<string, string> = {
    logo: 'Upload your logo',
    photo: 'Upload a photo',
    inspiration: 'Upload a screenshot of a site you like',
};

export const AiIntakeChat = ({
    instituteName,
    courses,
    terminology,
    onComplete,
}: {
    instituteName?: string;
    courses: AiCourseSnapshotItem[];
    terminology: Record<string, string>;
    onComplete: (result: IntakeResult) => void;
}) => {
    const { toast } = useToast();
    // Local opening turn — instant, free, and the first real API call only
    // happens once the admin actually replies.
    const opening: IntakeResponse = {
        reply:
            `Hi! I'll help you create ${instituteName ? `${instituteName}'s` : 'your'} website — ` +
            `I'll ask a few quick questions, and you can share your logo, photos, or screenshots of ` +
            `sites you like along the way.\n\nFirst: what is this website mainly for, and what makes ` +
            `your institute special?`,
        chips: ['Attract new admissions', 'Showcase our results', 'Replace our old website'],
        request_upload: null,
        ready: false,
        brief: null,
        page_type: 'homepage',
        whole_site: false,
        run_id: '',
        model: '',
    };
    const [messages, setMessages] = useState<IntakeTurn[]>([
        { role: 'assistant', content: opening.reply },
    ]);
    const [last, setLast] = useState<IntakeResponse | null>(opening);
    const [input, setInput] = useState('');
    // Images staged on the composer bar (sent with the next message).
    const [pendingImages, setPendingImages] = useState<string[]>([]);
    const [uploaderOpen, setUploaderOpen] = useState(false);
    const [uploaderValue, setUploaderValue] = useState('');
    // Everything collected across the conversation, handed to the generator.
    const collectedImages = useRef<AiPageImage[]>([]);
    const collectedInspiration = useRef<string[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    const turnMutation = useMutation({
        mutationFn: (history: IntakeTurn[]) =>
            intakeAiTurn({
                history,
                institute_name: instituteName,
                courses,
                terminology,
            }),
        onSuccess: (res) => {
            setLast(res);
            setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
        },
        onError: (err: any) => {
            const detail = err?.response?.data?.detail;
            toast({
                title: 'Assistant unavailable',
                description: typeof detail === 'string' ? detail : 'Please try again.',
                variant: 'destructive',
            });
        },
    });

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, turnMutation.isPending]);

    const send = (text: string) => {
        const content = text.trim();
        if ((!content && pendingImages.length === 0) || turnMutation.isPending) return;
        // Uploads are classified by what the assistant asked for this turn.
        const kind = last?.request_upload || 'photo';
        for (const url of pendingImages) {
            if (kind === 'inspiration') {
                if (!collectedInspiration.current.includes(url)) collectedInspiration.current.push(url);
            } else if (!collectedImages.current.some((i) => i.url === url)) {
                collectedImages.current.push({ url, kind: kind as AiPageImage['kind'] });
            }
        }
        const turn: IntakeTurn = {
            role: 'user',
            content: content || '(uploaded an image)',
            ...(pendingImages.length ? { image_urls: pendingImages } : {}),
        };
        const history = [...messages, turn];
        setMessages(history);
        setInput('');
        setPendingImages([]);
        setUploaderOpen(false);
        turnMutation.mutate(history);
    };

    const finish = () => {
        if (!last?.brief) return;
        onComplete({
            brief: last.brief,
            pageType: last.page_type || 'homepage',
            wholeSite: last.whole_site,
            images: collectedImages.current,
            inspiration: collectedInspiration.current.slice(0, 3),
        });
    };

    const askingUpload = !!last?.request_upload && !turnMutation.isPending;

    return (
        <div className="flex h-96 flex-col">
            {/* Transcript */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`max-w-sm rounded-lg px-3 py-2 text-sm ${
                                m.role === 'user'
                                    ? 'bg-primary-500 text-white'
                                    : 'border border-gray-200 bg-gray-50 text-gray-800'
                            }`}
                        >
                            <p className="whitespace-pre-wrap">{m.content}</p>
                            {m.image_urls && m.image_urls.length > 0 && (
                                <div className="mt-2 flex gap-1.5">
                                    {m.image_urls.map((u, j) => (
                                        <img key={j} src={u} alt="" className="size-12 rounded object-cover" />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {turnMutation.isPending && (
                    <div className="flex justify-start">
                        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
                            <CircleNotch className="size-4 animate-spin" /> thinking…
                        </div>
                    </div>
                )}
            </div>

            {/* Quick-reply chips */}
            {!turnMutation.isPending && (last?.chips?.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {last!.chips.map((c, i) => (
                        <button
                            key={i}
                            onClick={() => send(c)}
                            className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-500 hover:bg-primary-100"
                        >
                            {c}
                        </button>
                    ))}
                </div>
            )}

            {/* Upload affordance — highlighted when the assistant asked for one */}
            {(uploaderOpen || askingUpload) && (
                <div className="mt-2 rounded-lg border border-primary-100 bg-primary-50 p-2">
                    <ImageUploadField
                        label={UPLOAD_LABELS[last?.request_upload || 'photo'] || 'Add an image'}
                        value={uploaderValue}
                        onChange={(url) => {
                            if (url) {
                                setPendingImages((p) => (p.includes(url) ? p : [...p, url]));
                                setUploaderValue('');
                            }
                        }}
                    />
                </div>
            )}

            {/* Staged images going out with the next message */}
            {pendingImages.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {pendingImages.map((u, i) => (
                        <div key={i} className="relative">
                            <img src={u} alt="" className="size-12 rounded border border-gray-200 object-cover" />
                            <button
                                onClick={() => setPendingImages((p) => p.filter((x) => x !== u))}
                                className="absolute -right-1.5 -top-1.5 rounded-full bg-danger-500 p-0.5 text-white"
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Composer */}
            <div className="mt-2 flex items-center gap-1.5">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="size-9 shrink-0 p-0"
                    title="Attach an image"
                    onClick={() => setUploaderOpen((o) => !o)}
                >
                    <ImageIcon className="size-4" />
                </Button>
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send(input);
                        }
                    }}
                    placeholder={askingUpload ? 'Upload above, or reply here…' : 'Type your answer…'}
                    disabled={turnMutation.isPending && messages.length === 0}
                />
                <Button
                    type="button"
                    size="sm"
                    className="size-9 shrink-0 p-0"
                    onClick={() => send(input)}
                    disabled={turnMutation.isPending || (!input.trim() && pendingImages.length === 0)}
                >
                    <PaperPlaneTilt className="size-4" />
                </Button>
            </div>

            {/* Build handoff — primary once the assistant says it has enough */}
            {last?.brief && messages.length >= 2 && (
                <Button
                    type="button"
                    variant={last.ready ? 'default' : 'outline'}
                    size="sm"
                    className="mt-2 w-full"
                    onClick={finish}
                >
                    <Sparkle className="mr-1.5 size-4" weight="duotone" />
                    {last.ready ? 'Create my website' : 'Skip ahead — build with what we have'}
                </Button>
            )}
        </div>
    );
};
