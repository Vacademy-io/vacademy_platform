// src/components/design-system/file-upload.tsx

import { FieldValues } from "react-hook-form";
import { FormControl, FormField, FormItem } from "../ui/form";
import { FileUploadComponentProps } from "@/types/common/file-upload";
import { useDropzone } from "react-dropzone";
import { useCallback } from "react";

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
}: FileUploadComponentProps<T>) => {
    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            const file = acceptedFiles[0];
            if (file) {
                onFileSubmit(file);
            }
        },
        [onFileSubmit],
    );

    const handleClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click(); // Programmatically click the file input
        }
    };

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: acceptedFileTypes
            ? Array.isArray(acceptedFileTypes)
                ? Object.fromEntries(acceptedFileTypes.map((type) => [type, []]))
                : { [acceptedFileTypes]: [] }
            : undefined,
        maxFiles: 1,
        multiple: false,
        disabled: isUploading,
    });

    return (
        <FormField
            control={control}
            name={name}
            render={() => (
                <FormItem>
                    <FormControl>
                        <div
                            {...getRootProps({
                                onClick: handleClick, // Trigger file input on click
                            })}
                            className={`cursor-pointer bg-white ${className}`}
                        >
                            <input
                                {...getInputProps()}
                                ref={fileInputRef}
                                accept={
                                    Array.isArray(acceptedFileTypes)
                                        ? acceptedFileTypes.join(",")
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
