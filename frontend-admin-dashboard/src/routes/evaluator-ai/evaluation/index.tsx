import { createFileRoute } from "@tanstack/react-router";
import { LayoutContainer } from "../-components/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect } from "react";
import { EvaluatedStudents } from "./-components/evaluation";

export const Route = createFileRoute("/evaluator-ai/evaluation/")({
    component: () => (
        <LayoutContainer>
            <RouteComponent />
        </LayoutContainer>
    ),
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Evaluate Students</h1>);
    }, []);
    return <EvaluatedStudents />;
}
