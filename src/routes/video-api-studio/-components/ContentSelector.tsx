import { useEffect, useRef, useState } from 'react';
import {
    Video,
    FileQuestion,
    BookOpen,
    Gamepad2,
    Puzzle,
    FlaskConical,
    Layers,
    Map,
    FileText,
    Terminal,
    History,
    MessageCircle,
    Sparkles,
    GalleryHorizontalEnd,
    MonitorPlay,
    ClipboardCheck,
    Eye,
    X,
    Wand2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CONTENT_TYPES, ContentType } from '../-services/video-generation';
import { cn } from '@/lib/utils';
import React from 'react';

interface ContentSelectorProps {
    selectedType: ContentType;
    onSelect: (type: ContentType) => void;
    onSamplePromptSelect: (prompt: string) => void;
}

const ICONS: Record<ContentType, React.ElementType> = {
    VIDEO: Video,
    QUIZ: FileQuestion,
    STORYBOOK: BookOpen,
    INTERACTIVE_GAME: Gamepad2,
    PUZZLE_BOOK: Puzzle,
    SIMULATION: FlaskConical,
    FLASHCARDS: Layers,
    MAP_EXPLORATION: Map,
    WORKSHEET: FileText,
    CODE_PLAYGROUND: Terminal,
    TIMELINE: History,
    CONVERSATION: MessageCircle,
    SLIDES: GalleryHorizontalEnd,
};

const SAMPLE_PROMPTS: Record<ContentType, string[]> = {
    VIDEO: [
        'Explain the water cycle to a 5th grader using simple analogies and bright visuals.',
        'Create a 2-minute video about the history of the Roman Empire, focusing on its rise and fall.',
        'Show how a car engine works with a step-by-step breakdown of the internal combustion process.',
        'A travel guide to Kyoto, highlighting its temples, food, and culture.',
    ],
    QUIZ: [
        'Create a 10-question math quiz for 3rd graders on multiplication and division word problems.',
        'Generate a science quiz about the solar system with multiple-choice questions and fun facts.',
        'Make a geography quiz on European capitals with increasing difficulty levels.',
        'Pop culture trivia quiz about 90s movies, music, and fashion trends.',
    ],
    STORYBOOK: [
        'Write a story about a brave little toaster who travels to Mars to find the perfect slice of bread.',
        'Create a bedtime story for toddlers about a group of forest animals preparing for a winter festival.',
        'A fairy tale about a lost dragon who learns to breathe bubbles instead of fire.',
        'The adventures of a space cat exploring different planets and making alien friends.',
    ],
    INTERACTIVE_GAME: [
        'Design a memory matching game featuring endangered animals and their habitats.',
        'Create a math adventure game where players solve equations to unlock treasure chests.',
        'Build a space shooter game where players answer science questions to power up their ship.',
        'An interactive typing game that teaches touch typing with fun themes.',
    ],
    PUZZLE_BOOK: [
        'Generate a crossword puzzle about space exploration terms and famous astronauts.',
        'Create a word search puzzle hidden with names of different dinosaur species.',
        'Design a Sudoku book for beginners with helpful tips and progressive difficulty.',
        'A logic puzzle collection challenging users to solve riddles and brain teasers.',
    ],
    SIMULATION: [
        'Build a physics simulation demonstrating gravity and orbital mechanics in our solar system.',
        'Create an ecosystem balance simulation where users manage predators, prey, and resources.',
        'Design a circuit builder playground for students to learn about electricity and components.',
        'A chemistry lab simulation allowing users to mix elements and observe reactions safely.',
    ],
    FLASHCARDS: [
        'Create a set of flashcards for learning the Periodic Table of Elements with symbols and atomic numbers.',
        'Generate French vocabulary flashcards for beginners covering greetings, numbers, and common phrases.',
        'Make history flashcards with key dates, events, and important figures from World War II.',
        'Biology flashcards explaining cell structures and their functions.',
    ],
    MAP_EXPLORATION: [
        'Create an interactive map of Ancient Greece showing major city-states and historical battles.',
        'Design a clickable map of South America highlighting physical geography and biodiversity.',
        'Build an interactive world map displaying different biomes and climate zones.',
        'A historical map tracking the voyages of potential explorers like Marco Polo',
    ],
    WORKSHEET: [
        'Generate a math worksheet for practicing fraction addition and subtraction with word problems.',
        'Create a reading comprehension worksheet about photosynthesis with questions and vocabulary exercises.',
        'Design a grammar worksheet for ESL students focusing on past tense verbs and sentence structure.',
        'A science worksheet labeling the parts of a plant and explaining their functions.',
    ],
    CODE_PLAYGROUND: [
        'Create a Python coding challenge to write a function that calculates the Fibonacci sequence.',
        'Design a JavaScript exercise for manipulating the DOM to change background colors.',
        'Build an HTML/CSS challenge to create a responsive flexbox layout for a photo gallery.',
        'A React tutorial guiding users to build a simple to-do list application.',
    ],
    TIMELINE: [
        'Generate a scrollable timeline of World War II events from 1939 to 1945.',
        'Create a visual timeline showing the evolution of computers from the abacus to quantum computing.',
        'Design a history of space exploration timeline highlighting key missions and milestones.',
        'A timeline of art history movements from the Renaissance to Contemporary Art.',
    ],
    CONVERSATION: [
        'Simulate a conversation for ordering food at a Spanish restaurant with a waiter.',
        'Create a job interview practice scenario for a software engineering role.',
        'Roleplay a doctor appointment dialogue discussing symptoms and treatment options.',
        'Practice a negotiation conversation for buying a used car.',
    ],
    SLIDES: [
        'Create a presentation on the water cycle — cover evaporation, condensation, precipitation, and collection with clear diagrams.',
        'Make a slide deck explaining the key events and causes of World War I for high school students.',
        'Build a pitch deck for a startup idea: an AI-powered personal finance assistant for Gen Z.',
        'Design a presentation on machine learning basics — supervised vs unsupervised learning, neural networks, and real-world applications.',
    ],
};

