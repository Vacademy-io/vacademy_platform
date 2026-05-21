import { StepProgress } from './StepProgress';
import { HeaderBlock, NewHeaderBlock, FooterBlock, NewFooterBlock } from './PageRenderer';
import type { ProductPageData, PageJson } from '../-types/product-page-types';

interface CheckoutLayoutProps {
    pageData: ProductPageData;
    pageJson: PageJson;
    primaryColor: string;
    children: React.ReactNode;
}

export const CheckoutLayout = ({ pageData, pageJson, primaryColor, children }: CheckoutLayoutProps) => {
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

            {/* Step progress */}
            <div className="border-b border-gray-200 bg-white px-4 py-5">
                <div className="mx-auto max-w-3xl">
                    <StepProgress primaryColor={primaryColor} />
                </div>
            </div>

            {/* Step content */}
            <div className="bg-white">
                {children}
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
