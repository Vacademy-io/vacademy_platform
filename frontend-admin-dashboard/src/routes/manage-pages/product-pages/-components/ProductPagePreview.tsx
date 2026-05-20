import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductPagePreviewProps {
    productPageCode: string;
    instituteId: string;
    preselectedCourseIds?: string[];
    defaultStep?: string;
}

export const ProductPagePreview = ({ productPageCode, instituteId, preselectedCourseIds, defaultStep }: ProductPagePreviewProps) => {
    if (!productPageCode) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
                <p className="text-sm text-gray-400">Save the page first to preview it.</p>
            </div>
        );
    }

    const courseIdsParam = preselectedCourseIds && preselectedCourseIds.length > 0
        ? `&courseIds=${preselectedCourseIds.join(',')}`
        : '';
    const defaultTabParam = defaultStep ? `&defaultTab=${defaultStep}` : '';
    const previewUrl = `${BASE_URL_LEARNER_DASHBOARD}/product-pages/${productPageCode}?instituteId=${instituteId}${courseIdsParam}${defaultTabParam}`;

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
