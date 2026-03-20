import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MagicWand, Spinner } from '@phosphor-icons/react';
import { QUIZ_LANGUAGES, QUESTION_TYPES } from '@/constants/dummy-data';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface QuizGenerationFormProps {
    transcript: string;
    onGenerate: (formData: {
        text: string;
        num: number;
        class_level: string;
        question_type: string;
        question_language: string;
        taskName: string;
    }) => void;
    isGenerating?: boolean;
}

export const QuizGenerationForm = ({ transcript, onGenerate, isGenerating = false }: QuizGenerationFormProps) => {
    const [numQuestions, setNumQuestions] = useState(5);
    const [classLevel, setClassLevel] = useState('');
    const [questionType, setQuestionType] = useState('MCQS');
    const [questionLanguage, setQuestionLanguage] = useState('ENGLISH');

    const generateTaskName = () => {
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const dateStr = format(new Date(), 'dd/MM/yyyy');
        return `Task_${randomDigits}_${dateStr}`;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!transcript || !transcript.trim()) {
            toast.error('No transcript available. Please ensure you have transcribed audio first.');
            return;
        }

        if (!classLevel.trim()) {
            toast.error('Please enter a class level');
            return;
        }

        onGenerate({
            text: transcript.trim(),
            num: numQuestions,
            class_level: classLevel.trim(),
            question_type: questionType,
            question_language: questionLanguage,
            taskName: generateTaskName(),
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MagicWand size={20} className="text-primary-500" />
                    Generate Quiz from Transcript
                </CardTitle>
                <CardDescription>
                    Generate quiz questions based on the instructor's transcript
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Number of Questions */}
                    <div className="space-y-2">
                        <Label htmlFor="numQuestions">
                            Number of Questions <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="numQuestions"
                            type="number"
                            min={1}
                            max={50}
                            value={numQuestions}
                            onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                            required
                            disabled={isGenerating}
                        />
                    </div>

                    {/* Class Level */}
                    <div className="space-y-2">
                        <Label htmlFor="classLevel">
                            Class Level <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="classLevel"
                            placeholder="e.g., 9th class NCERT, Grade 10, High School"
                            value={classLevel}
                            onChange={(e) => setClassLevel(e.target.value)}
                            required
                            disabled={isGenerating}
                        />
                        <p className="text-xs text-slate-500">
                            Specify the education level or standard
                        </p>
                    </div>

                    {/* Question Type */}
                    <div className="space-y-2">
                        <Label htmlFor="questionType">Question Type</Label>
                        <Select
                            value={questionType}
                            onValueChange={setQuestionType}
                            disabled={isGenerating}
                        >
                            <SelectTrigger id="questionType">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {QUESTION_TYPES.filter(qt => qt.code === 'MCQS' || qt.code === 'MCQM').map((qt) => (
                                    <SelectItem key={qt.code} value={qt.code}>
                                        {qt.display}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Question Language */}
                    <div className="space-y-2">
                        <Label htmlFor="questionLanguage">Language</Label>
                        <Select
                            value={questionLanguage}
                            onValueChange={setQuestionLanguage}
                            disabled={isGenerating}
                        >
                            <SelectTrigger id="questionLanguage">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {QUIZ_LANGUAGES.map((lang) => (
                                    <SelectItem key={lang.value} value={lang.value}>
                                        {lang.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="w-full gap-2"
                        disabled={isGenerating || !transcript}
                    >
                        {isGenerating ? (
                            <>
                                <Spinner size={16} className="animate-spin" />
                                Generating Quiz...
                            </>
                        ) : (
                            <>
                                <MagicWand size={16} />
                                Generate Quiz from Transcript
                            </>
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
};
