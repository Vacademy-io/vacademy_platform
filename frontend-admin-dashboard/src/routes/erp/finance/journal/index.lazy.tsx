import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { JournalMain } from '../-components/JournalMain';

export const Route = createLazyFileRoute('/erp/finance/journal/')({
    component: () => (
        <LayoutContainer>
            <JournalPage />
        </LayoutContainer>
    ),
});

function JournalPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Accounting Journal</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Accounting Journal</title>
                <meta
                    name="description"
                    content="Double-entry journal posted by approved payroll runs, exportable for Zoho Books or Tally."
                />
            </Helmet>
            <JournalMain />
        </>
    );
}
