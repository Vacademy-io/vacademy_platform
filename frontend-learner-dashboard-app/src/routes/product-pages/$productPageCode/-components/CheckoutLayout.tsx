import { useState, useEffect } from 'react';
import { getPublicUrl } from '@/services/upload_file';
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
    const hasDesignedHeader = headerComps.length > 0;

    // Fallback logo resolution — only used when no designed header component exists
    const fallbackLogoFileId = pageJson.globalSettings?.logoFileId || '';
    const [fallbackLogoUrl, setFallbackLogoUrl] = useState('');
    useEffect(() => {
        if (hasDesignedHeader || !fallbackLogoFileId) return;
        getPublicUrl(fallbackLogoFileId).then(setFallbackLogoUrl).catch(() => {});
    }, [fallbackLogoFileId, hasDesignedHeader]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Full designed header — falls back to simple branded bar when no header component */}
            {hasDesignedHeader ? (
                headerComps.map((c) =>
                    c.type === 'Header'
                        ? <HeaderBlock key={c.id} props={c.props} primaryColor={primaryColor} pageName={pageData.name} />
                        : <NewHeaderBlock key={c.id} props={c.props} primaryColor={primaryColor} pageName={pageData.name} />
                )
            ) : (
                <header
                    className="flex items-center gap-3 px-6 py-3 shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                >
                    {fallbackLogoUrl && (
                        <img src={fallbackLogoUrl} alt="logo" className="h-8 w-auto object-contain" />
                    )}
                    <span className="text-base font-bold text-white truncate">{pageData.name}</span>
                </header>
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
