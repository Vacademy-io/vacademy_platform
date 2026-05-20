import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { ProductPageShell } from './-components/ProductPageShell';
import { PaymentGatewayWrapper } from '@/components/common/enroll-by-invite/-components/payment-gateway-wrapper';
import { handleGetProductPage } from './-services/product-page-service';
import { AlertTriangle } from 'lucide-react';
import { resolveDomainRouting, getCurrentDomainInfo } from '@/services/domain-routing';
import type { PaymentVendor } from '@/components/common/enroll-by-invite/-utils/payment-vendor-helper';

const productPageSearchSchema = z.object({
    instituteId: z.string().optional(),
    courseIds: z.string().optional(),
    defaultTab: z.enum(['CATALOG', 'CART', 'PAYMENT']).optional(),
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_content: z.string().optional(),
    utm_term: z.string().optional(),
});

type ProductPageSearch = z.infer<typeof productPageSearchSchema>;

function Spinner() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="size-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
    );
}

function ErrorScreen({ title, message }: { title: string; message: string }) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
            <div className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-red-100">
                <AlertTriangle className="size-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="mt-3 max-w-sm text-sm text-gray-500">{message}</p>
        </div>
    );
}

export const Route = createFileRoute('/product-pages/$productPageCode/')({
    validateSearch: productPageSearchSchema,
    component: RouteComponent,
    errorComponent: ({ error }) => (
        <ErrorScreen
            title="Page Not Available"
            message={error instanceof Error ? error.message : 'Something went wrong loading this page.'}
        />
    ),
    pendingComponent: Spinner,
});

function RouteComponent() {
    const { productPageCode } = Route.useParams();
    const search = Route.useSearch();

    // Resolve institute ID from domain routing (no navigation side effects — raw API call only)
    const { data: domainInstituteId, isLoading: domainLoading } = useQuery({
        queryKey: ['DOMAIN_ROUTING_INSTITUTE_ID'],
        queryFn: async () => {
            const { domain, subdomain } = await getCurrentDomainInfo();
            const result = await resolveDomainRouting(domain, subdomain || '*');
            return result?.instituteId ?? null;
        },
        staleTime: 10 * 60 * 1000,
        retry: 1,
    });

    const resolvedInstituteId = domainInstituteId || search.instituteId || null;

    if (domainLoading) return <Spinner />;

    if (!resolvedInstituteId) {
        return (
            <ErrorScreen
                title="Institute Not Found"
                message="Unable to determine the institute for this page. Please use a valid link."
            />
        );
    }

    return (
        <ProductPageLoader
            productPageCode={productPageCode}
            instituteId={resolvedInstituteId}
            search={search}
        />
    );
}

function ProductPageLoader({
    productPageCode,
    instituteId,
    search,
}: {
    productPageCode: string;
    instituteId: string;
    search: ProductPageSearch;
}) {
    const { data } = useSuspenseQuery(handleGetProductPage(productPageCode, instituteId));
    const vendor = ((data?.vendor || 'FREE').toUpperCase()) as PaymentVendor;

    return (
        <PaymentGatewayWrapper vendor={vendor} instituteId={instituteId}>
            <ProductPageShell
                productPageCode={productPageCode}
                instituteId={instituteId}
                courseIds={search.courseIds}
                defaultTab={search.defaultTab}
                utmParams={{
                    utm_source: search.utm_source,
                    utm_medium: search.utm_medium,
                    utm_campaign: search.utm_campaign,
                    utm_content: search.utm_content,
                    utm_term: search.utm_term,
                }}
            />
        </PaymentGatewayWrapper>
    );
}
