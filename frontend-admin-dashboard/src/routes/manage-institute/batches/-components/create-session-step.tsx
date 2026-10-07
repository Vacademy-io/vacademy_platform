// CreateSessionStep.tsx
import { AddSessionInput } from '@/components/design-system/add-session-input';
import { BatchItemSelect } from './batch-item-select';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { RadioGroup } from '@/components/ui/radio-group';
import { ChoiceCard } from './choice-card';

import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
// import { Session } from '@/components/common/study-library/add-course/add-course-form';
import { MyButton } from '@/components/design-system/button';
import { CalendarCheck, Plus, X } from '@phosphor-icons/react';
import { Session } from '@/components/common/study-library/add-course/add-course-form';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export const CreateSessionStep = () => {
    const { t } = useTranslation('manageInstituteCreateSessionStep');
    const [newSessionName, setNewSessionName] = useState('');
    const [newSessionStartDate, setNewSessionStartDate] = useState('');
    const form = useFormContext();
    const { watch } = form;
    const { getSessionFromPackage, instituteDetails } = useInstituteDetailsStore();
    const selectedCourseId = watch('selectedCourse')?.id;

    /**
     * The chosen course's existing sessions.
     *
     * Loading these never happened: sessionList started empty and only ever grew
     * when the user added one, so "select existing" was a dead, disabled dropdown
     * for every course — including courses that do have sessions.
     *
     * Seeded in the initializer rather than from an effect, because the
     * auto-switch below reads it on the FIRST render. With an effect, every
     * course looked session-less for one render and got switched to "create new"
     * before its sessions ever arrived.
     */
    const sessionsForCourse = (courseId?: string): Session[] =>
        courseId ? (getSessionFromPackage({ courseId }) as unknown as Session[]) : [];
    const [sessionList, setSessionList] = useState<Session[]>(() =>
        sessionsForCourse(selectedCourseId)
    );

    useEffect(() => {
        setSessionList(sessionsForCourse(selectedCourseId));
    }, [selectedCourseId, instituteDetails]);

    /**
     * A course with no sessions yet can only go one way, so go there instead of
     * leaving the user on an empty picker wondering what to click.
     */
    useEffect(() => {
        if (sessionList.length === 0 && watch('sessionCreationType') === 'existing') {
            form.setValue('sessionCreationType', 'new');
        }
    }, [sessionList.length]);

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

    const sessionTerm = getTerminology(ContentTerms.Session, SystemTerms.Session);
    const sessionLower = sessionTerm.toLocaleLowerCase();

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <p className="text-title font-semibold text-neutral-800">
                    {t('title', { session: sessionTerm })}
                </p>
                <p className="text-body text-neutral-500">
                    {t('subtitle', { session: sessionLower })}
                </p>
            </div>

            <FormField
                control={form.control}
                name="sessionCreationType"
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <RadioGroup
                                className="grid gap-4 md:grid-cols-2"
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    form.setValue('selectedSession', null); // Reset dependent field
                                    form.setValue('selectedStartDate', null);
                                }}
                                value={field.value}
                            >
                                {/* Nothing to select when the course has no sessions —
                                    matching how the course step disables its own
                                    "existing" option on an empty list. */}
                                <ChoiceCard
                                    id="existing-session"
                                    value="existing"
                                    selected={field.value === 'existing'}
                                    disabled={sessionList.length === 0}
                                    icon={<CalendarCheck size={22} />}
                                    iconClassName="bg-primary-50 text-primary-500"
                                    title={t('selectExisting', { session: sessionLower })}
                                    description={t('selectExistingHint', {
                                        session: sessionLower,
                                    })}
                                />
                                <ChoiceCard
                                    id="new-session"
                                    value="new"
                                    selected={field.value === 'new'}
                                    icon={<Plus size={22} />}
                                    iconClassName="bg-success-50 text-success-600"
                                    title={t('createNew', { session: sessionLower })}
                                    description={t('createNewHint', { session: sessionLower })}
                                />
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
                    rules={{ required: t('validation.selectSession') }}
                    render={({ field }) => (
                        <FormItem className="flex flex-col gap-1.5">
                            <FormLabel className="text-subtitle font-semibold text-neutral-700">
                                {getTerminology(ContentTerms.Session, SystemTerms.Session)}{' '}
                                <span className="text-danger-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <BatchItemSelect
                                    items={sessionList.map((session) => ({
                                        id: session.id,
                                        name: session.name,
                                    }))}
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder={t('selectPlaceholder', {
                                        session: getTerminology(
                                            ContentTerms.Session,
                                            SystemTerms.Session
                                        ).toLocaleLowerCase(),
                                    })}
                                    searchPlaceholder={t('searchPlaceholder', {
                                        session: getTerminology(
                                            ContentTerms.Session,
                                            SystemTerms.Session
                                        ).toLocaleLowerCase(),
                                    })}
                                    emptyMessage={t('emptyForCourse', {
                                        session: getTerminology(
                                            ContentTerms.Session,
                                            SystemTerms.Session
                                        ).toLocaleLowerCase(),
                                    })}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            {form.watch('sessionCreationType') === 'new' &&
                (newSessionName !== '' && newSessionStartDate !== '' ? (
                    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                        <div className="flex grow flex-col">
                            <p className="text-sm font-medium text-neutral-700">{newSessionName}</p>
                            <p className="text-xs text-neutral-500">
                                {t('startDate', { date: newSessionStartDate })}
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
