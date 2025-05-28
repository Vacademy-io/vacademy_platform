import { createFileRoute } from "@tanstack/react-router";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { CommunityPage } from "./-components/CommunityPage";
import { useEffect } from "react";
import { Helmet } from "react-helmet";

export const Route = createFileRoute("/community/")({
    component: () => (
        <LayoutContainer intrnalMargin={false}>
            <CommunityLayoutPage />
        </LayoutContainer>
    ),
});

function CommunityLayoutPage() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Community</h1>);
    }, []);
    return (
        <>
            <Helmet>
                <title>Community</title>
                <meta
                    name="description"
                    content="This page contails all the qustion/question-bank created by the vacademy community"
                />
            </Helmet>
            <CommunityPage />
        </>
    );
}
