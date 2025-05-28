import { createFileRoute } from '@tanstack/react-router'
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useEffect } from "react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import {NotificationList} from "../-components/NotificationsList"

export const Route = createFileRoute('/dashboard/notifications/')({
  component: RouteComponent,
})

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
      setNavHeading("Notifications");
    }, []);
  return (
    <LayoutContainer>
        <NotificationList/>
    </LayoutContainer>
  );
}
