import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { getWorkflowTemplatesQuery } from '@/services/workflow-service';
import { Wand, ArrowRight, ArrowLeft } from '@phosphor-icons/react';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    instituteId: string;
    onApplyTemplate: (templateJson: string, name: string) => void;
}

const GOALS = [
    { id: 'notifications', label: 'Send Notifications', icon: '\u{1F4E7}', description: 'Email, WhatsApp, or push notifications to learners' },
    { id: 'enrollments', label: 'Process Enrollments', icon: '\u{1F393}', description: 'Automate enrollment, onboarding, and credentials' },
    { id: 'reminders', label: 'Send Reminders', icon: '\u{23F0}', description: 'Payment reminders, due dates, follow-ups' },
    { id: 'reports', label: 'Generate Reports', icon: '\u{1F4CA}', description: 'Aggregate data and send summaries' },
    { id: 'custom', label: 'Custom Workflow', icon: '\u{1F527}', description: 'Start from scratch or pick any template' },
];

const GOAL_CATEGORIES: Record<string, string[]> = {
    notifications: ['Notification', 'Communication'],
    enrollments: ['Onboarding', 'Enrollment'],
    reminders: ['Reminder', 'Payment'],
    reports: ['Report', 'Analytics'],
    custom: [],
};

export function WorkflowWizard({ open, onOpenChange, instituteId, onApplyTemplate }: Props) {
    const [step, setStep] = useState(0);
    const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

    const { data: templates } = useQuery({
        ...getWorkflowTemplatesQuery(instituteId),
        enabled: open,
    });

    const filteredTemplates = templates?.filter((t) => {
        if (!selectedGoal || selectedGoal === 'custom') return true;
        const cats = GOAL_CATEGORIES[selectedGoal] ?? [];
        return cats.some((cat) => t.category?.toLowerCase().includes(cat.toLowerCase()));
    }) ?? [];

    const reset = () => {
        setStep(0);
        setSelectedGoal(null);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wand size={20} />
                        {step === 0 ? 'What would you like to automate?' : 'Choose a template'}
                    </DialogTitle>
                </DialogHeader>

                {step === 0 && (
                    <div className="space-y-2 mt-2">
                        {GOALS.map((goal) => (
                            <button
                                key={goal.id}
                                onClick={() => {
                                    setSelectedGoal(goal.id);
                                    if (goal.id === 'custom') {
                                        onOpenChange(false);
                                        reset();
                                    } else {
                                        setStep(1);
                                    }
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                            >
                                <span className="text-2xl">{goal.icon}</span>
                                <div>
                                    <div className="font-medium text-sm">{goal.label}</div>
                                    <div className="text-xs text-muted-foreground">{goal.description}</div>
                                </div>
                                <ArrowRight size={16} className="ml-auto text-muted-foreground" />
                            </button>
                        ))}
                    </div>
                )}

                {step === 1 && (
                    <div className="space-y-3 mt-2">
                        <Button variant="ghost" size="sm" onClick={() => setStep(0)} className="gap-1">
                            <ArrowLeft size={14} /> Back
                        </Button>
                        {filteredTemplates.length === 0 ? (
                            <div className="text-center py-8 text-sm text-muted-foreground">
                                No templates found for this category.
                                <div className="mt-2">
                                    <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); reset(); }}>
                                        Start from blank canvas
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            filteredTemplates.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        onApplyTemplate(t.template_json, t.name);
                                        onOpenChange(false);
                                        reset();
                                    }}
                                    className="w-full flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                                >
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{t.name}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] shrink-0">{t.category}</Badge>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
