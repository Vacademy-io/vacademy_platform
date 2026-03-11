import { ClipboardText } from '@phosphor-icons/react';
import { EnquiryDetails } from '@/routes/admissions/enquiries/-components/enquiry-side-view/enquiry-details';

interface StudentEnquiryProps {
    enquiryId?: string | null;
}

export const StudentEnquiry = ({ enquiryId }: StudentEnquiryProps) => {
    if (!enquiryId) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-10 text-center">
                <ClipboardText weight="fill" className="size-10 text-neutral-300" />
                <p className="text-sm font-medium text-neutral-500">No enquiry found</p>
                <p className="text-xs text-neutral-400">
                    No enquiry is linked to this student yet.
                </p>
            </div>
        );
    }

    return <EnquiryDetails enquiryId={enquiryId} />;
};
