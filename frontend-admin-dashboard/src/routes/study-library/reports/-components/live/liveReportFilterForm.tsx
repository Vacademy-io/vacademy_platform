import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { LevelType } from '@/schemas/student/student-list/institute-schema';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MyButton } from '@/components/design-system/button';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { convertCapitalToTitleCase } from '@/lib/utils';
import DateRangeFilter from '@/components/design-system/date-range-filter';
import { getInstituteId } from '@/constants/helper';
import { useLearnerDetails } from '../../-store/useLearnersDetails';

export interface AppliedLiveFilters {
    packageSessionId: string;
    startDate: string;
    endDate: string;
    courseName: string;
    batchLabel: string;
    userId?: string;
    learnerName?: string;
}

const buildSchema = (t: TFunction, withLearner: boolean) =>
    z
        .object({
            course: z.string().min(1, t('validation.courseRequired')),
            session: z.string().min(1, t('validation.sessionRequired')),
            level: z.string().min(1, t('validation.levelRequired')),
            startDate: z.string().min(1, t('validation.startDateRequired')),
            endDate: z.string().min(1, t('validation.endDateRequired')),
            learner: withLearner
                ? z.string().min(1, t('validation.learnerRequired'))
                : z.string().optional(),
        })
        .refine(
            (data) => {
                const start = new Date(data.startDate);
                const end = new Date(data.endDate);
                const diffInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
                return diffInDays <= 31;
            },
            {
                message: t('validation.dateRangeWithinMonth'),
                path: ['startDate'],
            }
        );

interface Props {
    withLearner?: boolean;
    submitting?: boolean;
    onApply: (filters: AppliedLiveFilters) => void;
}

