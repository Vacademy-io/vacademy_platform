import React, { useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { CheckCircle, Eye, Spinner } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { submitForReview } from '@/routes/study-library/courses/-services/approval-services';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { ChangesPreviewModal } from './ChangesPreviewModal';

interface SendForApprovalButtonProps {
    courseId: string;
    hasChanges: boolean;
    disabled?: boolean;
}

export function SendForApprovalButton({
    courseId,
    hasChanges,
    disabled = false,
}: SendForApprovalButtonProps) {
    const [showPreview, setShowPreview] = useState(false);
    const navigate = useNavigate();

    // Submit for review mutation
    const submitMutation = useMutation({
        mutationFn: (courseId: string) => submitForReview(courseId),
        onSuccess: () => {
            toast.success('Course submitted for review successfully!');
            // Navigate to courses page with "Courses In Review" tab
            navigate({
                to: '/study-library/courses',
                search: { selectedTab: 'CourseInReview' },
            });
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to submit course for review');
        },
    });

    const handlePreviewChanges = () => {
        setShowPreview(true);
    };

    const handleSubmitForApproval = () => {
        submitMutation.mutate(courseId);
    };

    if (!hasChanges) {
        return null;
    }

    return (
        <>
            <div className="pointer-events-auto fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-[calc(1.5rem+env(safe-area-inset-right))] z-[80]">
                <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white/90 p-2 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-white/70">
                    {/* Preview Changes Button */}
                    <MyButton
                        buttonType="secondary"
                        onClick={handlePreviewChanges}
                        disabled={disabled || submitMutation.isPending}
                        className="shadow-lg"
                    >
                        <Eye size={16} className="mr-2" />
                        Preview Changes
                    </MyButton>

                    {/* Send for Approval Button */}
                    <MyButton
                        buttonType="primary"
                        onClick={handleSubmitForApproval}
                        disabled={disabled || submitMutation.isPending}
                        className="bg-green-600 shadow-lg hover:bg-green-700"
                    >
                        {submitMutation.isPending ? (
                            <>
                                <Spinner size={16} className="mr-2 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <CheckCircle size={16} className="mr-2" />
                                Send for Approval
                            </>
                        )}
                    </MyButton>
                </div>
            </div>

            {/* Changes Preview Modal */}
            <ChangesPreviewModal
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                courseId={courseId}
                onSubmitForApproval={handleSubmitForApproval}
                isSubmitting={submitMutation.isPending}
            />
        </>
    );
}
