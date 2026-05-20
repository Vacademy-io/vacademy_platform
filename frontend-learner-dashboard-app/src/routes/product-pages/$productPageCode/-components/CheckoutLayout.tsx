import { useState, useEffect } from 'react';
import { getPublicUrl } from '@/services/upload_file';
import { StepProgress } from './StepProgress';
import type { ProductPageData, PageJson } from '../-types/product-page-types';

interface CheckoutLayoutProps {
    pageData: ProductPageData;
    pageJson: PageJson;
    primaryColor: string;
    children: React.ReactNode;
}

export const CheckoutLayout = ({ pageData, pageJson, primaryColor, children }: CheckoutLayoutProps) => {
    const comps = pageJson.components.filter((c) => c.enabled);

    const headerComp = comps.find((c) => c.type === 'Header' || c.type === 'header');
    const footerComp = comps.find((c) => c.type === 'Footer' || c.type === 'footer');

    // Logo — new-format stores a direct URL; legacy format stores a file ID
    const directLogoUrl = (headerComp?.props?.logo as string) || '';
    const logoFileId = (headerComp?.props?.logoFileId as string) || pageJson.globalSettings?.logoFileId || '';
    const headerTitle = (headerComp?.props?.title as string) || pageData.name;

    const footerText =
        (footerComp?.props?.bottomNote as string) ||
        (footerComp?.props?.text as string) ||
        ((footerComp?.props?.leftSection as Record<string, unknown>)?.title as string) ||
        '';

    const [fileLogoUrl, setFileLogoUrl] = useState('');
    useEffect(() => {
        if (!logoFileId || directLogoUrl) return;
        getPublicUrl(logoFileId).then(setFileLogoUrl).catch(() => {});
    }, [logoFileId, directLogoUrl]);

    const logoUrl = directLogoUrl || fileLogoUrl;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Branded header */}
            <header
                className="flex items-center gap-3 px-6 py-3 shadow-sm"
                style={{ backgroundColor: primaryColor }}
            >
                {logoUrl && (
                    <img src={logoUrl} alt="logo" className="h-8 w-auto object-contain" />
                )}
                <span className="text-base font-bold text-white truncate">{headerTitle}</span>
            </header>

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

            {/* Footer */}
            {footerText && (
                <footer className="border-t border-gray-100 px-6 py-6 text-center text-xs text-gray-400">
                    {footerText}
                </footer>
            )}
        </div>
    );
};
