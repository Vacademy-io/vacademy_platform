import { createFileRoute } from "@tanstack/react-router";
import { GenerateQuestionsFromAudio } from "./-components/GenerateQuestionsFromAudio";
import { AICenterProvider } from "@/routes/ai-center/-contexts/useAICenterContext";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useEffect } from "react";
import { CaretLeft } from "phosphor-react";
import { useNavigate } from "@tanstack/react-router";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";

export const Route = createFileRoute("/ai-center/ai-tools/vsmart-audio/")({
    component: RouteComponent,
});

function RouteComponent() {
    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        const heading = (
            <div className="flex items-center gap-4">
                <CaretLeft
                    onClick={() => {
                        navigate({
                            to: "/ai-center",
                        });
                    }}
                    className="cursor-pointer"
                />
                <div>VSmart AI Tools</div>
            </div>
        );

        setNavHeading(heading);
    }, []);
    return (
        <LayoutContainer>
            <AICenterProvider>
                <GenerateQuestionsFromAudio />
            </AICenterProvider>
        </LayoutContainer>
    );
}
