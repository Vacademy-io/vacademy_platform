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
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

const LARGE_TYPES: ContentType[] = ['VIDEO', 'SLIDES', 'QUIZ'];

export function ContentSelector({
    selectedType,
    onSelect,
    onSamplePromptSelect,
}: ContentSelectorProps) {
    // Helper to get Icon
    const getIcon = (type: ContentType) => {
        return (ICONS[type] ?? Video) as React.ComponentType<{ className?: string }>;
    };

    return (
        <div className="mx-auto max-w-6xl space-y-3 p-2 duration-500 animate-in fade-in zoom-in sm:space-y-6 sm:p-4">
            <div className="space-y-1 text-center">
                <h2 className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-lg font-bold tracking-tight text-transparent sm:text-2xl">
                    What would you like to create?
                </h2>
            </div>

            <div className="grid auto-rows-auto grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
                {CONTENT_TYPES.map((type) => {
                    const isLarge = LARGE_TYPES.includes(type.value);
                    const isSelected = selectedType === type.value;
                    const Icon = getIcon(type.value);

                    return (
                        <Card
                            key={type.value}
                            className={cn(
                                'group relative cursor-pointer overflow-hidden transition-all duration-300',
                                isSelected
                                    ? 'col-span-2 scale-[1.02] bg-violet-50/50 shadow-md ring-2 ring-violet-500 md:col-span-4'
                                    : isLarge
                                      ? 'col-span-1 md:col-span-2 md:row-span-2'
                                      : 'col-span-1',
                                !isSelected &&
                                    'hover:border-violet-200 hover:bg-slate-50 hover:shadow-lg'
                            )}
                            onClick={() => onSelect(type.value)}
                        >
                            <div
                                className={cn(
                                    'flex h-full flex-col',
                                    isSelected
                                        ? 'p-3 sm:p-6'
                                        : 'items-center justify-center gap-2 p-3 text-center sm:gap-4 sm:p-4'
                                )}
                            >
                                {isSelected ? (
                                    <div className="grid size-full gap-3 sm:gap-6 md:grid-cols-[200px_1fr]">
                                        <div className="flex flex-col items-center justify-center gap-2 border-b border-border/50 pb-3 text-center sm:gap-4 sm:pb-6 md:items-start md:border-b-0 md:border-r md:pb-0 md:pr-6 md:text-left">
                                            <div className="rounded-2xl bg-violet-100 p-2 text-violet-600 sm:p-4">
                                                <Icon className="size-8 sm:size-10" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold sm:text-xl">
                                                    {type.label.replace(/^[^\s]+\s/, '')}
                                                </h3>
                                                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                                                    {type.description}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 sm:gap-3">
                                            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-violet-600 sm:text-sm">
                                                <Sparkles className="size-3 sm:size-4" />
                                                <span>Try a sample prompt</span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                {(SAMPLE_PROMPTS[type.value] ?? []).map(
                                                    (prompt, i) => (
                                                        <Button
                                                            key={i}
                                                            variant="outline"
                                                            className="h-auto justify-start whitespace-normal bg-background px-3 py-2 text-left text-xs hover:border-violet-300 hover:bg-violet-50 sm:px-4 sm:py-3"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onSamplePromptSelect(prompt);
                                                            }}
                                                        >
                                                            <span className="line-clamp-2">
                                                                {prompt}
                                                            </span>
                                                        </Button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            className={cn(
                                                'rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-violet-100 group-hover:text-violet-600',
                                                isLarge ? 'p-3 md:p-5' : 'p-2 sm:p-3'
                                            )}
                                        >
                                            <Icon
                                                className={cn(
                                                    'size-5 sm:size-6',
                                                    isLarge && 'md:size-10'
                                                )}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <h3
                                                className={cn(
                                                    'font-semibold',
                                                    isLarge
                                                        ? 'text-sm sm:text-lg'
                                                        : 'text-xs sm:text-sm'
                                                )}
                                            >
                                                {type.label.replace(/^[^\s]+\s/, '')}
                                            </h3>
                                            <p
                                                className={cn(
                                                    'line-clamp-2 text-muted-foreground',
                                                    isLarge
                                                        ? 'line-clamp-3 px-1 text-[10px] md:px-2 md:text-sm'
                                                        : 'text-[10px] sm:text-xs'
                                                )}
                                            >
                                                {type.description}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
