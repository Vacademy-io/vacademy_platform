import { useState } from 'react';
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
                    <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-xl bg-neutral-900 text-white">
                            <Bot className="size-5" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">Vacademy</span>
                    </div>
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

                <section className="relative flex justify-center overflow-hidden bg-white px-4 pb-20 sm:px-6 lg:px-8">
                    <div className="relative z-10 flex w-full max-w-3xl justify-center">
                        <img
                            src="/hero-mockup.png"
                            alt="Dashboard Mockup"
                            className="relative z-10 max-h-[700px] w-auto rounded-[2.5rem] border border-white/20 object-cover shadow-2xl"
                        />
                        <div className="absolute inset-0 -z-10 scale-75 rounded-full bg-emerald-500/10 blur-[100px]" />
                    </div>
                </section>

                <SecuritySection />

                <PersonasSection />

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
