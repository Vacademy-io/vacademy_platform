import { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getPublicUrl } from '@/services/upload_file';
import { getUserId } from '@/utils/userDetails';

interface ImageUploadFieldProps {
    label: string;
    value: string;
    onChange: (url: string) => void;
    placeholder?: string;
}

export const ImageUploadField = ({ label, value, onChange, placeholder }: ImageUploadFieldProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { uploadFile } = useFileUpload();

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
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
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
                        Upload Image
                    </>
                )}
            </Button>
        </div>
    );
};
