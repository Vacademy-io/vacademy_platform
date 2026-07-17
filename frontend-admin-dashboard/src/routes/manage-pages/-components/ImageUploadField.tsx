import { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UploadSimple as Upload, CircleNotch as Loader2, Image as ImageIcon, Sparkle } from '@phosphor-icons/react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getPublicUrl } from '@/services/upload_file';
import { getUserId } from '@/utils/userDetails';
import { useToast } from '@/hooks/use-toast';
import { generateAiImage, AiImageKind } from '../-services/ai-page-service';

interface ImageUploadFieldProps {
    label: string;
    value: string;
    onChange: (url: string) => void;
    placeholder?: string;
    /** When set, shows a "Generate with AI" affordance producing this kind of image. */
    aiKind?: AiImageKind;
}

export const ImageUploadField = ({ label, value, onChange, placeholder, aiKind }: ImageUploadFieldProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiBusy, setAiBusy] = useState(false);
    const { uploadFile } = useFileUpload();
    const { toast } = useToast();

    const handleGenerate = async () => {
        if (!aiPrompt.trim() || aiBusy) return;
        try {
            setAiBusy(true);
            const { urls } = await generateAiImage({ prompt: aiPrompt.trim(), kind: aiKind });
            if (urls[0]) {
                onChange(urls[0]);
                setAiOpen(false);
                setAiPrompt('');
            }
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            toast({ title: 'Image generation failed', description: typeof detail === 'string' ? detail : 'Please try again.', variant: 'destructive' });
        } finally {
            setAiBusy(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const userId = getUserId();
        if (!userId) {
            console.error('[ImageUploadField] No userId found');
            return;
        }

        try {
            setIsUploading(true);
            const fileId = await uploadFile({
                file,
                setIsUploading,
                userId,
                source: 'CATALOGUE_IMAGES',
                sourceId: 'ADMIN',
                publicUrl: true,
            });
            if (fileId) {
                // uploadFile returns a file ID, not a URL — resolve it
                const resolvedUrl = await getPublicUrl(fileId);
                onChange(resolvedUrl || fileId);
            }
        } catch (err) {
            console.error('[ImageUploadField] Upload failed:', err);
        } finally {
            setIsUploading(false);
            // Reset input so same file can be re-uploaded if needed
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-2">
            <Label>{label}</Label>

            {/* Thumbnail preview */}
            {value && (
                <div className="relative h-24 w-full overflow-hidden rounded border bg-gray-50">
                    <img
                        src={value}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>
            )}

            {!value && (
                <div className="flex h-16 w-full items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-gray-400">
                    <ImageIcon className="size-5" />
                </div>
            )}

            {/* URL input */}
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || 'https://example.com/image.png'}
                className="text-sm"
            />

            {/* Upload button */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Upload className="mr-2 size-4" />
                            Upload
                        </>
                    )}
                </Button>
                {aiKind && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 text-primary-500"
                        onClick={() => setAiOpen((o) => !o)}
                    >
                        <Sparkle className="mr-2 size-4" weight="duotone" />
                        Generate with AI
                    </Button>
                )}
            </div>

            {/* AI generate prompt row */}
            {aiKind && aiOpen && (
                <div className="space-y-2 rounded border border-primary-100 bg-primary-50 p-2">
                    <Input
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGenerate(); } }}
                        placeholder={aiKind === 'logo' ? 'Describe your logo (e.g. a rocket for a coding academy)' : 'Describe the image you want'}
                        className="text-sm"
                        autoFocus
                    />
                    <Button type="button" size="sm" className="w-full" onClick={handleGenerate} disabled={!aiPrompt.trim() || aiBusy}>
                        {aiBusy ? <><Loader2 className="mr-2 size-4 animate-spin" /> Generating…</> : <><Sparkle className="mr-2 size-4" /> Generate</>}
                    </Button>
                </div>
            )}
        </div>
    );
};
