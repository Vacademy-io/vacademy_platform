import { createFileRoute } from "@tanstack/react-router";
import CourseCatalougePage from "./-component/CourseCatalougePage";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useEffect } from "react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
export const Route = createFileRoute("/study-library/courses/")({
    component: RouteComponent,
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(
            `${getTerminology(ContentTerms.Course, SystemTerms.Course)}s`
        );
    }, []);

    return (
        <LayoutContainer>
            <CourseCatalougePage />
        </LayoutContainer>
    );
}