interface ContentCategory {
    id: string;
    label: string;
    icon: React.ElementType;
    types: ContentType[];
}

const CONTENT_CATEGORIES: ContentCategory[] = [
    {
        id: 'video-presentations',
        label: 'Video & Presentations',
        icon: MonitorPlay,
        types: ['VIDEO', 'SLIDES'],
    },
    {
        id: 'assessments',
        label: 'Assessments & Practice',
        icon: ClipboardCheck,
        types: ['QUIZ', 'WORKSHEET', 'FLASHCARDS'],
    },
    {
        id: 'interactive',
        label: 'Interactive',
        icon: Gamepad2,
        types: ['INTERACTIVE_GAME', 'SIMULATION', 'CODE_PLAYGROUND', 'PUZZLE_BOOK'],
    },
    {
        id: 'stories',
        label: 'Stories & Communication',
        icon: BookOpen,
        types: ['STORYBOOK', 'CONVERSATION'],
    },
    {
        id: 'visual',
        label: 'Visual Learning',
        icon: Eye,
        types: ['TIMELINE', 'MAP_EXPLORATION'],
    },
];

const POPULAR_TYPES: ContentType[] = ['VIDEO', 'SLIDES', 'QUIZ'];

const WELCOME_DISMISSED_KEY = 'vacademy-content-selector-welcome-dismissed';

