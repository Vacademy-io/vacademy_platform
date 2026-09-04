import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyClaimsMain } from '@/routes/erp/my-hr/-components/MyClaimsMain';

export const Route = createLazyFileRoute('/erp/my-hr/claims/')({
    component: () => (
        <LayoutContainer>
            <MyClaimsPage />
        </LayoutContainer>
    ),
});

function MyClaimsPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">My Claims</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>My Claims</title>
                <meta
                    name="description"
                    content="Your expense claims and any loan or advance you are repaying through salary."
                />
            </Helmet>
            <MyClaimsMain />
        </>
    );
}
