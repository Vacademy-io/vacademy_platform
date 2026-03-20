import { ApplicationDetails } from '../application-details';

interface StudentApplicationProps {
    applicantId?: string | null;
}

export const StudentApplication = ({ applicantId }: StudentApplicationProps) => {
    if (!applicantId) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50/50 p-6 text-center">
                <svg
                    className="mb-2 size-10 text-neutral-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m0 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <p className="text-sm text-neutral-600">No application found</p>
            </div>
        );
    }

    return <ApplicationDetails applicantId={applicantId} />;
};
