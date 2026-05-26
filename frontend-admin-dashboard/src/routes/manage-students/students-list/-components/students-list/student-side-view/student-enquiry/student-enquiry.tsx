import { ClipboardText } from '@phosphor-icons/react';
import { EnquiryDetails } from '@/routes/admissions/enquiries/-components/enquiry-side-view/enquiry-details';
import { ProfileEmpty } from '../profile-ui';

interface StudentEnquiryProps {
    enquiryId?: string | null;
}

export const StudentEnquiry = ({ enquiryId }: StudentEnquiryProps) => {
    if (!enquiryId) {
        return (
            <ProfileEmpty
                icon={ClipboardText}
                title="No enquiry found"
                hint="No enquiry is linked to this learner yet."
            />
        );
    }

    return <EnquiryDetails enquiryId={enquiryId} />;
};
