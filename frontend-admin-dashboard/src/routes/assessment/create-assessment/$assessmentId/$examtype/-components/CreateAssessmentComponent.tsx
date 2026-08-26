import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useEffect, useState } from 'react';
import { MainStepComponent } from './StepComponents/MainStepComponent';
import { Check, Info, FileText, ListChecks, Users, ShieldCheck } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Route } from '..';
import { useNavigate } from '@tanstack/react-router';
import { useFilterDataForAssesment } from '@/routes/assessment/assessment-list/-utils.ts/useFiltersData';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { NoCourseDialog } from '@/components/common/students/no-course-dialog';

interface StepDef {
    label: string;
    description: string;
    id: string;
    icon: React.ComponentType<{ className?: string }>;
}

interface CreateAssessmentSidebarProps {
    steps: StepDef[];
    currentStep: number;
    completedSteps: boolean[];
    onStepClick: (index: number) => void;
}

const CreateAssessmentSidebar: React.FC<CreateAssessmentSidebarProps> = ({
    steps,
    currentStep,
    completedSteps,
    onStepClick,
}) => {
    const { open } = useSidebar();

    return (
        <div className="flex flex-col gap-1.5 px-3 py-4">
            {steps.map((step, index) => {
                const isActive = currentStep === index;
                const isCompleted = completedSteps[index];
                const isReachable = index <= currentStep || completedSteps[index - 1];
                const StepIcon = step.icon;

                return (
                    <button
                        key={step.id}
                        type="button"
                        id={step.id}
                        onClick={() => onStepClick(index)}
                        disabled={!isReachable}
                        className={cn(
                            'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                            isActive && 'bg-primary-50 shadow-sm ring-1 ring-primary-200',
                            !isActive && isReachable && 'hover:bg-slate-100',
                            !isReachable && 'cursor-not-allowed opacity-60'
                        )}
                    >
                        {/* Step indicator circle */}
                        <div
                            className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                                isActive &&
                                    'border-primary-500 bg-primary-500 text-white shadow-md shadow-primary-500/20',
                                isCompleted &&
                                    !isActive &&
                                    'border-emerald-500 bg-emerald-500 text-white',
                                !isActive &&
                                    !isCompleted &&
                                    isReachable &&
                                    'border-slate-300 bg-white text-slate-600 group-hover:border-primary-300 group-hover:text-primary-600',
                                !isActive &&
                                    !isCompleted &&
                                    !isReachable &&
                                    'border-slate-200 bg-slate-50 text-slate-400'
                            )}
                        >
                            {isCompleted && !isActive ? (
                                <Check className="h-4 w-4" strokeWidth={3} />
                            ) : (
                                <StepIcon className="h-4 w-4" />
                            )}
                        </div>

                        {/* Label + description (only when sidebar is expanded) */}
                        {open && (
                            <div className="flex min-w-0 flex-1 flex-col">
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className={cn(
                                            'text-[11px] font-semibold uppercase tracking-wider',
                                            isActive ? 'text-primary-600' : 'text-slate-400'
                                        )}
                                    >
                                        Step {index + 1}
                                    </span>
                                    {isCompleted && !isActive && (
                                        <span className="text-[10px] font-medium text-emerald-600">
                                            · Done
                                        </span>
                                    )}
                                </div>
                                <span
                                    className={cn(
                                        'truncate text-sm font-semibold',
                                        isActive ? 'text-primary-700' : 'text-slate-900'
                                    )}
                                >
                                    {step.label}
                                </span>
                                <span className="truncate text-[11px] text-slate-500">
                                    {step.description}
                                </span>
                            </div>
                        )}

                        {/* Connector line to next step */}
                        {index < steps.length - 1 && open && (
                            <span
                                aria-hidden
                                className={cn(
                                    'absolute left-[1.92rem] top-[3.25rem] h-3 w-0.5 rounded-full',
                                    isCompleted ? 'bg-emerald-400' : 'bg-slate-200'
                                )}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

const CreateAssessmentComponent = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const { assessmentId, examtype } = Route.useParams();
    const { currentStep: presentStep } = Route.useSearch();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const { SubjectFilterData } = useFilterDataForAssesment(instituteDetails);

    const examTypeLabel: Record<string, string> = {
        EXAM: 'Examination',
        MOCK: 'Mock Assessment',
        PRACTICE: 'Practice Assessment',
        SURVEY: 'Survey',
        MANUAL_UPLOAD_EXAM: 'Manual Upload Exam',
    };

    const steps: StepDef[] = [
        {
            label: 'Basic Info',
            description: 'Name, schedule, and settings',
            id: 'basic-info',
            icon: Info,
        },
        {
            label: 'Add Questions',
            description: 'Upload or create questions',
            id: 'add-question',
            icon: FileText,
        },
        {
            label: 'Add Participants',
            description: 'Choose who can take this',
            id: 'add-participants',
            icon: Users,
        },
        {
            label: 'Access Control',
            description: 'Permissions for managing',
            id: 'access-control',
            icon: ShieldCheck,
        },
    ];
    const [currentStep, setCurrentStep] = useState(presentStep);
    const [completedSteps, setCompletedSteps] = useState([false, false, false, false]);
    /** Keep ?currentStep in step with the wizard, so a refresh lands where the user was. */
    const syncStepToUrl = (step: number) => {
        navigate({
            to: '/assessment/create-assessment/$assessmentId/$examtype',
            params: {
                assessmentId: assessmentId,
                examtype: examtype,
            },
            search: {
                currentStep: step,
            },
        });
    };

    const completeCurrentStep = () => {
        setCompletedSteps((prev) => {
            const updated = [...prev];
            updated[currentStep] = true;
            return updated;
        });
        if (currentStep < steps.length - 1) {
            const nextStep = currentStep + 1;
            setCurrentStep(nextStep);
            // The URL used to be written with the PRE-increment value, inside a setter
            // that had already advanced — so ?currentStep was permanently one behind, and
            // since it is only read at mount, a refresh landed on the wrong step.
            syncStepToUrl(nextStep);
        }
    };

    useEffect(() => {
        if (SubjectFilterData.length === 0) {
            setIsOpen(true);
        }
    }, []);

    const goToStep = (index: number) => {
        if (index <= currentStep || completedSteps[index - 1]) {
            setCurrentStep(index);
            // Sidebar navigation never touched the URL at all.
            syncStepToUrl(index);
        }
    };

    /*
     * Warn before the browser discards unsaved work.
     *
     * Each step keeps its edits in its own react-hook-form and only writes them to the
     * zustand store inside the mutation's onSuccess — so anything not yet submitted is
     * lost on a refresh or a back-navigation, silently. The wizard also holds
     * savedAssessmentId in memory, so a refresh mid-flow would leave steps 2-4 posting
     * against an empty assessment id.
     *
     * This is the browser-level guard only; in-app step switching keeps the forms mounted.
     */
    useEffect(() => {
        const warnOnUnload = (event: BeforeUnloadEvent) => {
            // Nothing to lose before the assessment exists or once it is fully done.
            if (currentStep === 0 && !completedSteps[0]) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warnOnUnload);
        return () => window.removeEventListener('beforeunload', warnOnUnload);
    }, [currentStep, completedSteps]);
    return (
        <LayoutContainer
            sidebarComponent={
                <CreateAssessmentSidebar
                    steps={steps}
                    currentStep={currentStep}
                    completedSteps={completedSteps}
                    onStepClick={goToStep}
                />
            }
        >
            <Helmet>
                <title>{examtype === 'SURVEY' ? 'Create Survey' : 'Create Assessment'}</title>
                <meta
                    name="description"
                    content={examtype === 'SURVEY' ? 'This page is for creating a survey for students via admin.' : 'This page is for creating an assessment for students via admin.'}
                />
            </Helmet>
            <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Badge className="bg-primary-500 font-medium text-white hover:bg-primary-500">
                            {examTypeLabel[examtype] || examtype}
                        </Badge>
                        <Badge
                            variant="secondary"
                            className="bg-slate-100 font-medium text-slate-600 hover:bg-slate-100"
                        >
                            Step {currentStep + 1} of {steps.length}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <ListChecks className="h-3.5 w-3.5" />
                        <span className="font-medium tabular-nums">
                            {completedSteps.filter(Boolean).length} / {steps.length} completed
                        </span>
                    </div>
                </div>
                {/* Progress bar */}
                <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500 ease-out"
                        style={{
                            width: `${((currentStep + 1) / steps.length) * 100}%`,
                        }}
                    />
                </div>
            </div>
            <MainStepComponent
                currentStep={currentStep}
                handleCompleteCurrentStep={completeCurrentStep}
                completedSteps={completedSteps}
            />
            <NoCourseDialog isOpen={isOpen} setIsOpen={setIsOpen} type={examtype === 'SURVEY' ? 'Create Survey' : 'Create Assessment'} />
        </LayoutContainer>
    );
};

export default CreateAssessmentComponent;
