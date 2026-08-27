import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ProductPageShell } from './-components/ProductPageShell';
import { PaymentGatewayWrapper } from '@/components/common/enroll-by-invite/-components/payment-gateway-wrapper';
import { handleGetProductPage } from './-services/product-page-service';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Warning } from "@phosphor-icons/react";
import { resolveDomainRouting, getCurrentDomainInfo } from '@/services/domain-routing';
import type { PaymentVendor } from '@/components/common/enroll-by-invite/-utils/payment-vendor-helper';

const productPageSearchSchema = z.object({
    instituteId: z.string().optional(),
    courseIds: z.string().optional(),
    defaultTab: z.enum(['CATALOG', 'CART', 'PAYMENT']).optional(),
    // Catalogue slug the visitor arrived from. Lets the page wear that
    // catalogue's header, footer and theme instead of rendering bare.
    tagName: z.string().optional(),
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_content: z.string().optional(),
    utm_term: z.string().optional(),
});

type ProductPageSearch = z.infer<typeof productPageSearchSchema>;

// fullscreen=true uses fixed inset-0 — immune to parent container height constraints
function Spinner() {
    return <DashboardLoader fullscreen />;
}

function ErrorScreen({ title, message }: { title: string; message: string }) {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
            <div className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-red-100">
                <Warning className="size-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="mt-3 max-w-sm text-sm text-gray-500">{message}</p>
        </div>
    );
}

function ProductPageErrorScreen({ error }: { error: unknown }) {
    const { t } = useTranslation('productPages');
    return (
        <ErrorScreen
            title={t('errors.pageNotAvailable.title')}
            message={error instanceof Error ? error.message : t('errors.pageNotAvailable.defaultMessage')}
        />
    );
}

export const Route = createFileRoute('/product-pages/$productPageCode/')({
    validateSearch: productPageSearchSchema,
    component: RouteComponent,
    errorComponent: ({ error }) => <ProductPageErrorScreen error={error} />,
    pendingComponent: Spinner,
});

function parseProductPageCode(rawCode: string): { code: string; embeddedParams: URLSearchParams } {
    const ampIdx = rawCode.indexOf('&');
    if (ampIdx === -1) return { code: rawCode, embeddedParams: new URLSearchParams() };
    return {
        code: rawCode.slice(0, ampIdx),
        embeddedParams: new URLSearchParams(rawCode.slice(ampIdx + 1)),
    };
}

function RouteComponent() {
    const { t } = useTranslation('productPages');
    const { productPageCode: rawCode } = Route.useParams();
    const search = Route.useSearch();
    const { code: productPageCode, embeddedParams } = parseProductPageCode(rawCode);
    const courseIds = search.courseIds ?? embeddedParams.get('courseIds') ?? undefined;
    // Same recovery as courseIds: a link whose query got glued onto the code
    // segment ("/product-pages/abc&tagName=x") still resolves its catalogue.
    const tagName = search.tagName ?? embeddedParams.get('tagName') ?? undefined;

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
                title={t('errors.instituteNotFound.title')}
                message={t('errors.instituteNotFound.message')}
            />
        );
    }

    return (
        <ProductPageLoader
            productPageCode={productPageCode}
            instituteId={resolvedInstituteId}
            search={{ ...search, courseIds, tagName }}
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
                pageData={data}
                courseIds={search.courseIds}
                defaultTab={search.defaultTab}
                tagName={search.tagName}
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
