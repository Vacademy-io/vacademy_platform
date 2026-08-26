import { ShieldCheck } from '@phosphor-icons/react';
import { StepProgress } from './StepProgress';
import { OrderSummaryPanel } from './OrderSummaryPanel';
import { HeaderBlock, NewHeaderBlock, FooterBlock, NewFooterBlock } from './PageRenderer';
import type { ProductPageData, PageJson, ProductPageSettings } from '../-types/product-page-types';

interface CheckoutLayoutProps {
    pageData: ProductPageData;
    pageJson: PageJson;
    settings: ProductPageSettings;
    primaryColor: string;
    children: React.ReactNode;
}

/**
 * Shell for every checkout step: step rail on top, step content on the left,
 * and a live order summary that stays put on the right as the visitor moves
 * from cart to details to payment. Individual steps must not render their own
 * summary — the panel here is the single place the running total is shown.
 */
export const CheckoutLayout = ({
    pageData,
    pageJson,
    settings,
    primaryColor,
    children,
}: CheckoutLayoutProps) => {
    const comps = pageJson.components.filter((c) => c.enabled);

    const headerComps = comps.filter((c) => c.type === 'Header' || c.type === 'header');
    const footerComp = comps.find((c) => c.type === 'Footer' || c.type === 'footer');

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Render designed header only if explicitly added to the page */}
            {headerComps.length > 0 && headerComps.map((c) =>
                c.type === 'Header'
                    ? <HeaderBlock key={c.id} props={c.props} primaryColor={primaryColor} pageName={pageData.name} />
                    : <NewHeaderBlock key={c.id} props={c.props} primaryColor={primaryColor} pageName={pageData.name} />
            )}

            {/* Step progress + trust marker */}
            <div className="border-b border-gray-200 bg-white px-4 py-5">
                <div className="mx-auto flex max-w-screen-xl items-center gap-4">
                    <div className="min-w-0 flex-1 overflow-x-auto">
                        <StepProgress primaryColor={primaryColor} />
                    </div>
                    <div className="hidden shrink-0 items-center gap-1.5 md:flex">
                        <ShieldCheck className="size-4 text-success-600" aria-hidden="true" />
                        <div className="leading-tight">
                            <p className="text-caption font-semibold text-gray-700">Secure &amp; Safe</p>
                            <p className="text-2xs text-gray-400">Your data is protected</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step content + live order summary */}
            <div className="mx-auto max-w-screen-xl px-4 py-6 lg:flex lg:items-start lg:gap-6">
                <div className="min-w-0 flex-1">
                    {/* Mobile: the summary leads, so the total is visible before
                        the visitor scrolls through a long form to find it. */}
                    <OrderSummaryPanel
                        pageData={pageData}
                        settings={settings}
                        className="mb-5 lg:hidden"
                    />
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        {children}
                    </div>
                </div>

                <aside className="hidden lg:block lg:w-80 lg:shrink-0" aria-label="Order summary">
                    <OrderSummaryPanel pageData={pageData} settings={settings} sticky />
                </aside>
            </div>

            {/* Full designed footer */}
            {footerComp && (
                footerComp.type === 'Footer'
                    ? <FooterBlock props={footerComp.props} />
                    : <NewFooterBlock props={footerComp.props} />
            )}
        </div>
    );
};
