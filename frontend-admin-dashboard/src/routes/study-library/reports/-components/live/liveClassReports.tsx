import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChartBar, GraduationCap } from '@phosphor-icons/react';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import BatchLiveReport from './batchLiveReport';
import LearnerLiveReport from './learnerLiveReport';

export default function LiveClassReports() {
    const triggerClass =
        'flex items-center gap-2 rounded-md px-4 py-2.5 text-body font-medium transition-all duration-200 data-[state=active]:bg-primary-500 data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-primary-50 hover:text-primary-600';

    return (
        <div className="w-full">
            <Tabs defaultValue="batch" className="w-full">
                <div className="border-b border-neutral-200 bg-white px-6 py-4">
                    <TabsList className="h-11 rounded-lg bg-neutral-100 p-1 shadow-sm">
                        <TabsTrigger value="batch" className={triggerClass}>
                            <ChartBar className="size-4" />
                            {getTerminology(ContentTerms.Batch, SystemTerms.Batch)}
                        </TabsTrigger>
                        <TabsTrigger value="learner" className={triggerClass}>
                            <GraduationCap className="size-4" />
                            {getTerminology(RoleTerms.Learner, SystemTerms.Learner)}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="bg-white">
                    <TabsContent value="batch" className="mt-0 p-6 focus-visible:outline-none">
                        <BatchLiveReport />
                    </TabsContent>
                    <TabsContent value="learner" className="mt-0 p-6 focus-visible:outline-none">
                        <LearnerLiveReport />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
