import React from 'react';
import { MyButton } from '@/components/design-system/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { TagInput } from '@/components/ui/tag-input';
import {
    FileText,
    Video,
    Code,
    FileQuestion,
    ClipboardList,
    File,
    ImageIcon,
    Notebook,
    Puzzle,
    AlertTriangle,
} from 'lucide-react';
import { SlideType, SessionProgress } from '../../../shared/types';
import { getTerminology, getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface RegenerateSlideDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    prompt: string;
    onPromptChange: (prompt: string) => void;
    onConfirm: () => void;
    promptRef: React.RefObject<HTMLTextAreaElement>;
}

export function RegenerateSlideDialog({
    open,
    onOpenChange,
    prompt,
    onPromptChange,
    onConfirm,
    promptRef,
}: RegenerateSlideDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-[95vw] flex-col p-0 sm:w-[80vw] sm:max-w-[80vw]">
                <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
                    <DialogTitle>Regenerate Page</DialogTitle>
                </DialogHeader>
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div>
                        <Textarea
                            ref={promptRef}
                            value={prompt}
                            onChange={(e) => onPromptChange(e.target.value)}
                            placeholder="Enter a prompt describing how you want this page to be regenerated..."
                            className="min-h-[150px] text-sm"
                        />
                    </div>
                </div>
                <div className="flex shrink-0 justify-end border-t px-6 py-4">
                    <MyButton buttonType="primary" onClick={onConfirm} disabled={!prompt.trim()}>
                        Regenerate
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface RegenerateSessionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionId: string | null;
    sessions: SessionProgress[];
    prompt: string;
    onPromptChange: (prompt: string) => void;
    sessionLength: string;
    onSessionLengthChange: (length: string) => void;
    customSessionLength: string;
    onCustomSessionLengthChange: (length: string) => void;
    includeDiagrams: boolean;
    onIncludeDiagramsChange: (include: boolean) => void;
    includeCodeSnippets: boolean;
    onIncludeCodeSnippetsChange: (include: boolean) => void;
    includePracticeProblems: boolean;
    onIncludePracticeProblemsChange: (include: boolean) => void;
    includeQuizzes: boolean;
    onIncludeQuizzesChange: (include: boolean) => void;
    includeHomework: boolean;
    onIncludeHomeworkChange: (include: boolean) => void;
    includeSolutions: boolean;
    onIncludeSolutionsChange: (include: boolean) => void;
    numberOfTopics: string;
    onNumberOfTopicsChange: (num: string) => void;
    topics: string[];
    onTopicsChange: (topics: string[]) => void;
    onConfirm: () => void;
    promptRef: React.RefObject<HTMLTextAreaElement>;
}

