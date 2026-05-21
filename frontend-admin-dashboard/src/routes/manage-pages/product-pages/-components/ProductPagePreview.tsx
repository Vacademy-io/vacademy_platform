import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductPagePreviewProps {
    productPageCode: string;
    instituteId: string;
    /** Custom learner portal base URL (e.g. https://shiksha.example.com). When present, instituteId param is omitted. */
    learnerPortalBaseUrl?: string;
    preselectedCourseIds?: string[];
    defaultStep?: string;
}

export const ProductPagePreview = ({ productPageCode, instituteId, learnerPortalBaseUrl, preselectedCourseIds, defaultStep }: ProductPagePreviewProps) => {
    if (!productPageCode) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
                <p className="text-sm text-gray-400">Save the page first to preview it.</p>
            </div>
        );
    }

    // When a custom domain is configured, domain routing identifies the institute — skip ?instituteId=
    const baseUrl = learnerPortalBaseUrl
        ? (learnerPortalBaseUrl.startsWith('http') ? learnerPortalBaseUrl : `https://${learnerPortalBaseUrl}`)
        : BASE_URL_LEARNER_DASHBOARD;

    const params = new URLSearchParams();
    if (!learnerPortalBaseUrl) params.set('instituteId', instituteId);
    if (defaultStep) params.set('defaultTab', defaultStep);
    if (preselectedCourseIds && preselectedCourseIds.length > 0) params.set('courseIds', preselectedCourseIds.join(','));
    const qs = params.toString();
    const previewUrl = `${baseUrl}/product-pages/${productPageCode}${qs ? `?${qs}` : ''}`;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 font-mono">
                    {previewUrl}
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    asChild
                >
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3.5" />
                        Open in new tab
                    </a>
                </Button>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <iframe
                    src={previewUrl}
                    title="Product Page Preview"
                    className="h-[600px] w-full"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                />
            </div>
        </div>
    );
};
