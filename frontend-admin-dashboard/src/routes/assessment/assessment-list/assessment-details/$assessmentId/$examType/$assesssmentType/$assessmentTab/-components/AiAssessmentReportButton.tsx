import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_EXPORT_PDF_URL_AI_ASSESSMENT_REPORT } from '@/constants/urls';

/**
 * Reads the backend's message out of a failed PDF request.
 *
 * The download is `responseType: 'blob'`, so an error body arrives as a Blob
 * rather than parsed JSON — without this, every failure reads the same.
 */
const readErrorMessage = async (error: unknown): Promise<string | null> => {
    const data = (error as { response?: { data?: unknown } })?.response?.data;
    if (!data) return null;
    try {
        const raw = data instanceof Blob ? await data.text() : JSON.stringify(data);
        const parsed = JSON.parse(raw) as { ex?: string; message?: string };
        return parsed.ex || parsed.message || null;
    } catch {
        return null;
    }
};

interface AiAssessmentReportButtonProps {
    assessmentId: string;
    instituteId: string | undefined;
    assessmentName?: string;
}

/**
 * Downloads the ONE AI diagnostic report for this assessment.
 *
 * <p>No confirmation dialog and no credit warning, deliberately: the class view
 * aggregates the per-learner analyses that already exist, so this spends no AI
 * credits. A dialog asking permission to spend nothing would be noise.
 */
export const AiAssessmentReportButton = ({
    assessmentId,
    instituteId,
    assessmentName,
}: AiAssessmentReportButtonProps) => {
    const { t } = useTranslation('assessmentSubmissionsTab');
    const [busy, setBusy] = useState(false);

    const download = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const response = await authenticatedAxiosInstance({
                method: 'GET',
                responseType: 'blob',
                headers: { Accept: 'application/pdf' },
                url: GET_EXPORT_PDF_URL_AI_ASSESSMENT_REPORT,
                params: { assessmentId, instituteId },
            });
            const blob = response?.data as Blob | undefined;
            if (!blob) throw new Error('empty response');

            const safeName = (assessmentName || 'assessment').replace(/[^\w.-]+/g, '_');
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.setAttribute('download', `AI_Report_${safeName}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error('AI assessment report download failed:', error);
            toast.error((await readErrorMessage(error)) || t('aiReport.failed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <MyButton
            type="button"
            scale="small"
            buttonType="secondary"
            className="font-medium"
            disabled={busy}
            onClick={download}
        >
            <Sparkle size={15} weight="fill" />
            {busy ? t('aiReport.preparing') : t('aiReport.download')}
        </MyButton>
    );
};
