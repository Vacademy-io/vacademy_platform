import { Card, CardContent } from '@/components/ui/card';
import beforeLectureImg from '@/assets/instructor-copilot/before-lecture.png';
import inLectureImg from '@/assets/instructor-copilot/in-lecture.png';
import afterLectureImg from '@/assets/instructor-copilot/after-lecture.png';

interface LectureDashboardProps {
    onSelectStep: (step: 'before' | 'in' | 'after') => void;
}

export function LectureDashboard({ onSelectStep }: LectureDashboardProps) {
    const steps = [
        {
            id: 'before',
            title: 'Before Lecture',
            image: beforeLectureImg,
            description: 'Plan, schedule, and prepare materials.'
        },
        {
            id: 'in',
            title: 'In Lecture',
            image: inLectureImg,
            description: 'Record, upload, or present interactively.'
        },
        {
            id: 'after',
            title: 'After Lecture',
            image: afterLectureImg,
            description: 'Analyze performance and review logs.'
        }
    ] as const;

    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((step) => (
                <Card
                    key={step.id}
                    className="group cursor-pointer overflow-hidden transition-all hover:border-primary-500 hover:shadow-md"
                    onClick={() => onSelectStep(step.id)}
                >
                    <div className="aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <img
                            src={step.image}
                            alt={step.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    </div>
                    <CardContent className="p-6 text-center">
                        <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
                            {step.title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {step.description}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
