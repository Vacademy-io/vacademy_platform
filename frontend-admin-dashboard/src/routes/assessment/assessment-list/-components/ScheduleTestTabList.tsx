import { Badge } from '@/components/ui/badge';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScheduleTestTab } from '@/types/assessments/assessment-list';

const ScheduleTestTabList = ({
    selectedTab,
    scheduleTestTabsData,
    tabCounts,
}: {
    selectedTab: string;
    scheduleTestTabsData: ScheduleTestTab[];
    // Real per-tab counts, populated up front (independent of which tab is open).
    // null = not fetched yet; fall back to the loaded list's total when present.
    tabCounts?: Record<string, number | null>;
}) => {
    // Prefer the independently-fetched count; fall back to the tab's loaded list
    // total, then 0. Keeps badges correct before a tab is ever opened.
    const countFor = (tabValue: string, tabData: ScheduleTestTab | undefined) => {
        const c = tabCounts?.[tabValue];
        if (c !== null && c !== undefined) return c;
        return tabData?.data?.content?.length ? tabData?.data?.total_elements ?? 0 : 0;
    };

    return (
        <TabsList className="inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
            <TabsTrigger
                value="liveTests"
                className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                    selectedTab === 'liveTests'
                        ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                        : 'border-none bg-transparent'
                }`}
            >
                <span className={`${selectedTab === 'liveTests' ? 'text-primary-500' : ''}`}>
                    Live
                </span>
                <Badge
                    className="rounded-[10px] bg-primary-500 p-0 px-2 text-[9px] text-white"
                    variant="outline"
                >
                    {countFor('liveTests', scheduleTestTabsData[0])}
                </Badge>
            </TabsTrigger>
            <TabsTrigger
                value="upcomingTests"
                className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                    selectedTab === 'upcomingTests'
                        ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                        : 'border-none bg-transparent'
                }`}
            >
                <span className={`${selectedTab === 'upcomingTests' ? 'text-primary-500' : ''}`}>
                    Upcoming
                </span>
                <Badge
                    className="rounded-[10px] bg-primary-500 p-0 px-2 text-[9px] text-white"
                    variant="outline"
                >
                    {countFor('upcomingTests', scheduleTestTabsData[1])}
                </Badge>
            </TabsTrigger>
            <TabsTrigger
                value="previousTests"
                className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                    selectedTab === 'previousTests'
                        ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                        : 'border-none bg-transparent'
                }`}
            >
                <span className={`${selectedTab === 'previousTests' ? 'text-primary-500' : ''}`}>
                    Previous
                </span>
                <Badge
                    className="rounded-[10px] bg-primary-500 p-0 px-2 text-[9px] text-white"
                    variant="outline"
                >
                    {countFor('previousTests', scheduleTestTabsData[2])}
                </Badge>
            </TabsTrigger>
            <TabsTrigger
                value="draftTests"
                className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                    selectedTab === 'draftTests'
                        ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                        : 'border-none bg-transparent'
                }`}
            >
                <span className={`${selectedTab === 'draftTests' ? 'text-primary-500' : ''}`}>
                    Drafts
                </span>
                <Badge
                    className="rounded-[10px] bg-primary-500 p-0 px-2 text-[9px] text-white"
                    variant="outline"
                >
                    {countFor('draftTests', scheduleTestTabsData[3])}
                </Badge>
            </TabsTrigger>
        </TabsList>
    );
};

export default ScheduleTestTabList;
