import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import TipTapEditor from '@/components/tiptap/TipTapEditor';

type Placeholder = { label: string; value: string };

export type EmailComposerProps = {
    subject: string;
    htmlBody: string; // stored HTML for sending
    onSubjectChange: (v: string) => void;
    onHtmlBodyChange: (v: string) => void;
    placeholders?: Placeholder[]; // e.g. [{label: 'Name', value: '{{name}}'}]
    sampleData?: Record<string, string | number>; // used in preview substitution
    loadableTemplates?: { id: string; name: string; subject: string; content: string }[];
    onTemplateSelected?: (id: string | undefined) => void;
    allowImage?: boolean;
};

const defaultTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email</title>
  <style>
    body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#f7f7f7; margin:0; padding:24px; }
    .container { max-width: 640px; margin: 0 auto; background:#fff; border-radius: 14px; overflow:hidden; box-shadow: 0 6px 20px rgba(0,0,0,0.06); }
    .header { background:#e8dcd9; padding:20px 24px; color:#6F360F; font-weight: 700; font-size: 20px; }
    .content { padding: 24px; color:#1f2937; line-height:1.6; }
    .footer { padding: 16px 24px; background:#faf7f5; color:#6b7280; font-size: 12px; text-align:center; }
    .btn { display:inline-block; background:#8B4513; color:#fff; padding:10px 14px; border-radius:8px; text-decoration:none; font-weight:600; }
    .img { display:block; max-width:100%; border-radius:10px; }
  </style>
}</head>
<body>
  <div class="container">
    <div class="header">Your Brand</div>
    {{EMAIL_IMAGE}}
    <div class="content">{{EMAIL_BODY}}</div>
    <div class="footer">&copy; ${new Date().getFullYear()} Your Brand</div>
  </div>
</body>
</html>`;

export default function EmailComposer({
    subject,
    htmlBody,
    onSubjectChange,
    onHtmlBodyChange,
    placeholders = [
        { label: 'Name', value: '{{name}}' },
        { label: 'Email', value: '{{email}}' },
    ],
    sampleData = { name: 'Sample User', email: 'sample@example.com' },
    loadableTemplates,
    onTemplateSelected,
    allowImage = true,
}: EmailComposerProps) {
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
    const [showPreview, setShowPreview] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [insertNonce, setInsertNonce] = useState(0);
    const [lastInsert, setLastInsert] = useState<string>('');
    const [showHtmlSource, setShowHtmlSource] = useState(false);

    const previewHtml = useMemo(() => {
        const hasHtmlEnvelope = /<html[\s\S]*<body[\s\S]*<\/body>[\s\S]*<\/html>/i.test(htmlBody);
        const isSnippetLike = /<\w+[^>]*>/.test(htmlBody) && !hasHtmlEnvelope;
        let bodyWithSubs = htmlBody;
        Object.entries(sampleData).forEach(([key, value]) => {
            const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            bodyWithSubs = bodyWithSubs.replace(re, String(value));
        });
        if (hasHtmlEnvelope) return bodyWithSubs;
        const img =
            allowImage && imageUrl
                ? `<div style="padding:16px 24px"><img class="img" src="${imageUrl}" alt="image" /></div>`
                : '';
        const content = isSnippetLike ? bodyWithSubs : bodyWithSubs.replace(/\n/g, '<br/ >');
        return defaultTemplate.replace('{{EMAIL_IMAGE}}', img).replace('{{EMAIL_BODY}}', content);
    }, [htmlBody, sampleData, imageUrl, allowImage]);

    const insertPlaceholder = (ph: string) => {
        setLastInsert(ph);
        setInsertNonce((n) => n + 1);
    };

    const onPickImage = async (file: File) => {
        setIsUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const backendBase =
                import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io';
            const res = await fetch(`${backendBase}/media-service/public/upload-file`, {
                method: 'PUT',
                body: form,
            });
            if (!res.ok) throw new Error(res.statusText);
            const urlText = await res.text();
            if (!/^https?:\/\//i.test(urlText)) throw new Error('Invalid upload URL');
            setImageUrl(urlText);
        } catch (e) {
            setImageUrl(null);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Email Composer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="ec-subject">Subject</Label>
                    <Input
                        id="ec-subject"
                        value={subject}
                        onChange={(e) => onSubjectChange(e.target.value)}
                        placeholder="Subject"
                    />
                </div>

                {loadableTemplates && (
                    <div className="flex items-center gap-2">
                        <Label className="min-w-24">Templates</Label>
                        <Select
                            value={selectedTemplateId}
                            onValueChange={(v) => {
                                setSelectedTemplateId(v);
                                onTemplateSelected?.(v);
                            }}
                        >
                            <SelectTrigger className="w-64">
                                <SelectValue placeholder="Load a template" />
                            </SelectTrigger>
                            <SelectContent>
                                {loadableTemplates.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedTemplateId && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSelectedTemplateId(undefined);
                                    onTemplateSelected?.(undefined);
                                }}
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-sm">Placeholders:</Label>
                    {placeholders.map((p) => (
                        <Button
                            key={p.value}
                            variant="outline"
                            size="sm"
                            onClick={() => insertPlaceholder(p.value)}
                        >
                            {p.label}
                        </Button>
                    ))}
                    {!showHtmlSource && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                try {
                                    const t = await navigator.clipboard.readText();
                                    if (t) insertPlaceholder(t);
                                } catch (e) {
                                    // ignore clipboard errors
                                }
                            }}
                        >
                            Paste HTML
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowHtmlSource((s) => !s)}
                    >
                        {showHtmlSource ? 'Rich Editor' : 'HTML Source'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        onClick={() => setShowPreview((s) => !s)}
                    >
                        {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </Button>
                </div>

                {!showPreview && !showHtmlSource && (
                    <TipTapEditor
                        value={htmlBody}
                        onChange={onHtmlBodyChange}
                        placeholder="Write your email..."
                        minHeight={220}
                        insertTextRequest={
                            lastInsert ? { text: lastInsert, nonce: insertNonce } : undefined
                        }
                    />
                )}
                {!showPreview && showHtmlSource && (
                    <div className="w-full space-y-2">
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    try {
                                        const t = await navigator.clipboard.readText();
                                        if (t) onHtmlBodyChange(t);
                                    } catch (e) {
                                        // ignore clipboard errors
                                    }
                                }}
                            >
                                Paste HTML
                            </Button>
                        </div>
                        <Textarea
                            value={htmlBody}
                            onChange={(e) => onHtmlBodyChange(e.target.value)}
                            className="min-h-[220px] font-mono text-xs"
                            placeholder="Paste or write raw HTML here..."
                        />
                    </div>
                )}
                {showPreview && (
                    <div
                        className="rounded-md border bg-neutral-50 p-2"
                        style={{ minHeight: 220, maxHeight: 420, overflowY: 'auto' }}
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                )}

                {allowImage && (
                    <div className="space-y-2">
                        <Label>Optional Header Image</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="file"
                                accept="image/*"
                                disabled={isUploading}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) onPickImage(f);
                                }}
                            />
                            {imageUrl && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setImageUrl(null)}
                                >
                                    Remove
                                </Button>
                            )}
                        </div>
                        {imageUrl && (
                            <img src={imageUrl} alt="email" className="max-h-40 rounded border" />
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
