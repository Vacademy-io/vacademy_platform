import { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    UploadSimple as Upload,
    CircleNotch as Loader2,
    VideoCamera,
    YoutubeLogo,
} from '@phosphor-icons/react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getPublicUrl } from '@/services/upload_file';
import { getUserId } from '@/utils/userDetails';

interface VideoUploadFieldProps {
    label: string;
    value: string;
    onChange: (url: string) => void;
    placeholder?: string;
}

const isYouTube = (u: string) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(u);
const isVimeo = (u: string) => /^(https?:\/\/)?(www\.)?(player\.)?vimeo\.com\/.+/.test(u);

/**
 * Video counterpart to ImageUploadField: paste a YouTube/Vimeo link OR upload a
 * video file. Upload goes through the same media-service path as images and
 * stores the resolved public URL, so the renderer treats both identically.
 */
export const VideoUploadField = ({ label, value, onChange, placeholder }: VideoUploadFieldProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { uploadFile } = useFileUpload();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const userId = getUserId();
        if (!userId) {
            console.error('[VideoUploadField] No userId found');
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
                const resolvedUrl = await getPublicUrl(fileId);
                onChange(resolvedUrl || fileId);
            }
        } catch (err) {
            console.error('[VideoUploadField] Upload failed:', err);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const embedProvider = isYouTube(value) ? 'YouTube' : isVimeo(value) ? 'Vimeo' : null;

    return (
        <div className="space-y-2">
            <Label>{label}</Label>

            {/* Preview: hosted links show a provider chip (no iframe in the panel),
                uploaded files get a real inline player. */}
            {value && embedProvider && (
                <div className="flex items-center gap-2 rounded border bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
                    <YoutubeLogo className="size-4 text-red-500" />
                    {embedProvider} link — plays on the live page
                </div>
            )}
            {value && !embedProvider && (
                <video
                    src={value}
                    controls
                    preload="metadata"
                    className="h-24 w-full rounded border bg-black object-contain"
                />
            )}
            {!value && (
                <div className="flex h-16 w-full items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-gray-400">
                    <VideoCamera className="size-5" />
                </div>
            )}

            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || 'https://www.youtube.com/watch?v=...'}
                className="text-sm"
            />

            <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
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
                            Upload video
                        </>
                    )}
                </Button>
                {value && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onChange('')}
                        disabled={isUploading}
                    >
                        Clear
                    </Button>
                )}
            </div>
        </div>
    );
};
