import { createLazyFileRoute } from '@tanstack/react-router';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { UseCases } from '@/components/landing/UseCases';
import { CTA } from '@/components/landing/CTA';
import { Footer } from '@/components/landing/Footer';

export const Route = createLazyFileRoute('/landing')({
    component: LandingPage,
});

function LandingPage() {
    return (
        <div style={{ width: '100%', position: 'static' }}>
            <Header />
            <main style={{ width: '100%', position: 'static' }}>
                <Hero />
                <Features />
                <UseCases />
                <CTA />
            </main>
            <Footer />
        </div>
    );
}
