// src/components/design-system/file-upload.tsx

import { FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '../ui/form';
import { FileUploadComponentProps } from '@/types/common/file-upload';
import { useDropzone } from 'react-dropzone';
import { useCallback, useEffect } from 'react';

export const FileUploadComponent = <T extends FieldValues>({
    fileInputRef,
    onFileSubmit,
    control,
    name,
    acceptedFileTypes,
    children,
    isUploading,
    error,
    className,
    disableClick = false,
}: FileUploadComponentProps<T>) => {
    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            const file = acceptedFiles[0];
            if (file) {
                onFileSubmit(file);
            }
        },
        [onFileSubmit]
    );

    const { getRootProps, getInputProps, inputRef } = useDropzone({
        onDrop,
        accept: acceptedFileTypes
            ? Array.isArray(acceptedFileTypes)
                ? Object.fromEntries(acceptedFileTypes.map((type) => [type, []]))
                : { [acceptedFileTypes]: [] }
            : undefined,
        maxFiles: 1,
        multiple: false,
        disabled: isUploading,
        noClick: disableClick, // Use the passed prop, default is false
        noKeyboard: true,
    });

    // Sync the dropzone's inputRef to the external fileInputRef
    useEffect(() => {
        if (inputRef.current && fileInputRef) {
            (fileInputRef as React.MutableRefObject<HTMLInputElement | null>).current =
                inputRef.current;
        }
    }, [inputRef, fileInputRef]);

    return (
        <FormField
            control={control}
            name={name}
            render={() => (
                <FormItem>
                    <FormControl>
                        <div {...getRootProps()} className={`cursor-pointer bg-white ${className}`}>
                            <input
                                {...getInputProps()}
                                accept={
                                    Array.isArray(acceptedFileTypes)
                                        ? acceptedFileTypes.join(',')
                                        : acceptedFileTypes
                                }
                                className="outline-none"
                            />
                            {children}
                            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                        </div>
                    </FormControl>
                </FormItem>
            )}
        />
    );
};
