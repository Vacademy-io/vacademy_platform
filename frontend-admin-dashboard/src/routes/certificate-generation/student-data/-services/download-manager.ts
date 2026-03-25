import { saveAs } from 'file-saver';
import {
    GeneratedCertificate,
    CertificateGenerationResult,
} from '@/types/certificate/certificate-types';

export class DownloadManager {
    // Download a single certificate
    async downloadSingleCertificate(certificate: GeneratedCertificate): Promise<void> {
        try {
            saveAs(certificate.pdfBlob, certificate.fileName);
            console.log(`Downloaded certificate: ${certificate.fileName}`);
        } catch (error) {
            console.error('Error downloading certificate:', error);
            throw new Error(`Failed to download certificate for ${certificate.studentName}`);
        }
    }

    // Download multiple certificates individually (since we don't have ZIP support yet)
    async downloadCertificatesIndividually(
        certificates: GeneratedCertificate[],
        onProgress?: (completed: number, total: number) => void
    ): Promise<void> {
        console.log(`Starting individual downloads for ${certificates.length} certificates`);

        for (let i = 0; i < certificates.length; i++) {
            const certificate = certificates[i];

            try {
                // Small delay between downloads to prevent browser overwhelming
                if (i > 0) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                }

                await this.downloadSingleCertificate(certificate as GeneratedCertificate);
                onProgress?.(i + 1, certificates.length);
            } catch (error) {
                console.error(
                    `Failed to download certificate for ${certificate?.studentName}:`,
                    error
                );
                // Continue with other downloads even if one fails
            }
        }

        console.log('Individual downloads completed');
    }

    // Create and download ZIP file (requires jszip - to be implemented)
    async downloadCertificatesAsZip(
        certificates: GeneratedCertificate[],
        zipFileName: string = 'certificates.zip',
        onProgress?: (completed: number, total: number) => void
    ): Promise<void> {
        // TODO: Implement ZIP download functionality
        // This requires adding jszip as a dependency

        console.warn(
            'ZIP download not implemented yet. Use downloadCertificatesIndividually instead.'
        );

        // For now, fall back to individual downloads
        await this.downloadCertificatesIndividually(certificates, onProgress);

        // TODO: Uncomment and implement when jszip is added
        /*
        try {
            // Import JSZip dynamically when it's available
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            
            console.log(`Creating ZIP file with ${certificates.length} certificates`);
            
            // Add each certificate to the ZIP
            certificates.forEach((certificate, index) => {
                zip.file(certificate.fileName, certificate.pdfBlob);
                onProgress?.(index + 1, certificates.length);
            });
            
            // Generate ZIP blob
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 6
                }
            });
            
            // Download ZIP file
            saveAs(zipBlob, zipFileName);
            console.log(`ZIP file downloaded: ${zipFileName}`);
        } catch (error) {
            console.error('Error creating ZIP file:', error);
            throw new Error('Failed to create ZIP file. Falling back to individual downloads.');
        }
        */
    }

    // Download generation result with error handling
    async downloadGenerationResult(
        result: CertificateGenerationResult,
        downloadAsZip: boolean = true,
        onProgress?: (completed: number, total: number) => void
    ): Promise<void> {
        if (result.certificates.length === 0) {
            throw new Error('No certificates available for download');
        }

        try {
            if (downloadAsZip && result.certificates.length > 1) {
                const timestamp = new Date().toISOString().slice(0, 10);
                const zipFileName = `certificates_${timestamp}_${result.certificates.length}_files.zip`;
                await this.downloadCertificatesAsZip(result.certificates, zipFileName, onProgress);
            } else {
                await this.downloadCertificatesIndividually(result.certificates, onProgress);
            }
        } catch (error) {
            console.error('Download failed:', error);
            throw error;
        }
    }

    // Create a summary text file for the generation result
    createGenerationSummary(result: CertificateGenerationResult): string {
        const timestamp = new Date().toISOString();
        const lines = [
            'Certificate Generation Summary',
            '='.repeat(50),
            `Generated on: ${timestamp}`,
            `Total Students: ${result.totalCount}`,
            `Successful: ${result.successCount}`,
            `Errors: ${result.errorCount}`,
            '',
            'Successful Certificates:',
            '-'.repeat(30),
        ];

        result.certificates.forEach((cert, index) => {
            lines.push(`${index + 1}. ${cert.studentName} (${cert.studentId}) - ${cert.fileName}`);
        });

        if (result.errors.length > 0) {
            lines.push('');
            lines.push('Errors:');
            lines.push('-'.repeat(15));

            result.errors.forEach((error, index) => {
                lines.push(
                    `${index + 1}. ${error.studentName} (${error.studentId}): ${error.error}`
                );
            });
        }

        return lines.join('\n');
    }

    // Download generation summary as text file
    downloadGenerationSummary(result: CertificateGenerationResult): void {
        const summary = this.createGenerationSummary(result);
        const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
        const timestamp = new Date().toISOString().slice(0, 10);
        const fileName = `certificate_generation_summary_${timestamp}.txt`;

        saveAs(blob, fileName);
        console.log('Generation summary downloaded');
    }

    // Utility method to format file size
    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Get total size of all certificates
    getTotalSize(certificates: GeneratedCertificate[]): number {
        return certificates.reduce((total, cert) => total + cert.pdfBlob.size, 0);
    }

    // Check if browser supports multiple file downloads
    supportsBulkDownload(): boolean {
        // Most modern browsers support this, but may show warnings
        return typeof window !== 'undefined' && 'saveAs' in window;
    }
}

// Singleton instance
export const downloadManager = new DownloadManager();

// Note for developers:
/*
To enable ZIP download functionality, add jszip to package.json:

npm install jszip
# or
pnpm add jszip

Then uncomment the ZIP implementation in downloadCertificatesAsZip method.
*/
