import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useQueryDialogStore, QueryDialogTab } from '@/stores/useQueryDialogStore';
import { useDoubtManagementSetting } from '@/services/doubt-management-settings';
import { MY_QUERIES_QUERY_KEY } from '@/services/my-queries';
import { MyQueriesList } from './MyQueriesList';
import { useAddDoubt } from '@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/doubt-resolution-sidebar/services/AddDoubt';
import {
    DoubtType,
    StudentDetailsType,
} from '@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/doubt-resolution-sidebar/types/add-doubt-type';
import { getFromStorage } from '@/components/common/auth/login/forms/page/login-form';
import { getPackageSessionId } from '@/utils/study-library/get-list-from-stores/getPackageSessionId';

/**
 * Global "Help & Queries" dialog with two tabs: raise a typed general query (source="GENERAL"),
 * and see your past doubts/queries with staff replies. Opened from the top-bar "?" icon or the
 * dashboard card via useQueryDialogStore (which can pre-select a tab).
 */
export const QueryDialog = () => {
    const { isOpen, initialTab, close } = useQueryDialogStore();
    const { selectableTypes } = useDoubtManagementSetting();
    const addDoubt = useAddDoubt();
    const queryClient = useQueryClient();

    const [selectedType, setSelectedType] = useState<string>('');
    const [text, setText] = useState('');
    const [activeTab, setActiveTab] = useState<QueryDialogTab>('raise');

    const types = useMemo(() => selectableTypes, [selectableTypes]);

    // Land on the caller-requested tab each time the dialog opens.
    useEffect(() => {
        if (isOpen) setActiveTab(initialTab);
    }, [isOpen, initialTab]);

    // Default to the first selectable type whenever the list resolves or the dialog opens.
    useEffect(() => {
        if (isOpen && !selectedType && types.length > 0) {
            setSelectedType(types[0]!.key);
        }
    }, [isOpen, types, selectedType]);

    const reset = () => {
        setText('');
        setSelectedType('');
    };

    const handleSubmit = async () => {
        if (!selectedType) {
            toast.error('Please choose a query type');
            return;
        }
        if (!text.trim()) {
            toast.error('Please describe your query');
            return;
        }

        const studentDetailsRaw = await getFromStorage('StudentDetails');
        const student: StudentDetailsType = JSON.parse(studentDetailsRaw || '{}');
        const packageSessionId = await getPackageSessionId();

        const doubtData: DoubtType = {
            user_id: student.user_id,
            name: student.full_name,
            source: 'GENERAL',
            source_id: '',
            type: selectedType,
            institute_id: student.institute_id,
            raised_time: new Date().toISOString(),
            resolved_time: null,
            content_position: null,
            content_type: '',
            html_text: text,
            status: 'ACTIVE',
            parent_id: null,
            parent_level: 0,
            doubt_assignee_request_user_ids: [],
            batch_id: packageSessionId || '',
        };

        addDoubt.mutate(doubtData, {
            onSuccess: () => {
                toast.success('Your query has been submitted');
                // AddDoubt only invalidates GET_DOUBTS (slide sidebar); refresh My queries too.
                queryClient.invalidateQueries({ queryKey: MY_QUERIES_QUERY_KEY });
                reset();
                setActiveTab('my-queries');
            },
            onError: () => {
                toast.error('Could not submit your query. Please try again.');
            },
        });
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    reset();
                    close();
                }
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Help &amp; Queries</DialogTitle>
                    <DialogDescription>
                        Raise a doubt, technical problem, or payment question — and track replies
                        from your institute here.
                    </DialogDescription>
                </DialogHeader>

                <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as QueryDialogTab)}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="raise">Raise a query</TabsTrigger>
                        <TabsTrigger value="my-queries">My queries</TabsTrigger>
                    </TabsList>

                    <TabsContent value="raise">
                        <div className="flex flex-col gap-4 py-2">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-caption font-medium text-neutral-600">
                                    Query type
                                </label>
                                <Select value={selectedType} onValueChange={setSelectedType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {types.map((t) => (
                                            <SelectItem key={t.key} value={t.key}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-caption font-medium text-neutral-600">
                                    Details
                                </label>
                                <Textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Describe your query in a few words…"
                                    rows={5}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <MyButton
                                buttonType="secondary"
                                scale="medium"
                                onClick={() => {
                                    reset();
                                    close();
                                }}
                            >
                                Cancel
                            </MyButton>
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                onClick={handleSubmit}
                                disable={addDoubt.isPending || !text.trim() || !selectedType}
                            >
                                {addDoubt.isPending ? 'Submitting…' : 'Submit'}
                            </MyButton>
                        </div>
                    </TabsContent>

                    <TabsContent value="my-queries">
                        <div className="py-2">
                            <MyQueriesList />
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
