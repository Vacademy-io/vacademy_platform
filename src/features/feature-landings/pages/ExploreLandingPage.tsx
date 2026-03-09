import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { LoginDialog } from '../components/LoginDialog';
import {
    Video,
    FileQuestion,
    BookOpen,
    FileText,
    Gamepad2,
    GraduationCap,
    Sparkles,
    ArrowRight,
    Play,
    CheckCircle2,
    Circle,
    ChevronRight,
    FolderOpen,
    FileVideo,
    Clock,
    Users,
    BarChart3,
    Plus,
    Search,
    Bell,
    Settings,
    LayoutGrid,
    ChevronDown,
    Coins,
    Gift,
    Zap,
    Cpu,
    Crown,
    Star,
    Shield,
    Bot,
    Wand2,
    Code2,
    Terminal,
    Languages,
    ExternalLink,
} from 'lucide-react';


const pricingTiers = [
    {
        name: 'Standard',
        icon: Zap,
        multiplier: '1×',
        color: 'border-neutral-200 bg-white',
        badge: 'bg-neutral-100 text-neutral-600',
        models: 'Gemini 2.0 Flash, GPT-3.5, DeepSeek-v3',
    },
    {
        name: 'Premium',
        icon: Star,
        multiplier: '2×',
        color: 'border-neutral-200 bg-neutral-50',
        badge: 'bg-neutral-200 text-neutral-700',
        models: 'Gemini 2.5 Pro, GPT-4 Turbo, Claude 3.5 Sonnet',
    },
    {
        name: 'Ultra',
        icon: Crown,
        multiplier: '4×',
        color: 'border-neutral-200 bg-neutral-100',
        badge: 'bg-neutral-300 text-neutral-800',
        models: 'GPT-4o, Claude 3 Opus',
    },
];

const creditCosts = [
    { feature: 'Video Generation', cost: '5.0', unit: 'per video', icon: Video },
    { feature: 'Image Generation', cost: '3.0', unit: 'per image', icon: FileText },
    { feature: 'Text / Course Outline', cost: '0.5', unit: 'base + tokens', icon: GraduationCap },
];

const DEMO_TOPICS = [
    {
        prompt: "Explain Newton's Laws of Motion for Grade 10 students",
        subject: 'Physics',
        videoTitle: "Newton's Laws of Motion",
        duration: '2:45',
        quiz: [
            "What is Newton's 1st Law of motion?",
            'Define inertia with a real-world example.',
            'If F = 10N and m = 2 kg, find the acceleration.',
        ],
        outline: ["Concept of Force", "Newton's 1st Law", "Newton's 2nd Law: F=ma", "Newton's 3rd Law", "Applications"],
    },
    {
        prompt: 'Teach Kirchhoff\'s Current Law for engineering students',
        subject: 'Electrical Engineering',
        videoTitle: "Kirchhoff's Current Law",
        duration: '3:10',
        quiz: [
            'State Kirchhoff\'s Current Law (KCL).',
            'What is the algebraic sum of currents at any node?',
            'Apply KCL to find the unknown current I₃.',
        ],
        outline: ['Circuit Nodes & Branches', 'KCL Statement', 'Sign Convention', 'Node Voltage Method', 'Practice Problems'],
    },
    {
        prompt: 'Create a lesson on Photosynthesis for Grade 8 Biology',
        subject: 'Biology',
        videoTitle: 'Photosynthesis Explained',
        duration: '2:20',
        quiz: [
            'Write the chemical equation for photosynthesis.',
            'Where exactly does photosynthesis take place?',
            'What is the role of chlorophyll?',
        ],
        outline: ['What is Photosynthesis?', 'Reactants & Products', 'Light Reactions', 'Calvin Cycle', 'Factors Affecting Rate'],
    },
];

const SUBJECT_COLORS: Record<string, string> = {
    'Physics': 'bg-blue-100 text-blue-700',
    'Electrical Engineering': 'bg-amber-100 text-amber-700',
    'Biology': 'bg-emerald-100 text-emerald-700',
};

