import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyTaxMain } from '@/routes/erp/my-hr/-components/MyTaxMain';

export const Route = createLazyFileRoute('/erp/my-hr/tax/')({
    component: () => (
        <LayoutContainer>
            <MyTaxPage />
        </LayoutContainer>
    ),
});

function MyTaxPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">My Tax</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>My Tax</title>
                <meta
                    name="description"
                    content="Choose your tax regime and declare what you plan to claim this financial year."
                />
            </Helmet>
            <MyTaxMain />
        </>
    );
}
