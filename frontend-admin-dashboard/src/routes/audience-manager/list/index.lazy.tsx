import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { AudienceInvite } from './-components/audience-invite/audience-invite';
import { AudienceInviteFormProvider } from './-context/useAudienceInviteFormContext';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import { Helmet } from 'react-helmet';

export const Route = createLazyFileRoute('/audience-manager/list/')({
  component: AudienceManagerListPage,
});

export function AudienceManagerListPage() {
  const { setNavHeading } = useNavHeadingStore();

  useEffect(() => {
    setNavHeading('Manage Campaigns');
  }, [setNavHeading]);

  return (
    <AudienceInviteFormProvider>
      <LayoutContainer>
        <AudienceInvite />
      </LayoutContainer>
    </AudienceInviteFormProvider>
  );
}
