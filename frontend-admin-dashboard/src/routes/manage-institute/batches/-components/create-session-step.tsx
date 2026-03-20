// CreateSessionStep.tsx
import { AddSessionInput } from '@/components/design-system/add-session-input';
import { MyDropdown } from '@/components/common/students/enroll-manually/dropdownForPackageItems';
import { RadioGroupItem, RadioGroup } from '@/components/ui/radio-group';

import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
// import { Session } from '@/components/common/study-library/add-course/add-course-form';
import { MyButton } from '@/components/design-system/button';
import { X } from '@phosphor-icons/react';
import { Session } from '@/components/common/study-library/add-course/add-course-form';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export const CreateSessionStep = () => {
    const [newSessionName, setNewSessionName] = useState('');
    const [newSessionStartDate, setNewSessionStartDate] = useState('');
    const form = useFormContext();
    const { watch } = form;
    const [sessionList, setSessionList] = useState<Session[]>([]);

    const handleAddSession = (sessionName: string, startDate: string) => {
        const newSession = {
            id: '',
            new_session: true,
            session_name: sessionName,
            status: 'INACTIVE',
            start_date: startDate,
            levels: [], // Initialize with empty levels array
        };
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        setSessionList((prevSessionList) => [...prevSessionList, newSession]);
        // Set the new session in the form's state
        form.setValue('selectedSession', { id: newSession.id, name: newSession.session_name });
    };

    useEffect(() => {
        if (watch('sessionCreationType') === 'new') {
            form.setValue('selectedSession', { id: '', name: newSessionName });
            form.setValue('selectedStartDate', newSessionStartDate);
        }
    }, [watch('sessionCreationType'), newSessionName, newSessionStartDate]);

    return (
        <div className="flex flex-col gap-6">
            <FormField
                control={form.control}
                name="sessionCreationType"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel className="text-base font-medium text-neutral-700">
                            {getTerminology(ContentTerms.Session, SystemTerms.Session)} Selection
                        </FormLabel>
                        <FormControl>
                            <RadioGroup
                                className="flex gap-6 pt-1"
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    form.setValue('selectedSession', null); // Reset dependent field
                                    form.setValue('selectedStartDate', null);
                                }}
                                value={field.value}
                            >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="existing" id="existing-session" />
                                    </FormControl>
                                    <FormLabel
                                        htmlFor="existing-session"
                                        className="cursor-pointer font-normal text-neutral-600"
                                    >
                                        Select existing{' '}
                                        {getTerminology(
                                            ContentTerms.Session,
                                            SystemTerms.Session
                                        ).toLocaleLowerCase()}
                                    </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="new" id="new-session" />
                                    </FormControl>
                                    <FormLabel
                                        htmlFor="new-session"
                                        className="cursor-pointer font-normal text-neutral-600"
                                    >
                                        Create new{' '}
                                        {getTerminology(
                                            ContentTerms.Session,
                                            SystemTerms.Session
                                        ).toLocaleLowerCase()}
                                    </FormLabel>
                                </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {form.watch('sessionCreationType') === 'existing' && (
                <FormField
                    control={form.control}
                    name="selectedSession"
                    rules={{ required: 'Please select a session' }}
                    render={({ field }) => (
                        <FormItem className="flex flex-col gap-1.5">
                            <FormLabel className="text-neutral-700">
                                {getTerminology(ContentTerms.Session, SystemTerms.Session)}{' '}
                                <span className="text-danger-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <MyDropdown
                                    currentValue={field.value}
                                    dropdownList={sessionList.map((session) => ({
                                        id: session.id,
                                        name: session.name,
                                    }))}
                                    handleChange={field.onChange}
                                    placeholder={`Select a ${getTerminology(
                                        ContentTerms.Session,
                                        SystemTerms.Session
                                    ).toLocaleLowerCase()}`}
                                    disable={sessionList.length === 0}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            {form.watch('sessionCreationType') === 'new' &&
                (newSessionName !== '' && newSessionStartDate !== '' ? (
                    <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <div className="flex grow flex-col">
                            <p className="text-sm font-medium text-neutral-700">{newSessionName}</p>
                            <p className="text-xs text-neutral-500">
                                Start Date: {newSessionStartDate}
                            </p>
                        </div>
                        <MyButton
                            onClick={() => {
                                setNewSessionName('');
                                setNewSessionStartDate('');
                                form.setValue('selectedSession', null);
                                form.setValue('selectedStartDate', null);
                            }}
                            layoutVariant="icon"
                            buttonType="text"
                            className="p-1 text-neutral-500 hover:bg-danger-50 hover:text-danger-600"
                            scale="small"
                        >
                            <X size={18} />
                        </MyButton>
                    </div>
                ) : (
                    <AddSessionInput
                        newSessionName={newSessionName}
                        setNewSessionName={setNewSessionName}
                        newSessionStartDate={newSessionStartDate}
                        setNewSessionStartDate={setNewSessionStartDate}
                        handleAddSession={handleAddSession}
                    />
                ))}
        </div>
    );
};
