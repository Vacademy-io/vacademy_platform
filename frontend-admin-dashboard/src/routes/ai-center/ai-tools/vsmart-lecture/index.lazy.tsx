import { createLazyFileRoute } from '@tanstack/react-router';
import PlanLectureAI from './-components/PlanLectureAI';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { AICenterProvider } from '../../-contexts/useAICenterContext';

export const Route = createLazyFileRoute('/ai-center/ai-tools/vsmart-lecture/')({
    component: RouteComponent,
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        const heading = (
            <div className="flex items-center gap-4">
                <CaretLeft onClick={() => window.history.back()} className="cursor-pointer" />
                <div>VSmart AI Tools</div>
            </div>
        );

        setNavHeading(heading);
    }, []);
    return (
        <LayoutContainer>
            <AICenterProvider>
                <PlanLectureAI />
            </AICenterProvider>
        </LayoutContainer>
    );
}
