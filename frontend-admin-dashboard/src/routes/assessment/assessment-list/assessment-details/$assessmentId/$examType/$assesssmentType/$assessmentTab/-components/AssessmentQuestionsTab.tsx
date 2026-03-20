import { Accordion } from '@/components/ui/accordion';
import { Route } from '..';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { getAssessmentDetails } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import AssessmentQuestionsSection from './AssessmentQuestionsSection';

export const AssessmentQuestionsTab = () => {
    const { assessmentId, examType } = Route.useParams();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const { data: assessmentDetails, isLoading } = useSuspenseQuery(
        getAssessmentDetails({
            assessmentId: assessmentId,
            instituteId: instituteDetails?.id,
            type: examType,
        })
    );
    if (isLoading) return <DashboardLoader />;
    return (
        <Accordion type="single" collapsible>
            {assessmentDetails[1]?.saved_data?.sections?.map((section, index) => (
                <AssessmentQuestionsSection key={index} section={section} index={index} />
            ))}
        </Accordion>
    );
};