export function RegenerateSessionDialog({
    open,
    onOpenChange,
    sessionId,
    sessions,
    prompt,
    onPromptChange,
    sessionLength,
    onSessionLengthChange,
    customSessionLength,
    onCustomSessionLengthChange,
    includeDiagrams,
    onIncludeDiagramsChange,
    includeCodeSnippets,
    onIncludeCodeSnippetsChange,
    includePracticeProblems,
    onIncludePracticeProblemsChange,
    includeQuizzes,
    onIncludeQuizzesChange,
    includeHomework,
    onIncludeHomeworkChange,
    includeSolutions,
    onIncludeSolutionsChange,
    numberOfTopics,
    onNumberOfTopicsChange,
    topics,
    onTopicsChange,
    onConfirm,
    promptRef,
}: RegenerateSessionDialogProps) {
    const session = sessions.find((s) => s.sessionId === sessionId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-[95vw] flex-col p-0 sm:w-[80vw] sm:max-w-[80vw]">
                <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
                    <DialogTitle>
                        {`Regenerate ${getTerminology(ContentTerms.Chapters, SystemTerms.Chapters)}${session ? `: ${session.sessionTitle}` : ''}`}
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div>
                        <Label className="mb-2 block">Prompt</Label>
                        <Textarea
                            ref={promptRef}
                            value={prompt}
                            onChange={(e) => onPromptChange(e.target.value)}
                            placeholder="Enter a prompt describing how you want this session to be regenerated..."
                            className="min-h-[150px] text-sm"
                        />
                    </div>

                    <div>
                        <Label htmlFor="regenerateSessionLength" className="mb-2 block">
                            {getTerminology(ContentTerms.Chapters, SystemTerms.Chapters)} Length
                        </Label>
                        <div className="space-y-2">
                            <Select value={sessionLength} onValueChange={onSessionLengthChange}>
                                <SelectTrigger id="regenerateSessionLength" className="w-full">
                                    <SelectValue placeholder="Select session length" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="45">45 minutes</SelectItem>
                                    <SelectItem value="60">60 minutes</SelectItem>
                                    <SelectItem value="90">90 minutes</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                            {sessionLength === 'custom' && (
                                <Input
                                    type="number"
                                    min="1"
                                    value={customSessionLength}
                                    onChange={(e) => onCustomSessionLengthChange(e.target.value)}
                                    placeholder="Enter custom length in minutes"
                                    className="w-full"
                                />
                            )}
                        </div>
                    </div>

                    <div>
                        <Label className="mb-2 block">Session Components</Label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="regenerateIncludeDiagrams"
                                    checked={includeDiagrams}
                                    onCheckedChange={(checked) =>
                                        onIncludeDiagramsChange(checked === true)
                                    }
                                />
                                <Label
                                    htmlFor="regenerateIncludeDiagrams"
                                    className="cursor-pointer"
                                >
                                    Include diagrams
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="regenerateIncludeCodeSnippets"
                                    checked={includeCodeSnippets}
                                    onCheckedChange={(checked) =>
                                        onIncludeCodeSnippetsChange(checked === true)
                                    }
                                />
                                <Label
                                    htmlFor="regenerateIncludeCodeSnippets"
                                    className="cursor-pointer"
                                >
                                    Include code snippets
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="regenerateIncludePracticeProblems"
                                    checked={includePracticeProblems}
                                    onCheckedChange={(checked) =>
                                        onIncludePracticeProblemsChange(checked === true)
                                    }
                                />
                                <Label
                                    htmlFor="regenerateIncludePracticeProblems"
                                    className="cursor-pointer"
                                >
                                    Include practice problems
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="regenerateIncludeQuizzes"
                                    checked={includeQuizzes}
                                    onCheckedChange={(checked) =>
                                        onIncludeQuizzesChange(checked === true)
                                    }
                                />
                                <Label
                                    htmlFor="regenerateIncludeQuizzes"
                                    className="cursor-pointer"
                                >
                                    Include quizzes
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="regenerateIncludeHomework"
                                    checked={includeHomework}
                                    onCheckedChange={(checked) =>
                                        onIncludeHomeworkChange(checked === true)
                                    }
                                />
                                <Label
                                    htmlFor="regenerateIncludeHomework"
                                    className="cursor-pointer"
                                >
                                    Include assignments
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="regenerateIncludeSolutions"
                                    checked={includeSolutions}
                                    onCheckedChange={(checked) =>
                                        onIncludeSolutionsChange(checked === true)
                                    }
                                />
                                <Label
                                    htmlFor="regenerateIncludeSolutions"
                                    className="cursor-pointer"
                                >
                                    Include solutions
                                </Label>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="regenerateSessionNumberOfTopics" className="mb-2 block">
                            {`Number of ${getTerminologyPlural(ContentTerms.Slides, SystemTerms.Slides)}`}
                        </Label>
                        <Input
                            id="regenerateSessionNumberOfTopics"
                            type="number"
                            min="1"
                            value={numberOfTopics}
                            onChange={(e) => onNumberOfTopicsChange(e.target.value)}
                            placeholder="e.g., 3, 4, 5, etc."
                            className="w-full"
                        />
                    </div>

                    <div>
                        <Label className="mb-2 block">{`${getTerminologyPlural(ContentTerms.Slides, SystemTerms.Slides)} in ${getTerminology(ContentTerms.Chapters, SystemTerms.Chapters)} (Optional)`}</Label>
                        <TagInput
                            tags={topics}
                            onChange={onTopicsChange}
                            placeholder="Enter a topic and press Enter"
                        />
                    </div>
                </div>
                <div className="flex shrink-0 justify-end border-t px-6 py-4">
                    <MyButton buttonType="primary" onClick={onConfirm} disabled={!prompt.trim()}>
                        Regenerate
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface AddSlideDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedType: SlideType | null;
    onSelectType: (type: SlideType) => void;
    prompt: string;
    onPromptChange: (prompt: string) => void;
    onConfirm: () => void;
    onBack: () => void;
    promptRef: React.RefObject<HTMLTextAreaElement>;
}

export function AddSlideDialog({
    open,
    onOpenChange,
    selectedType,
    onSelectType,
    prompt,
    onPromptChange,
    onConfirm,
    onBack,
    promptRef,
}: AddSlideDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-[95vw] flex-col p-0 sm:w-[80vw] sm:max-w-[80vw]">
                <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
                    <DialogTitle>
                        {selectedType ? 'AI Generation Prompt' : 'Select Page Type'}
                    </DialogTitle>
                    {!selectedType && (
                        <DialogDescription>
                            Choose the type of page you want to add to this session.
                        </DialogDescription>
                    )}
                </DialogHeader>
                {!selectedType ? (
                    <div className="flex-1 overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <button
                                onClick={() => onSelectType('doc')}
                                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                            >
                                <FileText className="size-6 text-blue-600" />
                                <span className="text-sm font-medium">Document</span>
                            </button>
                            <button
                                onClick={() => onSelectType('pdf')}
                                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                            >
                                <File className="size-6 text-red-600" />
                                <span className="text-sm font-medium">PDF</span>
                            </button>
                            <button
                                onClick={() => onSelectType('video')}
                                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                            >
                                <Video className="size-6 text-red-600" />
                                <span className="text-sm font-medium">Video</span>
                            </button>
                            <button
                                onClick={() => onSelectType('image')}
                                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                            >
                                <ImageIcon className="size-6 text-blue-600" />
                                <span className="text-sm font-medium">Image</span>
                            </button>
                            <button
                                onClick={() => onSelectType('jupyter')}
                                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                            >
                                <Notebook className="size-6 text-orange-600" />
                                <span className="text-sm font-medium">Jupyter</span>
                            </button>
                            <button
                                onClick={() => onSelectType('code-editor')}
                                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                            >
                                <Code className="size-6 text-green-600" />
                                <span className="text-sm font-medium">Code Editor</span>
                            </button>
                            <button
                                onClick={() => onSelectType('scratch')}
                                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                            >
                                <Puzzle className="size-6 text-purple-600" />
                                <span className="text-sm font-medium">Scratch</span>
                            </button>
                            <button
                                onClick={() => onSelectType('video-jupyter')}
                                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                            >
                                <div className="flex items-center gap-1">
                                    <Video className="size-6 text-red-600" />
                                    <Notebook className="size-6 text-orange-600" />
                                </div>
                                <span className="text-sm font-medium">Video + Jupyter</span>
                            </button>
                            <button
                                onClick={() => onSelectType('video-code-editor')}
                                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                            >
                                <div className="flex items-center gap-1">
                                    <Video className="size-6 text-red-600" />
                                    <Code className="size-6 text-green-600" />
                                </div>
                                <span className="text-sm font-medium">Video + Code</span>
                            </button>
                            <button
                                onClick={() => onSelectType('video-scratch')}
                                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                            >
                                <div className="flex items-center gap-1">
                                    <Video className="size-6 text-red-600" />
                                    <Puzzle className="size-6 text-purple-600" />
                                </div>
                                <span className="text-sm font-medium">Video + Scratch</span>
                            </button>
                            <button
                                onClick={() => onSelectType('quiz')}
                                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                            >
                                <FileQuestion className="size-6 text-purple-600" />
                                <span className="text-sm font-medium">Quiz</span>
                            </button>
                            <button
                                onClick={() => onSelectType('assignment')}
                                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                            >
                                <ClipboardList className="size-6 text-orange-600" />
                                <span className="text-sm font-medium">Assignment</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto px-6 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <Textarea
                                ref={promptRef}
                                value={prompt}
                                onChange={(e) => onPromptChange(e.target.value)}
                                placeholder="Enter a prompt describing the page you want to create..."
                                className="min-h-[150px] text-sm"
                            />
                        </div>
                        <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
                            <MyButton buttonType="secondary" onClick={onBack}>
                                Back
                            </MyButton>
                            <MyButton
                                buttonType="primary"
                                onClick={onConfirm}
                                disabled={!prompt.trim()}
                            >
                                Create Page
                            </MyButton>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

interface AddSessionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionName: string;
    onSessionNameChange: (name: string) => void;
    onConfirm: () => void;
}

export function AddSessionDialog({
    open,
    onOpenChange,
    sessionName,
    onSessionNameChange,
    onConfirm,
}: AddSessionDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{`Add New ${getTerminology(ContentTerms.Chapters, SystemTerms.Chapters)}`}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="sessionName" className="mb-2 block">
                            {getTerminology(ContentTerms.Chapters, SystemTerms.Chapters)} Name
                        </Label>
                        <Input
                            id="sessionName"
                            value={sessionName}
                            onChange={(e) => onSessionNameChange(e.target.value)}
                            placeholder={`Enter ${getTerminology(ContentTerms.Chapters, SystemTerms.Chapters).toLowerCase()} name`}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && sessionName.trim()) {
                                    onConfirm();
                                }
                            }}
                            autoFocus
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <MyButton buttonType="secondary" onClick={() => onOpenChange(false)}>
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        onClick={onConfirm}
                        disabled={!sessionName.trim()}
                    >
                        {`Add ${getTerminology(ContentTerms.Chapters, SystemTerms.Chapters)}`}
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface GenerateCourseAssetsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

export function GenerateCourseAssetsDialog({
    open,
    onOpenChange,
    onConfirm,
}: GenerateCourseAssetsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-md">
                <DialogHeader>
                    <div className="mb-2 flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                            <AlertTriangle className="size-5 text-amber-600" />
                        </div>
                        <DialogTitle className="text-xl">Final Confirmation</DialogTitle>
                    </div>
                    <DialogDescription className="pt-2">
                        <div className="space-y-3 text-neutral-700">
                            <p>
                                Please review the text content for each page carefully before
                                proceeding.
                            </p>
                            <p className="font-semibold text-neutral-900">
                                Once you proceed, AI will start creating the actual course content
                                and there is no coming back.
                            </p>
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-6 flex justify-end gap-3">
                    <MyButton buttonType="secondary" onClick={() => onOpenChange(false)}>
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        onClick={() => {
                            onConfirm();
                            onOpenChange(false);
                        }}
                    >
                        Proceed
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface BackToLibraryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDiscard: () => void;
    onSaveToDrafts: () => void;
}

export function BackToLibraryDialog({
    open,
    onOpenChange,
    onDiscard,
    onSaveToDrafts,
}: BackToLibraryDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Go Back to Course Library?</DialogTitle>
                    <DialogDescription className="text-neutral-600">
                        Are you sure you want to go back to course library? You can either discard
                        your current course or save it to drafts.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-6 flex flex-col items-center justify-end gap-3 border-t border-neutral-200 pt-4 sm:flex-row">
                    <MyButton
                        buttonType="secondary"
                        onClick={() => onOpenChange(false)}
                        className="w-full min-w-[100px] sm:w-auto"
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        onClick={onDiscard}
                        className="min-w-[120px] border-red-300 text-red-600 hover:border-red-400 hover:bg-red-50 hover:text-red-700"
                    >
                        Discard Course
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        onClick={onSaveToDrafts}
                        className="min-w-[130px]"
                    >
                        Save to Drafts
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}
