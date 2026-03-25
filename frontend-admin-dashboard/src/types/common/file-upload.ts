// src/types/file-upload.ts

import { Control, FieldValues, Path } from 'react-hook-form';
import { MutableRefObject } from 'react';

export type FileType =
    | 'image/*'
    | 'image/jpeg'
    | 'image/png'
    | 'image/svg+xml'
    | 'video/*'
    | 'video/mp4'
    | 'video/quicktime'
    | 'video/x-msvideo'
    | 'video/webm'
    | 'application/pdf'
    | 'audio/*'
    | 'application/msword'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.ms-powerpoint'
    | 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export interface FileUploadComponentProps<T extends FieldValues> {
    fileInputRef: MutableRefObject<HTMLInputElement | null>;
    onFileSubmit: (file: File) => void;
    control: Control<T>;
    name: Path<T>;
    acceptedFileTypes?: FileType | FileType[];
    children?: React.ReactNode;
    isUploading?: boolean;
    error?: string | null;
    className?: string;
    disableClick?: boolean;
}
