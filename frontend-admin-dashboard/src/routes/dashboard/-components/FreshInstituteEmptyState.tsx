import { useNavigate } from '@tanstack/react-router';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Circle, ArrowRight } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';

interface FreshInstituteEmptyStateProps {
    studentCount: number;
    batchCount: number;
    courseCount: number;
    levelCount: number;
    profileCompletionPercentage: number;
    onEditProfile?: () => void;
}

interface ChecklistItem {
    label: string;
    description: string;
    done: boolean;
    cta: { label: string; to?: string; onClick?: () => void };
}

export default function FreshInstituteEmptyState({
    studentCount,
    batchCount,
    courseCount,
    levelCount,
    profileCompletionPercentage,
    onEditProfile,
}: FreshInstituteEmptyStateProps) {
    const navigate = useNavigate();

    const items: ChecklistItem[] = [
        {
            label: 'Complete your institute profile',
            description: 'Add branding, contact, and basic details.',
            done: profileCompletionPercentage >= 100,
            cta: { label: 'Edit profile', onClick: onEditProfile },
        },
        {
            label: 'Create your first level',
            description: 'Set up the levels your institute teaches.',
            done: levelCount > 0,
            cta: { label: 'Add level', to: '/manage-institute' },
        },
        {
            label: 'Create your first course',
            description: 'Add a course so you can enroll learners.',
            done: courseCount > 0,
            cta: { label: 'Add course', to: '/study-library/courses' },
        },
        {
            label: 'Create your first batch',
            description: 'Group learners into a batch with a session.',
            done: batchCount > 0,
            cta: { label: 'Add batch', to: '/manage-institute' },
        },
        {
            label: 'Invite your first learner',
            description: 'Send an invite or enroll a student manually.',
            done: studentCount > 0,
            cta: { label: 'Add learner', to: '/manage-students' },
        },
    ];

    const completed = items.filter((i) => i.done).length;
    const total = items.length;

    return (
        <Card className="grow border-primary-200 bg-gradient-to-br from-primary-50/60 to-white shadow-none">
            <CardHeader className="p-4">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <CardTitle className="text-sm font-semibold">
                            Welcome — let&apos;s get your institute set up
                        </CardTitle>
                        <CardDescription className="mt-0.5 text-[11px] text-neutral-600 sm:text-xs">
                            Knock these out and your dashboard fills in automatically.
                        </CardDescription>
                    </div>
                    <span className="shrink-0 rounded-full border border-primary-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                        {completed} / {total}
                    </span>
                </div>
            </CardHeader>
            <ol className="space-y-1 px-3 pb-4">
                {items.map((item, i) => (
                    <li
                        key={item.label}
                        className="flex items-center gap-3 rounded-md p-2 hover:bg-white/60"
                    >
                        {item.done ? (
                            <CheckCircle
                                size={18}
                                weight="fill"
                                className="shrink-0 text-emerald-500"
                            />
                        ) : (
                            <Circle size={18} className="shrink-0 text-neutral-300" />
                        )}
                        <div className="flex flex-1 flex-col">
                            <span
                                className={`text-xs font-medium ${
                                    item.done ? 'text-neutral-400 line-through' : 'text-neutral-800'
                                }`}
                            >
                                {i + 1}. {item.label}
                            </span>
                            {!item.done && (
                                <span className="text-[11px] text-neutral-500">
                                    {item.description}
                                </span>
                            )}
                        </div>
                        {!item.done && (
                            <MyButton
                                type="button"
                                scale="small"
                                buttonType="secondary"
                                onClick={() => {
                                    if (item.cta.onClick) item.cta.onClick();
                                    else if (item.cta.to) navigate({ to: item.cta.to });
                                }}
                                className="shrink-0 text-xs"
                            >
                                {item.cta.label}
                                <ArrowRight size={12} className="ml-1" />
                            </MyButton>
                        )}
                    </li>
                ))}
            </ol>
        </Card>
    );
}
