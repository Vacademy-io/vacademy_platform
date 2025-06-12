import { toast } from 'sonner';

import { convertHtmlToPdf } from '../../-helper/helper';

export const handleConvertAndUpload = async (htmlString: string | null): Promise<string | null> => {
    if (htmlString == null) return null;
    try {
        // Step 1: Convert HTML to PDF
        const { pdfBlob } = await convertHtmlToPdf(htmlString);

        // Step 2: Create a download link
        const url = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success(`Document downloaded successfully)`);
        return null;
    } catch (error) {
        console.error('Download Failed:', error);
        toast.error('Failed to download document. Please try again.');
    }
    return null;
};
