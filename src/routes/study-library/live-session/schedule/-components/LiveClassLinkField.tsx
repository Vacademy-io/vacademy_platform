import { useState } from 'react';
import { MyInput } from '@/components/design-system/input';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Calendar, Repeat, CalendarDays, RefreshCw } from 'lucide-react';

type RecurrenceScope = 'ONLY_THIS' | 'ALL_FUTURE' | 'CURRENT_DAY_ALL_SESSIONS' | 'ALL_FUTURE_ALL_SESSIONS';

interface LiveClassLinkFieldProps {
    value: string;
    onChange: (value: string) => void;
    onApplyWithScope: (scope: RecurrenceScope) => void;
    isEdit: boolean;
    dayName?: string;
}

export const LiveClassLinkField = ({ value, onChange, onApplyWithScope, isEdit, dayName = 'this day' }: LiveClassLinkFieldProps) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedScope, setSelectedScope] = useState<RecurrenceScope | null>(null);

    const handleApplyClick = () => {
        setIsDialogOpen(true);
    };

    const handleConfirm = () => {
        if (selectedScope) {
            onApplyWithScope(selectedScope);
            setIsDialogOpen(false);
        }
    };

    return (
        <div className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
                <MyInput
                    inputType="text"
                    inputPlaceholder="Enter live class URL"
                    input={value}
                    onChangeFunction={(e) => onChange(e.target.value)}
                    className="w-full"
                />
            </div>
            {isEdit && (
                <MyButton
                    type="button"
                    buttonType="primary"
                    onClick={handleApplyClick}
                    className="h-10 px-4"
                >
                    Apply
                </MyButton>
            )}

            <MyDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                heading="Where do you want to apply this new link?"
                className="w-[600px]"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Option 1: Only This Session */}
                        <div
                            className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:bg-gray-50 ${selectedScope === 'ONLY_THIS' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
                            onClick={() => setSelectedScope('ONLY_THIS')}
                        >
                            <div className="flex items-start gap-3">
                                <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                                    <Calendar className="size-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Only This Session</h3>
                                    <p className="mt-1 text-sm text-gray-500">Apply the new link only for this particular session</p>
                                    <p className="mt-2 text-xs font-medium text-gray-400">Example: Only this {dayName} session will have the new link</p>
                                </div>
                            </div>
                        </div>

                        {/* Option 2: Current Day All Sessions */}
                        <div
                            className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:bg-gray-50 ${selectedScope === 'CURRENT_DAY_ALL_SESSIONS' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
                            onClick={() => setSelectedScope('CURRENT_DAY_ALL_SESSIONS')}
                        >
                            <div className="flex items-start gap-3">
                                <div className="rounded-full bg-green-100 p-2 text-green-600">
                                    <CalendarDays className="size-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Current {dayName} All Sessions</h3>
                                    <p className="mt-1 text-sm text-gray-500">Apply the new link for all sessions on this {dayName}</p>
                                    <p className="mt-2 text-xs font-medium text-gray-400">Example: All sessions on this {dayName} will have the new link</p>
                                </div>
                            </div>
                        </div>

                        {/* Option 3: All Upcoming Sessions (same time slot) */}
                        <div
                            className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:bg-gray-50 ${selectedScope === 'ALL_FUTURE' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
                            onClick={() => setSelectedScope('ALL_FUTURE')}
                        >
                            <div className="flex items-start gap-3">
                                <div className="rounded-full bg-purple-100 p-2 text-purple-600">
                                    <Repeat className="size-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">All Upcoming Sessions</h3>
                                    <p className="mt-1 text-sm text-gray-500">Apply the new link for today and all future sessions at this time slot</p>
                                    <p className="mt-2 text-xs font-medium text-gray-400">Example: All upcoming {dayName}s at this session time will have the new link</p>
                                </div>
                            </div>
                        </div>

                        {/* Option 4: All Upcoming Days All Sessions */}
                        <div
                            className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:bg-gray-50 ${selectedScope === 'ALL_FUTURE_ALL_SESSIONS' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
                            onClick={() => setSelectedScope('ALL_FUTURE_ALL_SESSIONS')}
                        >
                            <div className="flex items-start gap-3">
                                <div className="rounded-full bg-orange-100 p-2 text-orange-600">
                                    <RefreshCw className="size-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Upcoming {dayName}s All Sessions</h3>
                                    <p className="mt-1 text-sm text-gray-500">Apply the new link for all sessions on all upcoming {dayName}s</p>
                                    <p className="mt-2 text-xs font-medium text-gray-400">Example: All sessions on every future {dayName} will have the new link</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <MyButton
                            buttonType="secondary"
                            onClick={() => setIsDialogOpen(false)}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            onClick={handleConfirm}
                            disable={!selectedScope}
                        >
                            Confirm & Apply
                        </MyButton>
                    </div>
                </div>
            </MyDialog>
        </div>
    );
};