export function ContentSelector({
    selectedType,
    onSelect,
    onSamplePromptSelect,
}: ContentSelectorProps) {
    const [showWelcome, setShowWelcome] = useState(() => {
        return localStorage.getItem(WELCOME_DISMISSED_KEY) !== 'true';
    });

    const promptsRef = useRef<HTMLDivElement>(null);

    const dismissWelcome = () => {
        setShowWelcome(false);
        localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    };

    // Scroll sample prompts into view when selection changes
    useEffect(() => {
        if (!selectedType || !promptsRef.current) return;
        const timer = setTimeout(() => {
            promptsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
        return () => clearTimeout(timer);
    }, [selectedType]);

    const getIcon = (type: ContentType) => {
        return (ICONS[type] ?? Video) as React.ComponentType<{ className?: string }>;
    };

    const selectedTypeInfo = CONTENT_TYPES.find((t) => t.value === selectedType);
    const SelectedIcon = getIcon(selectedType);

    return (
        <div className="mx-auto max-w-5xl space-y-4 p-2 duration-500 animate-in fade-in sm:space-y-6 sm:p-4">
            {/* Welcome/Onboarding Hero */}
            {showWelcome && (
                <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-violet-50 via-indigo-50 to-blue-50 p-4 sm:p-6">
                    <button
                        onClick={dismissWelcome}
                        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-white/60 hover:text-foreground"
                    >
                        <X className="size-4" />
                    </button>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <h2 className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-lg font-bold tracking-tight text-transparent sm:text-xl">
                                Create AI-Powered Learning Content
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Turn any topic into engaging educational content in minutes.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {[
                                {
                                    step: '1',
                                    title: 'Choose a format',
                                    desc: 'Pick from videos, quizzes, games, and more',
                                    icon: Layers,
                                },
                                {
                                    step: '2',
                                    title: 'Describe your topic',
                                    desc: 'Tell AI what you want to teach',
                                    icon: Wand2,
                                },
                                {
                                    step: '3',
                                    title: 'Get your content',
                                    desc: 'AI generates it ready to share',
                                    icon: Sparkles,
                                },
                            ].map((item) => {
                                const StepIcon = item.icon;
                                return (
                                    <div
                                        key={item.step}
                                        className="flex items-start gap-3 rounded-lg bg-white/60 p-3"
                                    >
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100">
                                            <StepIcon className="size-4 text-violet-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{item.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {item.desc}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Section heading */}
            <div className="space-y-1 text-center">
                <h2 className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-lg font-bold tracking-tight text-transparent sm:text-2xl">
                    What would you like to create?
                </h2>
                <p className="text-xs text-muted-foreground sm:text-sm">
                    Select a content type to get started
                </p>
            </div>

            {/* Category-grouped content grid */}
            <div className="space-y-5 sm:space-y-6">
                {CONTENT_CATEGORIES.map((category) => {
                    const CategoryIcon = category.icon as React.ComponentType<{ className?: string }>;
                    return (
                        <div key={category.id} className="space-y-2 sm:space-y-3">
                            {/* Category header */}
                            <div className="flex items-center gap-2">
                                <CategoryIcon className="size-4 text-muted-foreground" />
                                <h3 className="whitespace-nowrap text-sm font-semibold text-foreground">
                                    {category.label}
                                </h3>
                                <Separator className="flex-1" />
                            </div>

                            {/* Cards grid */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
                                {category.types.map((typeValue) => {
                                    const typeInfo = CONTENT_TYPES.find(
                                        (t) => t.value === typeValue
                                    );
                                    if (!typeInfo) return null;
                                    const isSelected = selectedType === typeValue;
                                    const isPopular = POPULAR_TYPES.includes(typeValue);
                                    const Icon = getIcon(typeValue);

                                    return (
                                        <Card
                                            key={typeValue}
                                            className={cn(
                                                'group relative cursor-pointer p-3 transition-all duration-200 sm:p-4',
                                                isSelected
                                                    ? 'border-violet-500 bg-violet-50/50 shadow-md ring-2 ring-violet-500'
                                                    : 'hover:border-violet-200 hover:bg-slate-50 hover:shadow-md'
                                            )}
                                            onClick={() => onSelect(typeValue)}
                                        >
                                            {isPopular && (
                                                <Badge className="absolute right-2 top-2 border-0 bg-violet-100 px-1.5 py-0 text-[10px] font-medium text-violet-700 hover:bg-violet-100">
                                                    Popular
                                                </Badge>
                                            )}

                                            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:text-left">
                                                <div
                                                    className={cn(
                                                        'shrink-0 rounded-xl p-2 transition-colors sm:p-3',
                                                        isSelected
                                                            ? 'bg-violet-100 text-violet-600'
                                                            : 'bg-muted text-muted-foreground group-hover:bg-violet-100 group-hover:text-violet-600'
                                                    )}
                                                >
                                                    <Icon className="size-5 sm:size-6" />
                                                </div>
                                                <div className="min-w-0 space-y-0.5">
                                                    <h4 className="text-xs font-semibold sm:text-sm">
                                                        {typeInfo.label.replace(/^[^\s]+\s/, '')}
                                                    </h4>
                                                    <p className="line-clamp-2 text-[10px] text-muted-foreground sm:text-xs">
                                                        {typeInfo.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Sample prompts panel (below grid) */}
            {selectedType && (
                <div
                    ref={promptsRef}
                    className="overflow-hidden rounded-xl border border-violet-200 bg-violet-50/30 duration-300 animate-in fade-in slide-in-from-top-2"
                >
                    <div className="p-3 sm:p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="rounded-lg bg-violet-100 p-1.5">
                                    <SelectedIcon className="size-4 text-violet-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold sm:text-base">
                                        {selectedTypeInfo?.label.replace(/^[^\s]+\s/, '')}
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground sm:text-xs">
                                        Try a sample prompt to get started quickly
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-violet-600">
                                <Sparkles className="size-3" />
                                <span className="hidden sm:inline">Sample prompts</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {(SAMPLE_PROMPTS[selectedType] ?? []).map((prompt, i) => (
                                <Button
                                    key={i}
                                    variant="outline"
                                    className="h-auto justify-start whitespace-normal bg-white px-3 py-2.5 text-left text-xs hover:border-violet-300 hover:bg-violet-50 sm:px-4 sm:py-3"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSamplePromptSelect(prompt);
                                    }}
                                >
                                    <span className="line-clamp-2">{prompt}</span>
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
