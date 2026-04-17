import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useState } from 'react';
import { TabsContent } from '@radix-ui/react-tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { StudentListTab } from './StudentListTab';
import testAccessSchema from '../-utils/add-participants-schema';
import { z } from 'zod';
import { UseFormReturn } from 'react-hook-form';
import { UsersThree, User, Stack } from '@phosphor-icons/react';
import { Route } from '..';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn, convertCapitalToTitleCase } from '@/lib/utils';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

type TestAccessFormType = z.infer<typeof testAccessSchema>;

type BatchItem = {
    id: string;
    name: string;
};

interface SectionInfoInterface {
    id: string;
    name: string;
}

type BatchData = Record<string, BatchItem[]>;

export function AddingParticipantsTab({
    batches,
    form,
    totalBatches,
    selectedSection,
    setSelectedSection,
    sectionsInfo,
}: {
    batches: BatchData;
    form: UseFormReturn<TestAccessFormType>;
    totalBatches: BatchData;
    selectedSection: string;
    setSelectedSection: React.Dispatch<React.SetStateAction<string | undefined>>;
    sectionsInfo: SectionInfoInterface[];
}) {
    const [selectedTab, setSelectedTab] = useState(
        form.getValues('select_individually.checked') === true ? 'Individually' : 'Batch'
    );
    const handleChange = (value: string) => {
        setSelectedTab(value);
    };

    useEffect(() => {
        if (selectedTab === 'Batch') {
            form.setValue('select_batch.checked', true);
            form.setValue('select_individually.checked', false);
        } else {
            form.setValue('select_batch.checked', false);
            form.setValue('select_individually.checked', true);
        }
    }, [selectedTab]);

    return (
        <Card className="border-neutral-200/80 shadow-sm">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                    <UsersThree size={18} weight="bold" />
                </div>
                <div>
                    <CardTitle className="text-subtitle font-semibold">
                        Participant Selection
                    </CardTitle>
                    <CardDescription>
                        Pick entire batches or hand-select individual learners.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs value={selectedTab} onValueChange={handleChange}>
                    <TabsList className="inline-flex h-auto w-auto items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
                        <TabsTrigger
                            value="Batch"
                            className={cn(
                                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                                'data-[state=active]:bg-white data-[state=active]:text-primary-600 data-[state=active]:shadow-sm',
                                'data-[state=inactive]:text-neutral-500 data-[state=inactive]:hover:text-neutral-700'
                            )}
                        >
                            <Stack size={16} weight="bold" />
                            Select Batch
                        </TabsTrigger>
                        <TabsTrigger
                            value="Individually"
                            className={cn(
                                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                                'data-[state=active]:bg-white data-[state=active]:text-primary-600 data-[state=active]:shadow-sm',
                                'data-[state=inactive]:text-neutral-500 data-[state=inactive]:hover:text-neutral-700'
                            )}
                        >
                            <User size={16} weight="bold" />
                            Select Individually
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="Batch" className="mt-6">
                        <Step3BatchList
                            batchData={batches}
                            form={form}
                            totalBatches={totalBatches}
                            selectedSection={selectedSection}
                            setSelectedSection={setSelectedSection}
                            sectionsInfo={sectionsInfo}
                        />
                    </TabsContent>
                    <TabsContent value="Individually" className="mt-6">
                        <StudentListTab form={form} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

const Step3BatchList = ({
    batchData,
    form,
    totalBatches,
    selectedSection,
    setSelectedSection,
    sectionsInfo,
}: {
    batchData: BatchData;
    form: UseFormReturn<TestAccessFormType>;
    totalBatches: BatchData;
    selectedSection: string;
    setSelectedSection: React.Dispatch<React.SetStateAction<string | undefined>>;
    sectionsInfo: SectionInfoInterface[];
}) => {
    const params = Route.useParams();
    const assessmentId = params.assessmentId ?? '';
    const { setValue, watch } = form;

    // Ensure batchDetails is initialized before using it
    const transformedBatches: Record<string, string[]> = Object.fromEntries(
        Object.entries(batchData).map(([key, value]) => [key, value.map((item) => item.id)])
    );

    // Ensure checkedState only contains string IDs
    const [checkedState, setCheckedState] = useState<Record<string, string[]>>(
        assessmentId === 'defaultId' ? {} : transformedBatches
    );

    watch('select_batch.batch_details');

    const handleParentToggle = (parentId: string, isChecked: boolean) => {
        setCheckedState((prev) => ({
            ...prev,
            [parentId]: isChecked ? totalBatches[parentId]?.map((item) => item.id) || [] : [],
        }));
    };

    const handleChildToggle = (parentId: string, childId: string, isChecked: boolean) => {
        setCheckedState((prev) => {
            const currentChildren = prev[parentId] || [];
            return {
                ...prev,
                [parentId]: isChecked
                    ? [...currentChildren, childId]
                    : currentChildren.filter((id) => id !== childId),
            };
        });
    };

    const isAllChildrenSelected = (parentId: string) => {
        const currentChildren = totalBatches[parentId]?.map((item) => item.id) || [];
        return (
            currentChildren.length > 0 &&
            currentChildren.every((id) => checkedState[parentId]?.includes(id))
        );
    };

    const getSelectedCount = (parentId: string) => {
        return checkedState[parentId]?.length || 0;
    };

    useEffect(() => {
        setValue('select_batch.batch_details', checkedState);
    }, [checkedState, setValue, selectedSection]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <span>{getTerminology(ContentTerms.Session, SystemTerms.Session)}</span>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger className="h-9 w-[200px] rounded-lg border-neutral-200 bg-white text-sm font-medium shadow-sm">
                        <SelectValue placeholder="Select Section" />
                    </SelectTrigger>
                    <SelectContent>
                        {sectionsInfo?.map((section) => (
                            <SelectItem key={section.id} value={section.id}>
                                {convertCapitalToTitleCase(section.name)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(totalBatches).map(([batchName, packages]) => {
                    const selectedCount = getSelectedCount(batchName);
                    const totalCount = packages.length;
                    const allSelected = isAllChildrenSelected(batchName);
                    return (
                        <div
                            key={batchName}
                            className={cn(
                                'flex flex-col gap-3 rounded-xl border p-4 transition-all',
                                allSelected
                                    ? 'border-primary-400 bg-primary-50/40 shadow-sm ring-1 ring-primary-200'
                                    : selectedCount > 0
                                      ? 'border-primary-200 bg-white shadow-sm'
                                      : 'border-neutral-200 bg-white hover:border-primary-200 hover:shadow-sm'
                            )}
                        >
                            <label className="flex cursor-pointer items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={(isChecked) =>
                                            handleParentToggle(batchName, !!isChecked)
                                        }
                                        className={cn(
                                            'size-4 rounded-sm border-2 shadow-none',
                                            allSelected &&
                                                'border-none bg-primary-500 text-white'
                                        )}
                                    />
                                    <span className="text-sm font-semibold text-neutral-800">
                                        {batchName}
                                    </span>
                                </div>
                                {selectedCount > 0 && (
                                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-600">
                                        {selectedCount}/{totalCount}
                                    </span>
                                )}
                            </label>
                            {packages.length > 0 && (
                                <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
                                    {packages.map((pkg) => {
                                        const checked =
                                            checkedState[batchName]?.includes(pkg.id) ?? false;
                                        return (
                                            <label
                                                key={pkg.id}
                                                className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-neutral-50"
                                            >
                                                <Checkbox
                                                    checked={checked}
                                                    onCheckedChange={(isChecked) =>
                                                        handleChildToggle(
                                                            batchName,
                                                            pkg.id,
                                                            !!isChecked
                                                        )
                                                    }
                                                    className={cn(
                                                        'size-4 rounded-sm border-2 shadow-none',
                                                        checked &&
                                                            'border-none bg-primary-500 text-white'
                                                    )}
                                                />
                                                <span className="text-sm text-neutral-600">
                                                    {pkg.name}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
