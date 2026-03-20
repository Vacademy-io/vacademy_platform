import { useEffect, useState, useRef } from 'react';
import type { PlanningFormData } from '../-types/types';
import { generateIntervalTypeId } from '../-utils/intervalTypeIdGenerator';
import PlanningHTMLEditor from './PlanningHTMLEditor';
import { MyLabel } from '@/components/design-system/my-label';
import { UploadFileInS3 } from '@/services/upload_file';
import { getUserId } from '@/utils/userDetails';
import { Button } from '@/components/ui/button';
import { Upload, X, FileIcon, Loader2 } from 'lucide-react';

interface PlanningFormSection2Props {
    data: PlanningFormData;
    onChange: (data: Partial<PlanningFormData>) => void;
}

export default function PlanningFormSection2({ data, onChange }: PlanningFormSection2Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    // Store file metadata separately with a Map for better tracking
    const [fileMetadata, setFileMetadata] = useState<Map<string, string>>(new Map());

    // Auto-generate interval_type_id when interval type or date changes
    useEffect(() => {
        if (data.interval_type && data.selectedDate) {
            const generatedId = generateIntervalTypeId(data.interval_type, data.selectedDate);
            onChange({ interval_type_id: generatedId });
        }
    }, [data.interval_type, data.selectedDate]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileName = file.name;

        try {
            setIsUploading(true);
            const userId = getUserId();
            console.log('Starting file upload:', fileName);

            const fileId = await UploadFileInS3(
                file,
                () => {},
                userId,
                'PLANNING',
                'PLANNING_LOGS',
                true
            );

            console.log('File uploaded successfully. FileId:', fileId);

            if (fileId) {
                // Update file metadata map
                setFileMetadata((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(fileId, fileName);
                    return newMap;
                });

                // Update parent state with new file ID
                const updatedFileIds = [...data.uploadedFileIds, fileId];
                console.log('Calling onChange with uploadedFileIds:', updatedFileIds);
                onChange({ uploadedFileIds: updatedFileIds });
            }
        } catch (error) {
            console.error('File upload failed:', error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveFile = (fileId: string) => {
        console.log('Removing file:', fileId);

        // Remove from metadata
        setFileMetadata((prev) => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            return newMap;
        });

        // Update parent state
        const updatedFileIds = data.uploadedFileIds.filter((id) => id !== fileId);
        console.log('After removal, uploadedFileIds:', updatedFileIds);
        onChange({ uploadedFileIds: updatedFileIds });
    };
    return (
        <div className="grid gap-4">
            {/* Content HTML Editor */}
            <div className="space-y-2">
                <MyLabel required>Content</MyLabel>
                <PlanningHTMLEditor
                    value={data.content_html}
                    onChange={(html) => onChange({ content_html: html })}
                />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
                <MyLabel>Add Files</MyLabel>
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="*/*"
                />
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="hover:border-primary cursor-pointer rounded-lg border-2 border-dashed p-6 transition-colors"
                >
                    <div className="flex flex-col items-center justify-center gap-2">
                        {isUploading ? (
                            <>
                                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">Uploading...</p>
                            </>
                        ) : (
                            <>
                                <Upload className="size-8 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    Click to upload file
                                </p>
                            </>
                        )}
                    </div>
                </div>

                {data.uploadedFileIds.length > 0 && (
                    <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium">
                            Uploaded Files ({data.uploadedFileIds.length}):
                        </p>
                        <div className="space-y-1">
                            {data.uploadedFileIds.map((fileId, index) => (
                                <div
                                    key={fileId}
                                    className="flex items-center justify-between rounded-md border bg-muted/50 p-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <FileIcon className="size-4 text-muted-foreground" />
                                        <span className="text-sm">
                                            {fileMetadata.get(fileId) || `File ${index + 1}`}
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveFile(fileId)}
                                        className="size-6"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