function HeroDemoWidget() {
    const [idx, setIdx] = useState(0);
    const [phase, setPhase] = useState<'typing' | 'generating' | 'done'>('typing');
    const [progress, setProgress] = useState(0);
    const [typed, setTyped] = useState(0);

    const topic = DEMO_TOPICS[idx]!;
    const fullPrompt = topic.prompt;

    // Typing phase
    useEffect(() => {
        if (phase !== 'typing') return;
        setTyped(0);
        let i = 0;
        const t = setInterval(() => {
            i++;
            setTyped(i);
            if (i >= fullPrompt.length) {
                clearInterval(t);
                setTimeout(() => setPhase('generating'), 600);
            }
        }, 32);
        return () => clearInterval(t);
    }, [phase, idx]); // eslint-disable-line react-hooks/exhaustive-deps

    // Generating phase
    useEffect(() => {
        if (phase !== 'generating') return;
        setProgress(0);
        let p = 0;
        const t = setInterval(() => {
            p = Math.min(p + Math.random() * 7 + 3, 100);
            setProgress(p);
            if (p >= 100) {
                clearInterval(t);
                setTimeout(() => setPhase('done'), 200);
            }
        }, 110);
        return () => clearInterval(t);
    }, [phase]);

    // Done phase → cycle
    useEffect(() => {
        if (phase !== 'done') return;
        const t = setTimeout(() => {
            setIdx((i) => (i + 1) % DEMO_TOPICS.length);
            setPhase('typing');
        }, 5000);
        return () => clearTimeout(t);
    }, [phase]);

    return (
        <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-2xl shadow-neutral-900/10">
            {/* window chrome */}
            <div className="flex items-center gap-1.5 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                <div className="size-3 rounded-full bg-neutral-300" />
                <div className="size-3 rounded-full bg-neutral-300" />
                <div className="size-3 rounded-full bg-neutral-300" />
                <span className="ml-3 text-xs font-medium text-neutral-400">AI Content Generator</span>
                <div className="ml-auto flex gap-1">
                    {DEMO_TOPICS.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-4 bg-neutral-700' : 'w-1.5 bg-neutral-300'}`}
                        />
                    ))}
                </div>
            </div>

            <div className="p-5">
                {/* Prompt input */}
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <Sparkles className="size-4 shrink-0 text-violet-500" />
                    <span className="min-h-[1.25rem] flex-1 text-sm text-neutral-800">
                        {fullPrompt.slice(0, typed)}
                        {phase === 'typing' && (
                            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-neutral-700 align-middle" />
                        )}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                        <span className="hidden rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] font-medium text-neutral-500 sm:inline">
                            Gemini 2.0 Flash
                        </span>
                        <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[11px] font-semibold text-white">
                            Generate
                        </button>
                    </div>
                </div>

                {/* Output type chips */}
                <div className="mb-4 flex flex-wrap gap-2">
                    {[
                        { icon: FileVideo, label: 'Video' },
                        { icon: FileQuestion, label: 'Quiz' },
                        { icon: BookOpen, label: 'Outline' },
                        { icon: FileText, label: 'Notes' },
                    ].map(({ icon: Icon, label }) => (
                        <div
                            key={label}
                            className="flex items-center gap-1.5 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-[11px] font-medium text-white"
                        >
                            <Icon className="size-3" />
                            {label}
                        </div>
                    ))}
                    <div className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-medium text-neutral-400">
                        <Gamepad2 className="size-3" />
                        Game
                    </div>
                </div>

                {/* Generating progress */}
                {phase === 'generating' && (
                    <div className="rounded-xl bg-neutral-50 p-4">
                        <div className="mb-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-neutral-600">
                                <div className="size-2 animate-pulse rounded-full bg-violet-500" />
                                Generating content...
                            </div>
                            <span className="text-xs font-semibold tabular-nums text-neutral-700">
                                {Math.round(progress)}%
                            </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
                            <div
                                className="h-full rounded-full bg-neutral-900 transition-all duration-100"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="mt-3 flex gap-2">
                            {['Analyzing topic…', 'Writing script…', 'Rendering frames…'].map((s, i) => (
                                <div
                                    key={s}
                                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-all ${progress > i * 33 ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400'}`}
                                >
                                    {progress > i * 33 + 33 ? (
                                        <CheckCircle2 className="size-3" />
                                    ) : (
                                        <div className="size-1.5 rounded-full bg-current" />
                                    )}
                                    {s}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Done: output cards */}
                {phase === 'done' && (
                    <div className="grid grid-cols-2 gap-3">
                        {/* Video card */}
                        <div className="overflow-hidden rounded-xl border border-neutral-200">
                            <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950">
                                <div className="flex size-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                                    <Play className="size-4 fill-white text-white" />
                                </div>
                                <span className="absolute bottom-1.5 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                    {topic.duration}
                                </span>
                                <span
                                    className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-semibold ${SUBJECT_COLORS[topic.subject] ?? 'bg-neutral-100 text-neutral-600'}`}
                                >
                                    {topic.subject}
                                </span>
                            </div>
                            <div className="bg-neutral-900 px-3 py-2">
                                <div className="text-[11px] font-medium text-white">{topic.videoTitle}</div>
                                <div className="mt-0.5 text-[10px] text-neutral-400">AI-narrated • HD</div>
                            </div>
                        </div>

                        {/* Quiz card */}
                        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-3">
                            <div className="mb-2 flex items-center gap-1.5">
                                <FileQuestion className="size-3.5 text-neutral-500" />
                                <span className="text-[11px] font-semibold text-neutral-700">
                                    Quiz · 5 questions
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                {topic.quiz.map((q, i) => (
                                    <div key={i} className="flex items-start gap-1.5">
                                        <span className="mt-0.5 shrink-0 text-[10px] font-bold text-neutral-400">
                                            Q{i + 1}.
                                        </span>
                                        <span className="text-[10px] leading-relaxed text-neutral-600">{q}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Course outline card — full width */}
                        <div className="col-span-2 overflow-hidden rounded-xl border border-neutral-200 bg-white p-3">
                            <div className="mb-2 flex items-center gap-1.5">
                                <BookOpen className="size-3.5 text-neutral-500" />
                                <span className="text-[11px] font-semibold text-neutral-700">
                                    Course Outline · {topic.outline.length} chapters
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {topic.outline.map((item, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-1.5 rounded-lg bg-neutral-50 px-2.5 py-1.5"
                                    >
                                        <span className="text-[10px] font-bold text-neutral-400">
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <span className="text-[11px] text-neutral-700">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const ED_VIDEO_URL =
    'https://dash.vacademy.io/content/vid_1773035782091_8faqaz5?timeline=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvid_1773035782091_8faqaz5%2Ftimeline%2Ftime_based_frame.json&audio=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvid_1773035782091_8faqaz5%2Faudio%2Fnarration.mp3&words=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvid_1773035782091_8faqaz5%2Fwords%2Fnarration.words.json';

function RealDemoSection() {
    return (
        <section className="bg-[#f8f9fa] px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
                {/* Heading */}
                <div className="mb-10 text-center">
                    <h2 className="font-serif text-3xl tracking-tight text-neutral-900 sm:text-5xl">
                        One prompt. A complete video.
                    </h2>
                    <p className="mt-3 text-base text-neutral-500">
                        Watch the actual generation — no cuts, no staging.
                    </p>
                </div>

                {/* Prompt pill */}
                <div className="mb-8 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                        <Sparkles className="size-4 text-violet-500" />
                    </div>
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                            Prompt
                        </div>
                        <div className="mt-0.5 text-sm font-medium text-neutral-900 sm:text-base">
                            what is Enforcement Directorate (ED) in india
                        </div>
                    </div>
                    <ArrowRight className="ml-auto size-4 shrink-0 text-neutral-300" />
                </div>

                {/* Side-by-side: process recording + output */}
                <div className="grid gap-5 lg:grid-cols-2">
                    {/* Screen recording */}
                    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
                            <div className="size-2 rounded-full bg-red-400" />
                            <span className="text-xs font-medium text-neutral-500">
                                Screen recording · live generation
                            </span>
                        </div>
                        <div className="relative w-full bg-neutral-950" style={{ aspectRatio: '16/9' }}>
                            <video
                                src="https://res.cloudinary.com/dsyhjlwqu/video/upload/v1773038345/My_Movie_1_cyp82q.mp4"
                                controls
                                className="h-full w-full"
                            />
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-[11px] text-neutral-500">
                                The full process — entering a prompt, selecting content types, and watching Vacademy generate in real time.
                            </p>
                        </div>
                    </div>

                    {/* Output video */}
                    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
                            <div className="size-2 rounded-full bg-emerald-400" />
                            <span className="text-xs font-medium text-neutral-500">
                                Generated video · AI-narrated
                            </span>
                        </div>
                        <div className="relative w-full bg-neutral-950" style={{ aspectRatio: '16/9' }}>
                            <iframe
                                src={ED_VIDEO_URL}
                                className="h-full w-full"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowFullScreen
                                title="Enforcement Directorate (ED) in India — Generated Video"
                                loading="lazy"
                            />
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <p className="text-[11px] text-neutral-500">
                                What Vacademy produced from that single prompt.
                            </p>
                            <a
                                href={ED_VIDEO_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 transition-colors hover:text-neutral-700"
                            >
                                Fullscreen
                                <ExternalLink className="size-3" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function StepPromptMock() {
    return (
        <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-3 py-2">
                <div className="size-1.5 rounded-full bg-neutral-300" />
                <div className="size-1.5 rounded-full bg-neutral-300" />
                <div className="size-1.5 rounded-full bg-neutral-300" />
            </div>
            <div className="p-3">
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                    <Sparkles className="size-3.5 shrink-0 text-violet-500" />
                    <span className="text-[11px] text-neutral-700">Explain photosynthesis for Grade 8…</span>
                    <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-neutral-500 align-middle" />
                </div>
                <div className="flex gap-1.5">
                    {['Video', 'Quiz', 'Outline'].map((t) => (
                        <span key={t} className="rounded-md bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-white">{t}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StepGeneratingMock() {
    return (
        <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200 bg-white p-3">
            <div className="mb-2.5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-neutral-600">
                    <div className="size-1.5 animate-pulse rounded-full bg-violet-500" />
                    Generating…
                </div>
                <span className="font-semibold text-neutral-700">78%</span>
            </div>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full w-[78%] rounded-full bg-neutral-900" />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                {[
                    { label: 'Video', icon: FileVideo, done: true },
                    { label: 'Quiz', icon: FileQuestion, done: true },
                    { label: 'Outline', icon: BookOpen, done: false },
                ].map(({ label, icon: Icon, done }) => (
                    <div key={label} className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-colors ${done ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                        <Icon className="size-3.5" />
                        {label}
                    </div>
                ))}
            </div>
        </div>
    );
}

function StepPublishMock() {
    return (
        <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <GraduationCap className="size-3.5 text-neutral-500" />
                    <span className="text-[11px] font-semibold text-neutral-700">Physics — Grade 10</span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">● LIVE</span>
            </div>
            <div className="space-y-1.5">
                {[
                    { label: 'Introduction to Forces', icon: FileVideo, students: 24 },
                    { label: "Newton's Laws Quiz", icon: FileQuestion, students: 18 },
                    { label: 'Course Outline', icon: BookOpen, students: 31 },
                ].map(({ label, icon: Icon, students }) => (
                    <div key={label} className="flex items-center justify-between rounded-lg bg-neutral-50 px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5">
                            <Icon className="size-3 text-neutral-400" />
                            <span className="text-[10px] text-neutral-700">{label}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                            <Users className="size-2.5" />
                            {students}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function HowItWorksSection() {
    const steps = [
        {
            number: '01',
            title: 'Describe your topic',
            description: 'Type any topic, paste a syllabus, or upload content from your curriculum.',
            visual: <StepPromptMock />,
        },
        {
            number: '02',
            title: 'AI generates your content',
            description: 'Models create videos, quizzes, and course outlines — tailored to your students.',
            visual: <StepGeneratingMock />,
        },
        {
            number: '03',
            title: 'Publish & engage',
            description: 'Push content to your course instantly and track student engagement in real time.',
            visual: <StepPublishMock />,
        },
    ];

    return (
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
                <div className="mb-12 text-center">
                    <h2 className="font-serif text-3xl tracking-tight text-neutral-900 sm:text-5xl">
                        From idea to course in minutes
                    </h2>
                    <p className="mt-4 text-base text-neutral-500 sm:text-lg">
                        Three steps. No film crew. No design degree.
                    </p>
                </div>
                <div className="grid gap-6 sm:grid-cols-3">
                    {steps.map((step) => (
                        <div
                            key={step.number}
                            className="relative rounded-[2rem] border border-neutral-200 bg-[#f8f9fa] p-6"
                        >
                            <div className="mb-3 font-serif text-4xl font-light text-neutral-300">
                                {step.number}
                            </div>
                            <h3 className="mb-1.5 text-base font-semibold text-neutral-900">
                                {step.title}
                            </h3>
                            <p className="text-sm leading-relaxed text-neutral-500">
                                {step.description}
                            </p>
                            {step.visual}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

const videoExamples = [
    {
        title: "Kirchhoff's Current Law",
        subject: 'Electrical Engineering',
        prompt: 'create a video on kirchhoff\'s current law',
        url: 'https://dash.vacademy.io/content/vid_1772851385116_hh96sso?timeline=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvid_1772851385116_hh96sso%2Ftimeline%2Ftime_based_frame.json&audio=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvid_1772851385116_hh96sso%2Faudio%2Fnarration.mp3&words=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvid_1772851385116_hh96sso%2Fwords%2Fnarration.words.json',
    },
    {
        title: "Newton's Third Law of Motion",
        subject: 'Physics',
        prompt: "Generate an engaging 2-3 minute AI-narrated explainer video introducing Newton's Third Law of Motion. Use simple animations like a person pushing against a wall or a rocket launching.",
        url: 'https://dash.vacademy.io/content/video-C1-CH1-SL1-94b531ce?timeline=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH1-SL1-94b531ce%2Ftimeline%2Ftime_based_frame.json&audio=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH1-SL1-94b531ce%2Faudio%2Fnarration.mp3&words=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH1-SL1-94b531ce%2Fwords%2Fnarration.words.json',
    },
    {
        title: "Force & Mass in Newton's 2nd Law",
        subject: 'Physics',
        prompt: "Generate an AI-narrated explainer video about Force and Mass in Newton's Second Law. Include clear visual examples showing how force affects objects of different masses.",
        url: 'https://dash.vacademy.io/content/video-C1-CH1-SL1-7a171b48?timeline=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH1-SL1-7a171b48%2Ftimeline%2Ftime_based_frame.json&audio=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH1-SL1-7a171b48%2Faudio%2Fnarration.mp3&words=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH1-SL1-7a171b48%2Fwords%2Fnarration.words.json',
    },
    {
        title: "Newton's 2nd Law: F = ma",
        subject: 'Physics',
        prompt: "Generate an AI-narrated explainer video about Newton's 2nd Law of Motion. Introduce the law stating F=ma (Force equals mass times acceleration). Include clear visual examples.",
        url: 'https://dash.vacademy.io/content/video-C1-CH1-SL1-f6a9883b?timeline=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH1-SL1-f6a9883b%2Ftimeline%2Ftime_based_frame.json&audio=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH1-SL1-f6a9883b%2Faudio%2Fnarration.mp3&words=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH1-SL1-f6a9883b%2Fwords%2Fnarration.words.json',
    },
    {
        title: "Everyday Examples of Newton's 2nd Law",
        subject: 'Physics',
        prompt: "Generate an AI-narrated explainer video showcasing everyday examples of Newton's Second Law — bicycles, soccer balls, strollers, and car acceleration.",
        url: 'https://dash.vacademy.io/content/video-C1-CH2-SL1-fca87efa?timeline=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH2-SL1-fca87efa%2Ftimeline%2Ftime_based_frame.json&audio=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH2-SL1-fca87efa%2Faudio%2Fnarration.mp3&words=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH2-SL1-fca87efa%2Fwords%2Fnarration.words.json',
    },
    {
        title: 'Real-World Applications of Induction Motors',
        subject: 'Electrical Engineering',
        prompt: 'Generate an AI video showing real-world applications of induction motors in factories, water pumps, and HVAC systems. Explain why they are the workhorse of the industry.',
        url: 'https://dash.vacademy.io/content/video-C1-CH3-SL3-03303084?timeline=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH3-SL3-03303084%2Ftimeline%2Ftime_based_frame.json&audio=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH3-SL3-03303084%2Faudio%2Fnarration.mp3&words=https%3A%2F%2Fvacademy-media-storage-public.s3.amazonaws.com%2Fai-videos%2Fvideo-C1-CH3-SL3-03303084%2Fwords%2Fnarration.words.json',
    },
];

const subjectColors: Record<string, string> = {
    'Physics': 'bg-blue-100 text-blue-700',
    'Electrical Engineering': 'bg-amber-100 text-amber-700',
};

function VideoExamplesSection() {
    return (
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-12 text-center">
                    <h2 className="font-serif text-3xl tracking-tight text-neutral-900 sm:text-5xl">
                        Real videos. Generated in seconds.
                    </h2>
                    <p className="mx-auto mt-4 max-w-xl text-base text-neutral-500 sm:text-lg">
                        Every video below was created with a single text prompt — no recording, no
                        editing, no production team.
                    </p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {videoExamples.map((ex) => (
                        <div
                            key={ex.url}
                            className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                        >
                            {/* Embedded video player */}
                            <div className="relative w-full overflow-hidden bg-neutral-950" style={{ aspectRatio: '16/9' }}>
                                <iframe
                                    src={ex.url}
                                    className="h-full w-full"
                                    allow="autoplay; fullscreen; picture-in-picture"
                                    allowFullScreen
                                    title={ex.title}
                                    loading="lazy"
                                />
                            </div>

                            {/* Card metadata */}
                            <div className="flex flex-1 flex-col p-4">
                                <div className="mb-2 flex items-start justify-between gap-2">
                                    <span
                                        className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${subjectColors[ex.subject] ?? 'bg-neutral-100 text-neutral-600'}`}
                                    >
                                        {ex.subject}
                                    </span>
                                    <a
                                        href={ex.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex shrink-0 items-center gap-1 text-[11px] text-neutral-400 transition-colors hover:text-neutral-700"
                                        title="Open in full screen"
                                    >
                                        <ExternalLink className="size-3" />
                                    </a>
                                </div>
                                <h3 className="mb-1 text-sm font-semibold text-neutral-900">
                                    {ex.title}
                                </h3>
                                <p className="line-clamp-2 text-[11px] leading-relaxed text-neutral-500">
                                    <span className="font-medium text-neutral-400">Prompt: </span>
                                    {ex.prompt}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

const aiCapabilities = [
    {
        icon: FileVideo,
        title: 'AI Video Generation',
        description:
            'Turn any text prompt into narrated, animated explainer videos. No filming, no editing skills needed.',
        tag: 'Most used',
        tagColor: 'bg-emerald-100 text-emerald-700',
    },
    {
        icon: FileQuestion,
        title: 'Quiz & Assessment Builder',
        description:
            'Auto-generate MCQs, descriptive questions, and fill-in-the-blank exercises from any topic or chapter.',
        tag: null,
        tagColor: '',
    },
    {
        icon: BookOpen,
        title: 'Course Outline Generator',
        description:
            'Build structured curricula with learning objectives, module sequences, and content hierarchies.',
        tag: null,
        tagColor: '',
    },
    {
        icon: FileText,
        title: 'Worksheet Generator',
        description:
            'Create printable and digital worksheets aligned to your syllabus and difficulty level in seconds.',
        tag: null,
        tagColor: '',
    },
    {
        icon: Gamepad2,
        title: 'Interactive Learning Games',
        description:
            'Transform concepts into engaging games that reinforce learning and keep students coming back.',
        tag: 'New',
        tagColor: 'bg-violet-100 text-violet-700',
    },
    {
        icon: Languages,
        title: 'Multilingual Content',
        description:
            'Generate and adapt content in multiple languages so every student learns in their native tongue.',
        tag: null,
        tagColor: '',
    },
    {
        icon: Wand2,
        title: 'Smart Content Rewriting',
        description:
            'Adapt difficulty, tone, and reading level for different student groups with a single click.',
        tag: null,
        tagColor: '',
    },
    {
        icon: Cpu,
        title: 'Choose Your AI Model',
        description:
            'Pick from Gemini, GPT-4, Claude, and more. Upgrade to premium models for higher-quality output.',
        tag: null,
        tagColor: '',
    },
];

function AiCapabilitiesSection() {
    return (
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-12 max-w-2xl">
                    <h2 className="font-serif text-3xl tracking-tight text-neutral-900 sm:text-5xl">
                        Everything you need to create great content
                    </h2>
                    <p className="mt-4 text-base text-neutral-500 sm:text-lg">
                        One platform. Eight AI-powered tools. Built for educators who don't have
                        time to waste.
                    </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {aiCapabilities.map((cap) => (
                        <div
                            key={cap.title}
                            className="group relative flex flex-col rounded-[1.5rem] border border-neutral-200 bg-[#f8f9fa] p-6 transition-colors hover:border-neutral-300 hover:bg-white"
                        >
                            {cap.tag && (
                                <span
                                    className={`mb-3 inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cap.tagColor}`}
                                >
                                    {cap.tag}
                                </span>
                            )}
                            <div className="mb-4 flex size-10 items-center justify-center rounded-2xl bg-white shadow-sm">
                                <cap.icon className="size-5 text-neutral-700" />
                            </div>
                            <h3 className="mb-1.5 text-sm font-semibold text-neutral-900">
                                {cap.title}
                            </h3>
                            <p className="text-xs leading-relaxed text-neutral-500">
                                {cap.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

const CODE_SAMPLE = `curl -X POST https://api.vacademy.io/v1/generate/video \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Explain photosynthesis for Grade 8 students",
    "language": "en",
    "model": "standard"
  }'`;

function DeveloperSection() {
    return (
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-neutral-900">
                <div className="grid gap-0 lg:grid-cols-2">
                    <div className="p-8 sm:p-12 lg:p-16">
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">
                            <Code2 className="size-3" />
                            REST API
                        </div>
                        <h2 className="font-serif text-3xl tracking-tight text-white sm:text-4xl">
                            Build with the
                            <br />
                            Vacademy Content API
                        </h2>
                        <p className="mt-4 text-base leading-relaxed text-neutral-400">
                            Integrate AI content generation directly into your LMS, app, or
                            internal workflow. Generate videos, quizzes, and course materials
                            programmatically.
                        </p>
                        <ul className="mt-6 space-y-2.5">
                            {[
                                'Generate videos from text prompts',
                                'Streaming & async job support',
                                'Multi-language content generation',
                                'Simple API key authentication',
                                'Quiz & outline generation endpoints',
                            ].map((item) => (
                                <li
                                    key={item}
                                    className="flex items-center gap-2.5 text-sm text-neutral-400"
                                >
                                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                        <Link
                            to="/video-api-studio"
                            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-transform hover:scale-105"
                        >
                            View API Documentation
                            <ArrowRight className="size-4" />
                        </Link>
                    </div>
                    <div className="flex items-center bg-neutral-800/50 p-6 sm:p-8 lg:p-10">
                        <div className="w-full overflow-hidden rounded-2xl bg-neutral-950">
                            <div className="flex items-center gap-1.5 border-b border-neutral-800 px-4 py-3">
                                <div className="size-2.5 rounded-full bg-neutral-700" />
                                <div className="size-2.5 rounded-full bg-neutral-700" />
                                <div className="size-2.5 rounded-full bg-neutral-700" />
                                <div className="ml-3 flex items-center gap-1.5">
                                    <Terminal className="size-3 text-neutral-500" />
                                    <span className="text-[11px] text-neutral-500">shell</span>
                                </div>
                            </div>
                            <pre className="overflow-x-auto p-5 text-[11px] leading-relaxed text-neutral-300">
                                <code>{CODE_SAMPLE}</code>
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function PricingSection() {
    return (
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl rounded-[2.5rem] bg-[#f8f9fa] p-8 sm:p-12 lg:p-16">
                <div className="mb-10 max-w-2xl">
                    <h2 className="font-serif text-3xl tracking-tight text-neutral-900 sm:text-5xl">
                        Simple, credit-based pricing
                    </h2>
                    <p className="mt-4 text-base text-neutral-500 sm:text-lg">
                        Pay only for what you generate. Every institute starts with 200 free
                        credits.
                    </p>
                </div>
                <div className="mb-10 flex items-center gap-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-100">
                        <Gift className="size-6 text-neutral-700" />
                    </div>
                    <div>
                        <div className="text-base font-medium text-neutral-900">
                            200 Free Credits on Signup
                        </div>
                        <div className="mt-1 text-sm text-neutral-500">
                            Start creating immediately — no credit card required. Plus, some AI
                            models are completely free to use.
                        </div>
                    </div>
                </div>
                <div className="mb-12 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
                    <div className="border-b border-neutral-100 px-6 py-4">
                        <div className="flex items-center gap-2">
                            <Coins className="size-5 text-neutral-900" />
                            <span className="text-base font-medium text-neutral-900">
                                Credit Costs by Content Type
                            </span>
                        </div>
                    </div>
                    <div className="divide-y divide-neutral-100">
                        {creditCosts.map((item) => (
                            <div
                                key={item.feature}
                                className="flex items-center justify-between px-6 py-4"
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon className="size-5 text-neutral-400" />
                                    <span className="text-sm font-medium text-neutral-700">
                                        {item.feature}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-base font-semibold text-neutral-900">
                                        {item.cost}
                                    </span>
                                    <span className="ml-1 text-xs text-neutral-500">
                                        credits {item.unit}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    {pricingTiers.map((tier) => (
                        <div key={tier.name} className={`rounded-3xl border p-6 ${tier.color}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <tier.icon className="size-5 text-neutral-700" />
                                    <span className="text-base font-medium text-neutral-900">
                                        {tier.name}
                                    </span>
                                </div>
                                <span
                                    className={`rounded-xl px-2 py-1 text-xs font-bold ${tier.badge}`}
                                >
                                    {tier.multiplier}
                                </span>
                            </div>
                            <div className="mt-3 text-xs leading-relaxed text-neutral-500">
                                {tier.models}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

const faqs = [
    {
        q: 'What are credits and how do they work?',
        a: 'Credits are the currency for AI generation on Vacademy. Every institute receives 200 free credits on signup...',
    },
    {
        q: 'Are there any free AI models I can use?',
        a: 'Yes! Several models are completely free to use with 0 credit consumption...',
    },
    {
        q: 'How much does it cost to generate a video?',
        a: 'Video generation costs a flat rate of 5 credits per video...',
    },
];

function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-neutral-200 py-5 last:border-b-0">
            <button
                onClick={() => setOpen(!open)}
                className="flex w-full items-start justify-between gap-4 text-left"
            >
                <span className="text-base font-medium text-neutral-900">{q}</span>
                <ChevronDown
                    className={`mt-0.5 size-5 shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && <div className="mt-3 pr-8 text-sm leading-relaxed text-neutral-500">{a}</div>}
        </div>
    );
}

function FaqSection() {
    return (
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
                <h2 className="mb-8 text-center font-serif text-3xl tracking-tight text-neutral-900 sm:text-4xl">
                    Frequently asked questions
                </h2>
                <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
                    {faqs.map((faq) => (
                        <FaqItem key={faq.q} q={faq.q} a={faq.a} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function PersonasSection() {
    const [activeTab, setActiveTab] = useState(0);
    const tabs = ['Teachers', 'Administrators', 'Tutors', 'Creators'];
    const backgrounds = [
        'bg-gradient-to-br from-emerald-800 to-emerald-950',
        'bg-gradient-to-br from-blue-800 to-blue-950',
        'bg-gradient-to-br from-amber-700 to-amber-900',
        'bg-gradient-to-br from-violet-800 to-violet-950',
    ];
    const content = [
        'Teachers. For educators who want to spend less time planning and more time teaching. Generate quizzes and worksheets in seconds.',
        'Administrators. Build entire course curriculums aligned with institutional standards across multiple departments.',
        'Tutors. Create personalized learning paths and interactive games to keep individual students engaged.',
        'Creators. Produce high-quality, narrated AI explainer videos without any editing skills or expensive software.',
    ];

    return (
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
                <h2 className="mb-10 font-serif text-3xl tracking-tight text-neutral-900 sm:text-5xl">
                    Designed for busy professionals like you
                </h2>
                <div className="mb-8 flex flex-wrap justify-center gap-4 border-b border-neutral-200 sm:gap-8">
                    {tabs.map((tab, i) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(i)}
                            className={`relative px-2 py-4 text-base font-medium transition-colors ${activeTab === i ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                        >
                            {tab}
                            {activeTab === i && (
                                <div className="absolute bottom-0 left-0 h-0.5 w-full bg-neutral-900" />
                            )}
                        </button>
                    ))}
                </div>
                <div
                    className={`relative flex min-h-[400px] flex-col justify-end overflow-hidden rounded-[2.5rem] p-8 text-left shadow-lg transition-colors duration-500 sm:p-12 ${backgrounds[activeTab]}`}
                >
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                    <div className="relative z-10 max-w-xl">
                        <h3 className="mb-6 font-serif text-2xl leading-snug text-white sm:text-3xl">
                            {(content[activeTab] || '').split('.')[0]}.
                            <br />
                            <span className="mt-2 block font-sans text-lg font-normal leading-relaxed text-white/80 sm:text-xl">
                                {(content[activeTab] || '').split('.').slice(1).join('.').trim()}
                            </span>
                        </h3>
                        <Link
                            to="/signup/onboarding"
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-transform hover:scale-105"
                        >
                            Get Started Free
                            <ArrowRight className="size-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

function SecuritySection() {
    return (
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
                <h2 className="mb-6 font-serif text-3xl tracking-tight text-neutral-900 sm:text-5xl">
                    We care about data security
                </h2>
                <p className="mx-auto mb-8 max-w-xl text-base text-neutral-500 sm:text-lg">
                    That's why we implement enterprise-grade security standards to ensure your
                    institution's data, student information, and generated content are protected.
                    Our compliance process is in progress.
                </p>
                <div className="inline-flex flex-col items-center">
                    <div className="mb-2 flex h-24 w-20 flex-col items-center justify-center rounded border border-neutral-100 bg-white p-2 shadow-[0_0_15px_rgba(0,0,0,0.05)]">
                        <Shield className="mb-1 size-8 text-blue-600" />
                        <div className="text-[10px] font-bold text-neutral-900">SECURITY</div>
                    </div>
                    <div className="text-[10px] font-medium text-neutral-400">
                        MONITORED BY VACADEMY
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function ExploreLandingPage() {
    const [loginOpen, setLoginOpen] = useState(false);

    return (
        <div className="flex min-h-screen w-full flex-col bg-white font-sans text-neutral-900">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap');
                .font-serif {
                    font-family: 'Newsreader', ui-serif, Georgia, Cambria, "Times New Roman", Times, serif !important;
                    letter-spacing: -0.04em;
                }
            `}</style>
            <header className="sticky top-0 z-50 border-b border-transparent bg-white/80 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <img src="/Urbanist.png" alt="Vacademy" className="h-8 w-auto" />
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setLoginOpen(true)}
                            className="hidden text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 sm:block"
                        >
                            Log in
                        </button>
                        <Link
                            to="/signup/onboarding"
                            className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                <section className="bg-white px-4 pb-12 pt-20 text-center sm:px-6 lg:px-8">
                    <div className="mx-auto flex max-w-4xl flex-col items-center">
                        <div className="mb-8 inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50">
                            <span role="img" aria-label="party popper">
                                🎉
                            </span>{' '}
                            Now available for Early Access!
                        </div>

                        <h1 className="mb-6 text-center font-serif text-5xl leading-[1.05] tracking-tight text-neutral-900 sm:text-7xl lg:text-[5.5rem] lg:leading-[1.02]">
                            Plug in your curriculum.
                            <br />
                            Get real content.
                        </h1>

                        <p className="mx-auto mb-10 max-w-3xl text-center text-lg leading-relaxed text-neutral-500 sm:text-[1.35rem]">
                            Vacademy connects to your curriculum, analyzes your goals, and gives
                            AI-powered content generation tailored to your students.
                        </p>

                        <div className="mb-16 flex justify-center">
                            <Link
                                to="/signup/onboarding"
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-neutral-900/10 transition-opacity hover:bg-neutral-800"
                            >
                                Get started
                                <ChevronRight className="ml-1 size-4" />
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="relative overflow-hidden bg-white px-4 pb-20 sm:px-6 lg:px-8">
                    <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(124,58,237,0.06),transparent)]" />
                    <HeroDemoWidget />
                </section>

                <RealDemoSection />

                <HowItWorksSection />

                <VideoExamplesSection />

                <SecuritySection />

                <AiCapabilitiesSection />

                <PersonasSection />

                <DeveloperSection />

                <PricingSection />

                <FaqSection />
            </main>

            <footer className="border-t border-neutral-100 bg-white px-4 py-8 text-center text-sm text-neutral-500 sm:px-6 lg:px-8">
                <p>&copy; {new Date().getFullYear()} Vacademy. All rights reserved.</p>
            </footer>

            <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
        </div>
    );
}
