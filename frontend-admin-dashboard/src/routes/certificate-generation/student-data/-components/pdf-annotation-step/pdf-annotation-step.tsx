import { useState, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import {
    CertificateGenerationSession,
    ImageTemplate,
    FieldMapping,
    AvailableField,
} from '@/types/certificate/certificate-types';
import { MyButton } from '@/components/design-system/button';
import {
    ArrowLeft,
    Upload,
    FileText,
    PaintBrush,
    Certificate,
    Download,
    Eye,
    Star,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';
import { PdfUploadSection } from '../pdf-upload/pdf-upload-section';
import { FieldPalette } from '../field-palette/field-palette';
import { ImageAnnotationEditor } from '../pdf-editor/pdf-annotation-editor';
import { CertificatePreview } from '../certificate-preview/certificate-preview';
import { certificateGenerationService } from '../../-services/pdf-generation-service';
import { downloadManager } from '../../-services/download-manager';

interface PdfAnnotationStepProps {
    session: CertificateGenerationSession;
    onSessionUpdate: (updates: Partial<CertificateGenerationSession>) => void;
    onPrevStep: () => void;
}

export const PdfAnnotationStep = ({
    session,
    onSessionUpdate,
    onPrevStep,
}: PdfAnnotationStepProps) => {
    const [activeView, setActiveView] = useState<'upload' | 'design' | 'preview'>('upload');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 });
    const [activeDragField, setActiveDragField] = useState<AvailableField | null>(null);

    // Get available fields for mapping
    const availableFields: AvailableField[] = useMemo(() => {
        const systemFields: AvailableField[] = [
            {
                name: 'user_id',
                displayName: 'User ID',
                type: 'text',
                isRequired: true,
                source: 'system',
                sampleValue: 'USR001',
            },
            {
                name: 'enrollment_number',
                displayName: 'Enrollment Number',
                type: 'text',
                isRequired: true,
                source: 'system',
                sampleValue: 'ENR2024001',
            },
            {
                name: 'student_name',
                displayName: 'Student Name',
                type: 'text',
                isRequired: true,
                source: 'system',
                sampleValue: 'John Doe',
            },
            {
                name: 'full_name',
                displayName: 'Full Name',
                type: 'text',
                isRequired: false,
                source: 'system',
                sampleValue: 'John Michael Doe',
            },
            {
                name: 'email',
                displayName: 'Email Address',
                type: 'text',
                isRequired: false,
                source: 'system',
                sampleValue: 'john.doe@example.com',
            },
            {
                name: 'mobile_number',
                displayName: 'Mobile Number',
                type: 'text',
                isRequired: false,
                source: 'system',
                sampleValue: '+1 (555) 123-4567',
            },
            {
                name: 'institute_name',
                displayName: 'Institute Name',
                type: 'text',
                isRequired: false,
                source: 'system',
                sampleValue: 'University of Technology',
            },
            {
                name: 'completion_date',
                displayName: 'Completion Date',
                type: 'date',
                isRequired: false,
                source: 'system',
                sampleValue: new Date().toLocaleDateString(),
            },
        ];

        const csvFields: AvailableField[] =
            session.csvHeaders?.slice(3).map((header) => {
                const sampleRow = session.uploadedCsvData?.[0];
                const sampleValue = sampleRow?.[header];

                let fieldType: 'text' | 'number' | 'date' = 'text';
                if (typeof sampleValue === 'number') {
                    fieldType = 'number';
                } else if (typeof sampleValue === 'string') {
                    const dateRegex = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}$/;
                    if (dateRegex.test(sampleValue)) {
                        fieldType = 'date';
                    } else if (!isNaN(Number(sampleValue)) && sampleValue.trim() !== '') {
                        fieldType = 'number';
                    }
                }

                return {
                    name: header,
                    displayName: header.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
                    type: fieldType,
                    isRequired: false,
                    source: 'csv' as const,
                    sampleValue: sampleValue?.toString() || 'Sample data',
                };
            }) || [];

        return [...systemFields, ...csvFields];
    }, [session.csvHeaders, session.uploadedCsvData]);

    // Handle image template upload
    const handleImageTemplateUpload = (template: ImageTemplate) => {
        onSessionUpdate({
            imageTemplate: template,
            fieldMappings: [], // Reset field mappings when new template is uploaded
            // Clear legacy pdfTemplate if it exists
            pdfTemplate: undefined,
        });
        setActiveView('design');
    };

    // Handle template removal
    const handleTemplateRemove = () => {
        onSessionUpdate({
            imageTemplate: undefined,
            fieldMappings: [], // Clear field mappings as well
            pdfTemplate: undefined,
        });
        setActiveView('upload');
    };

    // Handle field mappings change
    const handleFieldMappingsChange = (mappings: FieldMapping[]) => {
        onSessionUpdate({
            fieldMappings: mappings,
        });
    };

    // Handle drag start
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        if (active.data.current?.type === 'field') {
            setActiveDragField(active.data.current.field);
        }
    };

    // Handle drag end
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && over.id === 'image-editor' && active.data.current?.type === 'field') {
            const field = active.data.current.field as AvailableField;

            // For initial placement, use a default position within the image bounds
            // The user can then drag it to the exact position they want
            const defaultX = session.imageTemplate ? session.imageTemplate.width * 0.3 : 100;
            const defaultY = session.imageTemplate ? session.imageTemplate.height * 0.3 : 100;

            const newMapping: FieldMapping = {
                id: nanoid(),
                fieldName: field.name,
                displayName: field.displayName,
                type: field.type,
                position: {
                    x: defaultX,
                    y: defaultY,
                    width: 120,
                    height: 24,
                },
                style: {
                    fontSize: 14,
                    fontColor: '#000000',
                    fontFamily: 'Arial, sans-serif',
                    alignment: 'left',
                    fontWeight: 'normal',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    padding: 4,
                },
            };

            const updatedMappings = [...(session.fieldMappings || []), newMapping];
            onSessionUpdate({ fieldMappings: updatedMappings });
        }

        setActiveDragField(null);
    };

    // Handle certificate generation
    const handleGenerateCertificates = async () => {
        if (
            !session.imageTemplate ||
            !session.fieldMappings ||
            session.fieldMappings.length === 0
        ) {
            alert('Please upload a template and map some fields first.');
            return;
        }

        try {
            setIsGenerating(true);
            setGenerationProgress({ completed: 0, total: session.selectedStudents.length });

            console.log('Starting certificate generation...');

            const result = await certificateGenerationService.generateBulkCertificates(
                session.imageTemplate,
                session.fieldMappings,
                session.selectedStudents,
                session.uploadedCsvData,
                (completed, total) => {
                    setGenerationProgress({ completed, total });
                }
            );

            console.log('Generation completed:', result);

            // Update session with generation result
            onSessionUpdate({
                generationProgress: {
                    total: result.totalCount,
                    completed: result.totalCount,
                    status: result.success ? 'completed' : 'error',
                },
            });

            // Download certificates
            await downloadManager.downloadGenerationResult(result, false); // Individual downloads for now
            downloadManager.downloadGenerationSummary(result);

            alert(
                `Certificate generation completed!\nSuccessful: ${result.successCount}\nErrors: ${result.errorCount}`
            );
        } catch (error) {
            console.error('Certificate generation failed:', error);
            alert(
                `Certificate generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );

            onSessionUpdate({
                generationProgress: {
                    total: session.selectedStudents.length,
                    completed: 0,
                    status: 'error',
                },
            });
        } finally {
            setIsGenerating(false);
        }
    };

    // Check if we can generate certificates
    const canGenerateCertificates =
        session.imageTemplate &&
        session.fieldMappings &&
        session.fieldMappings.length > 0 &&
        session.selectedStudents.length > 0 &&
        !isGenerating;

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-col gap-6">
                {/* Header Section */}
                <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-gradient-to-br from-white to-neutral-50/30 p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-purple-100 p-2">
                                <Certificate className="size-5 text-purple-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-neutral-700">
                                    Template Design & Certificate Generation
                                </h2>
                                <p className="text-sm text-neutral-500">
                                    Upload template and annotate with student data fields
                                </p>
                            </div>
                        </div>

                        {/* View Toggle */}
                        <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
                            {[
                                { key: 'upload', label: 'Upload', icon: Upload },
                                { key: 'design', label: 'Design', icon: PaintBrush },
                                { key: 'preview', label: 'Preview', icon: Eye },
                            ].map(({ key, label, icon: Icon }) => (
                                <button
                                    key={key}
                                    onClick={() => setActiveView(key as any)}
                                    disabled={key === 'design' && !session.imageTemplate}
                                    className={cn(
                                        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all',
                                        activeView === key
                                            ? 'bg-white text-purple-600 shadow-sm'
                                            : 'text-neutral-600 hover:text-neutral-700',
                                        key === 'design' &&
                                            !session.imageTemplate &&
                                            'cursor-not-allowed opacity-50'
                                    )}
                                >
                                    <Icon className="size-4" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Progress Indicator */}
                    {isGenerating && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <div className="flex items-center gap-3">
                                <div className="size-5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-blue-800">
                                        Generating Certificates...
                                    </p>
                                    <p className="text-xs text-blue-600">
                                        {generationProgress.completed} of {generationProgress.total}{' '}
                                        completed
                                    </p>
                                </div>
                                <div className="text-sm font-medium text-blue-700">
                                    {Math.round(
                                        (generationProgress.completed / generationProgress.total) *
                                            100
                                    )}
                                    %
                                </div>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-blue-200">
                                <div
                                    className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                                    style={{
                                        width: `${(generationProgress.completed / generationProgress.total) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                    {/* Left Sidebar - Field Palette */}
                    {(activeView === 'design' || activeView === 'preview') &&
                        session.imageTemplate && (
                            <div className="lg:col-span-1">
                                <FieldPalette session={session} />
                            </div>
                        )}

                    {/* Main Content Area */}
                    <div className={cn(activeView === 'upload' ? 'col-span-1' : 'lg:col-span-3')}>
                        {/* Upload View */}
                        {activeView === 'upload' && (
                            <PdfUploadSection
                                onImageTemplateUpload={handleImageTemplateUpload}
                                onTemplateRemove={handleTemplateRemove}
                                uploadedTemplate={session.imageTemplate}
                                isLoading={isGenerating}
                            />
                        )}

                        {/* Design View */}
                        {activeView === 'design' && session.imageTemplate && (
                            <ImageAnnotationEditor
                                imageTemplate={session.imageTemplate}
                                fieldMappings={session.fieldMappings || []}
                                onFieldMappingsChange={handleFieldMappingsChange}
                                availableFields={availableFields}
                                isLoading={isGenerating}
                            />
                        )}

                        {/* Preview View */}
                        {activeView === 'preview' && session.imageTemplate && (
                            <CertificatePreview
                                imageTemplate={session.imageTemplate}
                                fieldMappings={session.fieldMappings || []}
                                selectedStudents={session.selectedStudents}
                                csvData={session.uploadedCsvData}
                                isLoading={isGenerating}
                            />
                        )}
                    </div>
                </div>

                {/* Action Footer */}
                <div className="flex justify-between rounded-lg border border-neutral-200/50 bg-gradient-to-r from-neutral-50/50 to-white p-4">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={onPrevStep}
                        disabled={isGenerating}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="size-4" />
                        Back to Student Data
                    </MyButton>

                    <div className="flex items-center gap-3">
                        {session.fieldMappings && session.fieldMappings.length > 0 && (
                            <div className="text-sm text-neutral-600">
                                {session.fieldMappings.length} fields mapped
                            </div>
                        )}

                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={handleGenerateCertificates}
                            disabled={!canGenerateCertificates}
                            className="flex items-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Download className="size-4" />
                                    Generate Certificates
                                </>
                            )}
                        </MyButton>
                    </div>
                </div>

                {/* Help Section */}
                {!session.imageTemplate && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
                        <div className="flex items-start gap-3">
                            <div className="rounded-full bg-blue-100 p-2">
                                <Star className="size-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="mb-2 text-sm font-medium text-blue-800">
                                    Getting Started with Certificate Generation
                                </h3>
                                <ol className="list-inside list-decimal space-y-1 text-xs text-blue-700">
                                    <li>
                                        Upload a certificate template (PDF or image) using the
                                        upload area above
                                    </li>
                                    <li>
                                        Switch to "Design" view to map data fields onto your
                                        template
                                    </li>
                                    <li>
                                        Drag fields from the palette onto the template where you
                                        want data to appear
                                    </li>
                                    <li>
                                        Use "Preview" to see how certificates will look with real
                                        student data
                                    </li>
                                    <li>
                                        Click "Generate Certificates" to create and download all
                                        certificates
                                    </li>
                                </ol>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
                {activeDragField ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 shadow-lg">
                        <div className="text-sm font-medium text-blue-800">
                            {activeDragField.displayName}
                        </div>
                        <div className="text-xs text-blue-600">{activeDragField.sampleValue}</div>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
