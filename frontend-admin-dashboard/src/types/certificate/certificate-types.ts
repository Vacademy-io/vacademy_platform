import { StudentTable } from '@/types/student-table-types';

// Base student data for certificate generation
export interface CertificateStudentData extends StudentTable {
    // Dynamic fields will be added from CSV upload
    dynamicFields?: Record<string, string | number>;
}

// CSV template structure
export interface CsvTemplateRow {
    user_id: string;
    enrollment_number: string;
    student_name: string;
    [key: string]: string | number; // Additional dynamic fields
}

// CSV validation result
export interface CsvValidationResult {
    isValid: boolean;
    errors: CsvValidationError[];
    warnings: CsvValidationWarning[];
    data?: CsvTemplateRow[];
    headers?: string[];
}

export interface CsvValidationError {
    row: number;
    column?: string;
    message: string;
    type: 'missing_student' | 'extra_student' | 'invalid_header' | 'invalid_data' | 'file_size';
}

export interface CsvValidationWarning {
    row: number;
    column?: string;
    message: string;
    type: 'data_type_mismatch' | 'empty_cell';
}

// Image-based Template and Field Mapping
export interface ImageTemplate {
    id: string;
    fileName: string;
    originalFileName: string;
    imageDataUrl: string; // Base64 data URL of the image
    width: number;
    height: number;
    format: 'png' | 'jpg' | 'jpeg';
    createdAt: string;
    // Original PDF info if converted from PDF
    sourceType: 'pdf' | 'image';
    originalPdfData?: ArrayBuffer; // Keep original PDF if converted
}

export interface FieldMapping {
    id: string;
    fieldName: string; // CSV column name
    displayName: string; // Human readable name
    type: 'text' | 'number' | 'date';
    position: {
        x: number; // Pixel position on image
        y: number; // Pixel position on image
        width: number; // Width in pixels
        height: number; // Height in pixels
    };
    style: {
        fontSize: number;
        fontColor: string;
        fontFamily: string;
        alignment: 'left' | 'center' | 'right';
        fontWeight: 'normal' | 'bold';
        backgroundColor?: string; // Optional background color
        borderColor?: string; // Optional border
        padding?: number; // Padding around text
    };
}

export interface CertificateTemplate {
    id: string;
    name: string;
    imageTemplate: ImageTemplate;
    fieldMappings: FieldMapping[];
    previewData?: Record<string, string | number>;
    createdAt: string;
    updatedAt: string;
}

// Legacy PDF Template for backward compatibility
export interface PdfTemplate {
    id: string;
    fileName: string;
    fileUrl?: string;
    fileData?: ArrayBuffer;
    pages: number;
    createdAt: string;
}

// Certificate generation session state
export interface CertificateGenerationSession {
    selectedStudents: CertificateStudentData[];
    uploadedCsvData?: CsvTemplateRow[];
    csvHeaders?: string[];
    currentStep: 'student_data' | 'pdf_annotation' | 'generation';
    validationResult?: CsvValidationResult;
    // Image Template fields
    imageTemplate?: ImageTemplate;
    certificateTemplate?: CertificateTemplate;
    fieldMappings?: FieldMapping[];
    generationProgress?: {
        total: number;
        completed: number;
        status: 'idle' | 'generating' | 'completed' | 'error';
        downloadUrl?: string;
    };
    // Legacy support
    pdfTemplate?: PdfTemplate;
}

// Available field types for mapping
export interface AvailableField {
    name: string;
    displayName: string;
    type: 'text' | 'number' | 'date';
    isRequired: boolean;
    sampleValue?: string | number;
    source: 'csv' | 'system'; // csv = from uploaded CSV, system = built-in fields
}

// Column types for dynamic data
export type ColumnDataType = 'string' | 'number' | 'date' | 'unknown';

export interface DynamicColumn {
    header: string;
    dataType: ColumnDataType;
    sampleValue?: string | number;
}

// Certificate generation result
export interface CertificateGenerationResult {
    success: boolean;
    certificates: GeneratedCertificate[];
    errors: CertificateGenerationError[];
    zipFileUrl?: string;
    totalCount: number;
    successCount: number;
    errorCount: number;
}

export interface GeneratedCertificate {
    studentId: string;
    studentName: string;
    pdfBlob: Blob;
    imageBlob?: Blob; // Individual image version
    fileName: string;
}

export interface CertificateGenerationError {
    studentId: string;
    studentName: string;
    error: string;
}

// Image processing utilities
export interface ImageProcessingOptions {
    quality: number; // 0-1 for JPEG compression
    format: 'png' | 'jpg' | 'jpeg';
    maxWidth?: number;
    maxHeight?: number;
}

export interface CanvasRenderingContext {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
}
