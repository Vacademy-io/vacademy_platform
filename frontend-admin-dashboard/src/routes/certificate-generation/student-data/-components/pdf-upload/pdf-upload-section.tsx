import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImageTemplate } from '@/types/certificate/certificate-types';
import { MyButton } from '@/components/design-system/button';
import { Upload, FileText, Check, X, Eye, Image } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - Use the worker from the same package to avoid version mismatch
if (typeof window !== 'undefined') {
    // Use a relative path to the worker that Vite can resolve
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.js',
        import.meta.url
    ).toString();
}

interface PdfUploadSectionProps {
    onImageTemplateUpload: (template: ImageTemplate) => void;
    onTemplateRemove?: () => void;
    uploadedTemplate?: ImageTemplate;
    isLoading?: boolean;
}

export const PdfUploadSection = ({
    onImageTemplateUpload,
    onTemplateRemove,
    uploadedTemplate,
    isLoading = false,
}: PdfUploadSectionProps) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processingStep, setProcessingStep] = useState<string>('');
    const [isRemoving, setIsRemoving] = useState(false);

    // Convert PDF to image using canvas
    const convertPdfToImage = useCallback(async (file: File): Promise<ImageTemplate> => {
        setProcessingStep('Reading PDF file...');

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        setProcessingStep('Loading PDF document...');

        // Load PDF document
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

        // For certificates, we typically only need the first page
        setProcessingStep('Rendering PDF to image...');
        const page = await pdf.getPage(1);

        // Get viewport with high DPI for better quality
        const scale = 2; // 2x scale for better quality
        const viewport = page.getViewport({ scale });

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get canvas context');
        }

        // Set canvas dimensions
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Render PDF page to canvas
        await page.render({
            canvasContext: ctx,
            viewport: viewport,
        }).promise;

        setProcessingStep('Converting to image format...');

        // Convert canvas to image data URL (PNG for better quality)
        const imageDataUrl = canvas.toDataURL('image/png', 1.0);

        // Create image template
        const template: ImageTemplate = {
            id: nanoid(),
            fileName: file.name.replace(/\.pdf$/i, '.png'),
            originalFileName: file.name,
            imageDataUrl,
            width: canvas.width,
            height: canvas.height,
            format: 'png',
            createdAt: new Date().toISOString(),
            sourceType: 'pdf',
            originalPdfData: arrayBuffer,
        };

        setProcessingStep('');
        return template;
    }, []);

    // Convert image file to template
    const convertImageToTemplate = useCallback(async (file: File): Promise<ImageTemplate> => {
        setProcessingStep('Loading image...');

        return new Promise((resolve, reject) => {
            const img = document.createElement('img');

            img.onload = () => {
                setProcessingStep('Processing image...');

                // Create canvas to get image data
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // Set canvas size to image size
                canvas.width = img.width;
                canvas.height = img.height;

                // Draw image to canvas
                ctx.drawImage(img, 0, 0);

                // Get image data URL
                const format = file.type.includes('png') ? 'png' : 'jpg';
                const imageDataUrl = canvas.toDataURL(`image/${format}`, 0.9);

                const template: ImageTemplate = {
                    id: nanoid(),
                    fileName: file.name,
                    originalFileName: file.name,
                    imageDataUrl,
                    width: img.width,
                    height: img.height,
                    format: format as 'png' | 'jpg',
                    createdAt: new Date().toISOString(),
                    sourceType: 'image',
                };

                setProcessingStep('');
                resolve(template);
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            // Load image from file
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    img.src = e.target.result as string;
                }
            };
            reader.readAsDataURL(file);
        });
    }, []);

    const processFile = useCallback(
        async (file: File): Promise<ImageTemplate> => {
            setIsProcessing(true);
            setError(null);

            try {
                let template: ImageTemplate;

                if (file.type === 'application/pdf') {
                    template = await convertPdfToImage(file);
                } else {
                    template = await convertImageToTemplate(file);
                }

                return template;
            } catch (err) {
                console.error('Error processing file:', err);
                throw new Error(
                    `Failed to process ${file.type === 'application/pdf' ? 'PDF' : 'image'} file. Please ensure it's a valid file.`
                );
            } finally {
                setIsProcessing(false);
                setProcessingStep('');
            }
        },
        [convertPdfToImage, convertImageToTemplate]
    );

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return;

            const file = acceptedFiles[0];
            if (!file) return;

            try {
                const template = await processFile(file);
                onImageTemplateUpload(template);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to upload file');
            }
        },
        [processFile, onImageTemplateUpload]
    );

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg'],
        },
        maxFiles: 1,
        maxSize: 50 * 1024 * 1024, // 50MB
        disabled: isLoading || isProcessing,
    });

    const removeTemplate = async () => {
        const confirmed = window.confirm(
            'Are you sure you want to remove this template? This will also clear all field mappings.'
        );

        if (confirmed) {
            setIsRemoving(true);
            setError(null);

            // Brief delay to show feedback
            setTimeout(() => {
                if (onTemplateRemove) {
                    onTemplateRemove();
                }
                setIsRemoving(false);
            }, 300);
        }
    };

    if (uploadedTemplate) {
        return (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <div className="rounded-full bg-green-100 p-2">
                            <Check className="size-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-green-800">
                                Template Uploaded Successfully
                            </h3>
                            <div className="mt-1 space-y-1">
                                <p className="text-xs text-green-700">
                                    <strong>File:</strong> {uploadedTemplate.originalFileName}
                                </p>
                                <p className="text-xs text-green-700">
                                    <strong>Type:</strong>{' '}
                                    {uploadedTemplate.sourceType === 'pdf'
                                        ? 'PDF (converted to image)'
                                        : 'Image'}
                                </p>
                                <p className="text-xs text-green-700">
                                    <strong>Dimensions:</strong> {uploadedTemplate.width} ×{' '}
                                    {uploadedTemplate.height} px
                                </p>
                                <p className="text-xs text-green-700">
                                    <strong>Format:</strong> {uploadedTemplate.format.toUpperCase()}
                                </p>
                                <p className="text-xs text-green-700">
                                    <strong>Uploaded:</strong>{' '}
                                    {new Date(uploadedTemplate.createdAt).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <MyButton buttonType="secondary" scale="small" className="text-xs">
                            <Eye className="mr-1 size-3" />
                            Preview
                        </MyButton>
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={removeTemplate}
                            disabled={isRemoving}
                            className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                            {isRemoving ? (
                                <>
                                    <div className="mr-1 size-3 animate-spin rounded-full border border-red-300 border-t-red-600" />
                                    Removing...
                                </>
                            ) : (
                                <>
                                    <X className="mr-1 size-3" />
                                    Remove
                                </>
                            )}
                        </MyButton>
                    </div>
                </div>

                {/* Image Preview */}
                <div className="mt-4 rounded-lg border border-green-200 bg-white p-2">
                    <img
                        src={uploadedTemplate.imageDataUrl}
                        alt="Certificate template preview"
                        className="h-auto max-h-64 w-full rounded object-contain"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Upload Area */}
            <div
                {...getRootProps()}
                className={cn(
                    'relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200',
                    isDragActive && !isDragReject
                        ? 'border-blue-400 bg-blue-50'
                        : isDragReject
                          ? 'border-red-400 bg-red-50'
                          : 'border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100',
                    (isLoading || isProcessing) && 'cursor-not-allowed opacity-50'
                )}
            >
                <input {...getInputProps()} />

                <div className="flex flex-col items-center gap-4">
                    <div
                        className={cn(
                            'rounded-full p-4',
                            isDragActive && !isDragReject
                                ? 'bg-blue-100'
                                : isDragReject
                                  ? 'bg-red-100'
                                  : 'bg-neutral-100'
                        )}
                    >
                        {isProcessing ? (
                            <div className="size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
                        ) : (
                            <Upload
                                className={cn(
                                    'size-8',
                                    isDragActive && !isDragReject
                                        ? 'text-blue-600'
                                        : isDragReject
                                          ? 'text-red-600'
                                          : 'text-neutral-600'
                                )}
                            />
                        )}
                    </div>

                    <div>
                        <p className="text-lg font-medium text-neutral-700">
                            {isProcessing
                                ? processingStep || 'Processing file...'
                                : isDragActive
                                  ? isDragReject
                                      ? 'File type not supported'
                                      : 'Drop file here'
                                  : 'Upload Certificate Template'}
                        </p>
                        <p className="mt-1 text-sm text-neutral-500">
                            {isProcessing
                                ? 'Please wait while we process your template'
                                : 'Drag and drop your PDF or image file here, or click to browse'}
                        </p>
                    </div>

                    {!isProcessing && (
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            className="pointer-events-none"
                        >
                            <Image className="mr-2 size-4" />
                            Choose Template File
                        </MyButton>
                    )}
                </div>

                {/* Requirements */}
                <div className="mt-6 rounded-lg bg-white/50 p-4">
                    <h4 className="mb-2 text-xs font-medium text-neutral-600">
                        Supported formats:
                    </h4>
                    <ul className="space-y-1 text-xs text-neutral-500">
                        <li>• PDF files (will be converted to image)</li>
                        <li>• PNG images</li>
                        <li>• JPG/JPEG images</li>
                        <li>• Maximum file size: 50MB</li>
                        <li>• Recommended: High resolution for better quality</li>
                    </ul>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                        <div className="rounded-full bg-red-100 p-1.5">
                            <X className="size-4 text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-red-800">Upload Error</h3>
                            <p className="mt-1 text-xs text-red-700">{error}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
