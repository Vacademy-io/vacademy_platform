import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PackageCourseSettingEditor } from './PackageCourseSettingEditor';
import { LmsSettingsCard } from './LmsSettingsCard';
import { CourseWorkflowTriggersCard } from './CourseWorkflowTriggersCard';

interface PackageSettingsPanelProps {
    packageId: string;
}

/**
 * Course-level (package) settings, shown in the course-details "Settings" tab as two horizontal
 * tabs: LMS Integration (the friendly connection + workflow setup, default) and Advanced
 * Settings (the raw course_setting JSON editor).
 */
export const PackageSettingsPanel: React.FC<PackageSettingsPanelProps> = ({ packageId }) => {
    // Bumped after a JSON save so the LMS card re-derives its state.
    const [refreshKey, setRefreshKey] = useState(0);

    if (!packageId) {
        return (
            <div className="p-6 text-sm text-muted-foreground">
                Save the course first to configure its settings.
            </div>
        );
    }

    return (
        <div className="p-2">
            <Tabs defaultValue="lms" className="w-full">
                <TabsList>
                    <TabsTrigger value="lms">LMS Integration</TabsTrigger>
                    <TabsTrigger value="workflows">Workflow Triggers</TabsTrigger>
                    <TabsTrigger value="json">Advanced Settings (JSON)</TabsTrigger>
                </TabsList>
                {/* key={packageId} remounts the cards when you switch courses, so prefilled
                    connection/courseId/triggers never leak from a previously-open course. */}
                <TabsContent value="lms" className="mt-4">
                    <LmsSettingsCard
                        key={packageId}
                        packageId={packageId}
                        refreshKey={refreshKey}
                    />
                </TabsContent>
                <TabsContent value="workflows" className="mt-4">
                    <CourseWorkflowTriggersCard key={packageId} packageId={packageId} />
                </TabsContent>
                <TabsContent value="json" className="mt-4">
                    <PackageCourseSettingEditor
                        packageId={packageId}
                        onSaved={() => setRefreshKey((k) => k + 1)}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
};
