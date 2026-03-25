import { ResourcesCard } from './ResourcesCard';
import { handleQueryGetListIndividualTopics } from '../../-services/ai-center-service';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useSuspenseQuery } from '@tanstack/react-query';

const MyResources = () => {
    const { data: allTasks, isLoading } = useSuspenseQuery(handleQueryGetListIndividualTopics());

    if (isLoading)
        return (
            <div className="flex h-screen w-[98%] items-center justify-center">
                <DashboardLoader />
            </div>
        );
    return <ResourcesCard apiResponse={allTasks} />;
};
export default MyResources;
