import { ClipboardText } from '@phosphor-icons/react';
import { ApplicationDetails } from '../application-details';
import { ProfileEmpty } from '../profile-ui';

interface StudentApplicationProps {
    applicantId?: string | null;
}

export const StudentApplication = ({ applicantId }: StudentApplicationProps) => {
    if (!applicantId) {
        return (
            <ProfileEmpty
                icon={ClipboardText}
                title="No application found"
                hint="No application is linked to this learner yet."
            />
        );
    }

    return <ApplicationDetails applicantId={applicantId} />;
};
