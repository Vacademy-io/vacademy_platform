import { createFileRoute } from "@tanstack/react-router";
import "./styles.css";
import { Helmet } from "react-helmet";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import ManagePresentation from "@/components/common/slides/manage-presentation";

export const Route = createFileRoute("/study-library/present/")({
    component: RouteComponent,
});

function RouteComponent() {
    return  <LayoutContainer>
    {/* <EmptyDashboard /> */}
    <Helmet>
        <title>Presentation</title>
        <meta name="description" content="This page contains the management of batches" />
    </Helmet>
    <ManagePresentation/>

   </LayoutContainer>
}

