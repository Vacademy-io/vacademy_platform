import { createFileRoute } from "@tanstack/react-router";
import PDFEvaluator from "./-components/pdf-editor";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { Helmet } from "react-helmet";
import { useEffect } from "react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";

export const Route = createFileRoute("/evaluation/evaluation-tool/")({
    component: RouteComponent,
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Evaluation Tool</h1>);
    }, []);
    return (
        <LayoutContainer>
            <Helmet>
                <title>Evaluation</title>
                <meta
                    name="description"
                    content="This page let you evaluate your students' responses."
                />
            </Helmet>
            <PDFEvaluator isFreeTool />
        </LayoutContainer>
    );
}
