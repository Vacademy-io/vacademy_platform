import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
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
import { useQueryDialogStore } from '@/stores/useQueryDialogStore';
import { useDoubtManagementSetting } from '@/services/doubt-management-settings';
import { useAddDoubt } from '@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/doubt-resolution-sidebar/services/AddDoubt';
import {
    DoubtType,
    StudentDetailsType,
} from '@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/doubt-resolution-sidebar/types/add-doubt-type';
import { getFromStorage } from '@/components/common/auth/login/forms/page/login-form';
import { getPackageSessionId } from '@/utils/study-library/get-list-from-stores/getPackageSessionId';

/**
 * Global "Raise a query" dialog. Lets a learner submit a typed general query (Doubt / Technical
 * Issue / Payment Issue …) not anchored to any slide. Reuses the doubt create endpoint with
 * source="GENERAL". Opened from the top-bar "?" icon or the dashboard card via useQueryDialogStore.
 */
export const QueryDialog = () => {
    const { isOpen, close } = useQueryDialogStore();
    const { selectableTypes } = useDoubtManagementSetting();
    const addDoubt = useAddDoubt();

    const [selectedType, setSelectedType] = useState<string>('');
    const [text, setText] = useState('');

    const types = useMemo(() => selectableTypes, [selectableTypes]);

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
                reset();
                close();
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
                    <DialogTitle>Raise a query</DialogTitle>
                    <DialogDescription>
                        Have a doubt, a technical problem, or a payment question? Pick a category and
                        tell us — the right team will get back to you.
                    </DialogDescription>
                </DialogHeader>

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
                        <label className="text-caption font-medium text-neutral-600">Details</label>
                        <Textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Describe your query in a few words…"
                            rows={5}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2">
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
            </DialogContent>
        </Dialog>
    );
};
