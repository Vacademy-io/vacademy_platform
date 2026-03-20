import { ScheduleTestMainComponent } from '@/routes/assessment/assessment-list/-components/ScheduleTestMainComponent';

const Assessments = ({ packageSessionId }: { packageSessionId: string }) => {
    return (
        <ScheduleTestMainComponent
            batchId={packageSessionId}
            isCourseOutline
            showBatchFilter={false}
        />
    );
};

export default Assessments;
