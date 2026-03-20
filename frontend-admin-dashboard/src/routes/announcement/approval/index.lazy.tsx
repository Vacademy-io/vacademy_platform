import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';

export const Route = createLazyFileRoute('/announcement/approval/')({
    component: () => (
        <LayoutContainer>
            <AnnouncementApprovalPage />
        </LayoutContainer>
    ),
});

function AnnouncementApprovalPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading('Announcement Approval');
    }, [setNavHeading]);

    return (
        <div className="p-4">
            {/* TODO: Pending approvals list with approve/reject actions */}
            <h2 className="text-xl font-semibold">Announcement Approval</h2>
        </div>
    );
}
