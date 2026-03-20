import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { PRODUCT_NAME } from '@/config/branding';
import { PricingPage } from '@/components/pricing/PricingPage';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';

export const Route = createLazyFileRoute('/pricing')({
    component: () => (
        <div className="bg-white" style={{ width: '100%', position: 'static' }}>
            <Helmet>
                <title>Pricing - {PRODUCT_NAME}</title>
                <meta
                    name="description"
                    content={`See our flexible pricing plans for ${PRODUCT_NAME}.`}
                />
            </Helmet>
            <Header />
            <PricingPage />
            <Footer />
        </div>
    ),
});
