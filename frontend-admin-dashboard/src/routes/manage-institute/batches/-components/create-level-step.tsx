// CreateLevelStep.tsx
import { AddLevelInput } from '@/components/design-system/add-level-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useEffect, useState } from 'react';
import { MyDropdown } from '@/components/common/students/enroll-manually/dropdownForPackageItems';
import { useFormContext } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { X } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';

export const CreateLevelStep = () => {
    const { getLevelsFromPackage, instituteDetails, getSessionFromPackage } =
        useInstituteDetailsStore();
    const [newLevelName, setNewLevelName] = useState('');
    const [newLevelDuration, setNewLevelDuration] = useState<number | null>(null);
    const [newLevelAdded, setNewLevelAdded] = useState(false);
    const [levelList, setLevelList] =
        useState<Array<{ id: string; name: string }>>(getLevelsFromPackage());
    const [sessionList, setSessionList] = useState<Array<{ id: string; name: string }>>([]);
    const form = useFormContext();
    const { watch } = form;

    useEffect(() => {
        const allLevels = getLevelsFromPackage();
        //pass the selected courseId and sessionId
        const levelToRemove = getLevelsFromPackage({
            courseId: form.watch('selectedCourse')?.id || '',
            sessionId: form.watch('selectedSession')?.id || '',
        });
        const requiredLevelList = allLevels.filter((level) => level.id != levelToRemove[0]?.id);
        setLevelList(requiredLevelList);
    }, [instituteDetails, form.watch('selectedCourse'), form.watch('selectedSession')]);

    useEffect(() => {
        // Get all sessions except the currently selected one
        const allSessions = getSessionFromPackage({
            courseId: form.watch('selectedCourse')?.id,
            levelId: form.watch('selectedLevel')?.id,
        });
        const filteredSessions = allSessions.filter(
            (session) => session.id !== form.watch('selectedSession')?.id
        );
        setSessionList(filteredSessions);
    }, [form.watch('selectedCourse'), form.watch('selectedSession')]);

    const handleAddLevel = (levelName: string, durationInDays: number | null) => {
        setNewLevelName(levelName);
        setNewLevelDuration(durationInDays);
        setNewLevelAdded(true);
    };

    useEffect(() => {
        if (watch('levelCreationType') === 'new') {
            form.setValue('selectedLevel', { id: '', name: newLevelName });
            form.setValue('selectedLevelDuration', newLevelDuration);
        }
    }, [watch('levelCreationType'), newLevelName, newLevelDuration]);

    useEffect(() => {
        if (levelList.length === 0) {
            form.setValue('levelCreationType', 'new');
        }
    }, [levelList, form]);

    const shouldShowDuplicateOption =
        watch('courseCreationType') !== 'new' &&
        watch('levelCreationType') !== 'new' &&
        sessionList.length > 0;

    return (
        <div className="flex flex-col gap-6">
            <FormField
                control={form.control}
                name="levelCreationType"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel className="text-base font-medium text-neutral-700">
                            {getTerminology(ContentTerms.Level, SystemTerms.Level)} Selection
                        </FormLabel>
                        <FormControl>
                            <RadioGroup
                                className="flex gap-6 pt-1"
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    form.setValue('selectedLevel', null); // Reset dependent field
                                    form.setValue('selectedLevelDuration', null);
                                    setNewLevelAdded(false); // Reset new level state
                                    setNewLevelName('');
                                    setNewLevelDuration(null);
                                }}
                                value={field.value}
                            >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem
                                            value="existing"
                                            id="existing-level"
                                            disabled={levelList.length === 0}
                                        />
                                    </FormControl>
                                    <FormLabel
                                        htmlFor="existing-level"
                                        className={`cursor-pointer font-normal ${levelList.length === 0 ? 'text-neutral-400' : 'text-neutral-600'}`}
                                    >
                                        Select existing{' '}
                                        {getTerminology(ContentTerms.Level, SystemTerms.Level)}
                                    </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="new" id="new-level" />
                                    </FormControl>
                                    <FormLabel
                                        htmlFor="new-level"
                                        className="cursor-pointer font-normal text-neutral-600"
                                    >
                                        Create new{' '}
                                        {getTerminology(ContentTerms.Level, SystemTerms.Level)}
                                    </FormLabel>
                                </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {form.watch('levelCreationType') === 'existing' && (
                <FormField
                    control={form.control}
                    name="selectedLevel"
                    rules={{ required: 'Please select a level' }}
                    render={({ field }) => (
                        <FormItem className="flex flex-col gap-1.5">
                            <FormLabel className="text-neutral-700">
                                {getTerminology(ContentTerms.Level, SystemTerms.Level)}{' '}
                                <span className="text-danger-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <MyDropdown
                                    currentValue={field.value}
                                    dropdownList={levelList}
                                    handleChange={field.onChange}
                                    placeholder={`Select a ${getTerminology(
                                        ContentTerms.Level,
                                        SystemTerms.Level
                                    ).toLocaleLowerCase()}`}
                                    disable={levelList.length === 0}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            {form.watch('levelCreationType') === 'new' &&
                (newLevelAdded ? (
                    <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <div className="flex grow flex-col">
                            <p className="text-sm font-medium text-neutral-700">{newLevelName}</p>
                            {newLevelDuration && (
                                <p className="text-xs text-neutral-500">
                                    Duration: {newLevelDuration} days
                                </p>
                            )}
                        </div>
                        <MyButton
                            onClick={() => {
                                setNewLevelName('');
                                setNewLevelDuration(null);
                                setNewLevelAdded(false);
                                form.setValue('selectedLevel', null);
                                form.setValue('selectedLevelDuration', null);
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
                    <AddLevelInput
                        newLevelName={newLevelName}
                        setNewLevelName={setNewLevelName}
                        newLevelDuration={newLevelDuration}
                        setNewLevelDuration={setNewLevelDuration}
                        handleAddLevel={handleAddLevel}
                        batchCreation={true}
                    />
                ))}

            {shouldShowDuplicateOption && (
                <div className="mt-4 border-t border-neutral-200 pt-4">
                    <FormField
                        control={form.control}
                        name="duplicateStudyMaterials"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 py-1">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={(checked) => {
                                            field.onChange(checked);
                                            if (!checked) {
                                                form.setValue('selectedDuplicateSession', null);
                                            }
                                        }}
                                        id="duplicate-materials"
                                    />
                                </FormControl>
                                <FormLabel
                                    htmlFor="duplicate-materials"
                                    className="cursor-pointer text-sm font-normal text-neutral-700"
                                >
                                    Duplicate study materials from a pre-existing{' '}
                                    {getTerminology(
                                        ContentTerms.Session,
                                        SystemTerms.Session
                                    ).toLocaleLowerCase()}
                                </FormLabel>
                            </FormItem>
                        )}
                    />

                    {form.watch('duplicateStudyMaterials') && (
                        <FormField
                            control={form.control}
                            name="selectedDuplicateSession"
                            rules={{ required: 'Please select a session to duplicate from' }}
                            render={({ field }) => (
                                <FormItem className="mt-3 flex flex-col gap-1.5">
                                    <FormLabel className="text-neutral-700">
                                        Duplicate from{' '}
                                        {getTerminology(
                                            ContentTerms.Session,
                                            SystemTerms.Session
                                        ).toLocaleLowerCase()}{' '}
                                        <span className="text-danger-500">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <MyDropdown
                                            currentValue={field.value}
                                            dropdownList={sessionList}
                                            handleChange={field.onChange}
                                            placeholder={`Select ${getTerminology(
                                                ContentTerms.Session,
                                                SystemTerms.Session
                                            ).toLocaleLowerCase()} for duplication`}
                                            disable={sessionList.length === 0}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                </div>
            )}
        </div>
    );
};
