import { TabsContent } from '@/components/ui/tabs';
import { EmptyScheduleTest } from '@/svgs';
import { MyPagination } from '@/components/design-system/pagination';
import { ScheduleTestListsProps } from '@/types/assessments/schedule-test-list';
import ScheduleTestDetails from './ScheduleTestDetails';

const ScheduleTestLists: React.FC<ScheduleTestListsProps> = ({
    tab,
    pageNo,
    handlePageChange,
    selectedTab,
    handleRefetchData,
}) => {
    return (
        <TabsContent key={tab.value} value={tab.value}>
            {tab.data.content.length === 0 ? (
                <div className="flex h-screen flex-col items-center justify-center">
                    <EmptyScheduleTest />
                    <span className="text-neutral-600">{tab.message}</span>
                </div>
            ) : (
                <>
                    {tab.data.content.map((item, index) => (
                        <ScheduleTestDetails
                            key={index}
                            scheduleTestContent={item}
                            selectedTab={selectedTab}
                            handleRefetchData={handleRefetchData}
                        />
                    ))}
                    <MyPagination
                        currentPage={pageNo}
                        totalPages={Math.ceil(tab.data.total_pages)}
                        onPageChange={handlePageChange}
                    />
                </>
            )}
        </TabsContent>
    );
};

export default ScheduleTestLists;