export default function LiveReportFilterForm({ withLearner = false, submitting = false, onApply }: Props) {
    const { t } = useTranslation('studyLibraryLiveReportFilterForm');
    const { getCourseFromPackage, getSessionFromPackage, getLevelsFromPackage2, getPackageSessionId } =
        useInstituteDetailsStore();
    const courseList = getCourseFromPackage();
    const [sessionList, setSessionList] = useState<{ id: string; name: string }[]>([]);
    const [levelList, setLevelList] = useState<LevelType[]>([]);
    const [defaultSessionLevels, setDefaultSessionLevels] = useState(false);

    type FormValues = z.infer<ReturnType<typeof buildSchema>>;
    const {
        handleSubmit,
        setValue,
        watch,
        clearErrors,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(buildSchema(t, withLearner)),
        defaultValues: { course: '', session: '', level: '', startDate: '', endDate: '', learner: '' },
    });

    const selectedCourse = watch('course');
    const selectedSession = watch('session');
    const selectedLevel = watch('level');
    const selectedLearner = watch('learner');

    const derivedPackageSessionId =
        selectedCourse && selectedSession && selectedLevel
            ? getPackageSessionId({
                  courseId: selectedCourse,
                  sessionId: selectedSession,
                  levelId: selectedLevel,
              }) || ''
            : '';

    const { data: learners } = useLearnerDetails(derivedPackageSessionId, getInstituteId() || '');

    useEffect(() => {
        if (selectedCourse) {
            setSessionList(getSessionFromPackage({ courseId: selectedCourse }));
            setValue('session', '');
        } else {
            setSessionList([]);
        }
    }, [selectedCourse]);

    useEffect(() => {
        if (!selectedSession) {
            setValue('level', '');
            setLevelList([]);
        } else if (selectedCourse && selectedSession) {
            setLevelList(getLevelsFromPackage2({ courseId: selectedCourse, sessionId: selectedSession }));
        }
    }, [selectedSession]);

    useEffect(() => {
        if (sessionList?.length === 1 && sessionList[0]?.id === 'DEFAULT') {
            setValue('session', 'DEFAULT');
            setValue('level', 'DEFAULT');
            setDefaultSessionLevels(true);
        } else {
            setDefaultSessionLevels(false);
            // Auto-select when the course has exactly one (real) session.
            const onlySession = sessionList?.length === 1 ? sessionList[0] : undefined;
            if (onlySession) {
                setValue('session', onlySession.id);
                clearErrors('session');
            }
        }
    }, [sessionList]);

    // Auto-select when the chosen session exposes exactly one level.
    useEffect(() => {
        const onlyLevel = levelList?.length === 1 ? levelList[0] : undefined;
        if (onlyLevel) {
            setValue('level', onlyLevel.id);
            clearErrors('level');
        }
    }, [levelList]);

    const onSubmit = (data: FormValues) => {
        const courseName = courseList.find((c) => c.id === data.course)?.name || '';
        const sessionName = sessionList.find((s) => s.id === data.session)?.name || '';
        const levelName = levelList.find((l) => l.id === data.level)?.level_name || '';
        const learnerName = learners?.find((l) => l.user_id === data.learner)?.full_name;
        const batchLabel = defaultSessionLevels
            ? ''
            : [sessionName, levelName].filter(Boolean).map(convertCapitalToTitleCase).join(' · ');
        onApply({
            packageSessionId: derivedPackageSessionId,
            startDate: data.startDate,
            endDate: data.endDate,
            courseName: convertCapitalToTitleCase(courseName),
            batchLabel,
            userId: withLearner ? data.learner : undefined,
            learnerName,
        });
    };

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <label className="mb-1 block text-caption font-medium text-neutral-700">
                            {getTerminology(ContentTerms.Course, SystemTerms.Course)}
                            <span className="ml-1 text-danger-600">*</span>
                        </label>
                        <SearchableSelect
                            options={courseList.map((course) => ({
                                label: convertCapitalToTitleCase(course.name),
                                value: course.id,
                            }))}
                            value={selectedCourse}
                            onChange={(value) => {
                                setValue('course', value);
                                clearErrors('course');
                            }}
                            placeholder={t('selectPlaceholder', {
                                term: getTerminology(ContentTerms.Course, SystemTerms.Course),
                            })}
                            searchPlaceholder={t('searchPlaceholder', {
                                term: getTerminology(ContentTerms.Course, SystemTerms.Course),
                            })}
                            triggerClassName="h-9 text-body"
                        />
                    </div>

                    {!defaultSessionLevels && (
                        <div>
                            <label className="mb-1 block text-caption font-medium text-neutral-700">
                                {getTerminology(ContentTerms.Session, SystemTerms.Session)}
                                <span className="ml-1 text-danger-600">*</span>
                            </label>
                            <Select
                                onValueChange={(value) => setValue('session', value)}
                                value={selectedSession}
                                disabled={!sessionList.length}
                            >
                                <SelectTrigger className="h-9 text-body">
                                    <SelectValue
                                        placeholder={t('selectPlaceholder', {
                                            term: getTerminology(
                                                ContentTerms.Session,
                                                SystemTerms.Session
                                            ),
                                        })}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {sessionList.map((session) => (
                                        <SelectItem key={session.id} value={session.id}>
                                            {convertCapitalToTitleCase(session.name)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {!defaultSessionLevels && (
                        <div>
                            <label className="mb-1 block text-caption font-medium text-neutral-700">
                                {getTerminology(ContentTerms.Level, SystemTerms.Level)}
                                <span className="ml-1 text-danger-600">*</span>
                            </label>
                            <Select
                                onValueChange={(value) => setValue('level', value)}
                                value={selectedLevel}
                                disabled={!levelList.length}
                            >
                                <SelectTrigger className="h-9 text-body">
                                    <SelectValue
                                        placeholder={t('selectPlaceholder', {
                                            term: getTerminology(
                                                ContentTerms.Level,
                                                SystemTerms.Level
                                            ),
                                        })}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {levelList.map((level) => (
                                        <SelectItem key={level.id} value={level.id}>
                                            {convertCapitalToTitleCase(level.level_name)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {withLearner && (
                    <div className="sm:w-1/3">
                        <label className="mb-1 block text-caption font-medium text-neutral-700">
                            {getTerminology(RoleTerms.Learner, SystemTerms.Learner)}
                            <span className="ml-1 text-danger-600">*</span>
                        </label>
                        <SearchableSelect
                            options={(learners ?? []).map((l) => ({
                                label: l.full_name,
                                value: l.user_id,
                            }))}
                            value={selectedLearner ?? ''}
                            onChange={(value) => {
                                setValue('learner', value);
                                clearErrors('learner');
                            }}
                            placeholder={t('selectPlaceholder', {
                                term: getTerminology(RoleTerms.Learner, SystemTerms.Learner),
                            })}
                            searchPlaceholder={t('searchPlaceholder', {
                                term: getTerminology(RoleTerms.Learner, SystemTerms.Learner),
                            })}
                            disabled={!derivedPackageSessionId || !learners?.length}
                            triggerClassName="h-9 text-body"
                        />
                    </div>
                )}

                <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <DateRangeFilter
                            onChange={(res) => {
                                if (res) {
                                    const [sDay, sMonth, sYear] = res.startDate.split('/');
                                    const [eDay, eMonth, eYear] = res.endDate.split('/');
                                    setValue('startDate', `${sYear}-${sMonth}-${sDay}`);
                                    setValue('endDate', `${eYear}-${eMonth}-${eDay}`);
                                    clearErrors('startDate');
                                    clearErrors('endDate');
                                } else {
                                    setValue('startDate', '');
                                    setValue('endDate', '');
                                }
                            }}
                        />
                    </div>
                    <div className="sm:mb-1">
                        <MyButton type="submit" buttonType="primary" className="h-9 px-4 text-body" disabled={submitting}>
                            {submitting ? t('loading') : t('generateReport')}
                        </MyButton>
                    </div>
                </div>

                {Object.keys(errors).length > 0 && (
                    <div className="rounded-md border border-danger-200 bg-danger-50 p-3">
                        <p className="mb-1 text-body font-medium text-danger-700">
                            {t('fixFollowing')}
                        </p>
                        <ul className="space-y-1">
                            {Object.entries(errors).map(([key, error]) => (
                                <li key={key} className="text-caption text-danger-600">
                                    • {error?.message as string}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </form>
        </div>
    );
}
