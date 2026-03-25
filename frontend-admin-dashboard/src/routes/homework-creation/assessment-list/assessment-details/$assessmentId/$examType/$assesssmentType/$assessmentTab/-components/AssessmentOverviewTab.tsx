import { Separator } from '@/components/ui/separator';
import { QuestionsPieChart } from './QuestionsPieChart';
import { QuestionsMarkRankGraph } from './QuestionsMarkRankGraph';
import { QuestionAnalysisChart } from './QuestionAnalysisChart';

const AssessmentOverviewTab = () => {
    return (
        <>
            <QuestionsPieChart />
            <Separator className="my-10" />
            <QuestionsMarkRankGraph />
            <Separator className="mb-10 mt-4" />
            <QuestionAnalysisChart />
        </>
    );
};

export default AssessmentOverviewTab;
