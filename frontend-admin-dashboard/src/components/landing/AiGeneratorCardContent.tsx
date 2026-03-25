import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, FileText, BrainCircuit, Sparkles, CheckCircle, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const aiSteps = [
    { text: 'Analyzing your topic...', icon: BrainCircuit },
    { text: 'Structuring the outline...', icon: FileText },
    { text: 'Drafting content for each slide...', icon: Bot },
    { text: 'Creating assessment questions...', icon: Sparkles },
    { text: 'Finalizing your Volt...', icon: CheckCircle },
];

const promptText = 'The impact of renewable energy on climate change';

export const AiGeneratorCardContent = () => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [typedPrompt, setTypedPrompt] = useState('');

    useEffect(() => {
        const typingTimeout = setTimeout(() => {
            let i = 0;
            const typingInterval = setInterval(() => {
                setTypedPrompt(promptText.substring(0, i + 1));
                i++;
                if (i > promptText.length) {
                    clearInterval(typingInterval);
                    setTimeout(() => setIsGenerating(true), 1000);
                }
            }, 50);
            return () => clearInterval(typingInterval);
        }, 1000);

        return () => clearTimeout(typingTimeout);
    }, []);

    useEffect(() => {
        if (!isGenerating) return;

        const stepDuration = 1500;
        const interval = setInterval(() => {
            setCurrentStepIndex((prev) => {
                if (prev < aiSteps.length - 1) {
                    return prev + 1;
                }
                clearInterval(interval);
                return prev;
            });
        }, stepDuration);

        return () => clearInterval(interval);
    }, [isGenerating]);

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-4">
            <div className="h-[320px] w-full max-w-sm rounded-lg bg-white p-6 shadow-md">
                <AnimatePresence mode="wait">
                    {!isGenerating ? (
                        <motion.div
                            key="prompt"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="mb-4 flex items-center gap-3">
                                <Wand2 className="text-orange-500" size={24} />
                                <h3 className="text-md font-semibold text-slate-700">
                                    AI Presentation Generator
                                </h3>
                            </div>
                            <div className="relative w-full">
                                <p className="min-h-[44px] rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                                    {typedPrompt}
                                    <motion.span
                                        className="inline-block h-4 w-0.5 bg-orange-500"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: [0, 1, 0] }}
                                        transition={{
                                            duration: 1,
                                            repeat: Infinity,
                                            repeatDelay: 0.5,
                                        }}
                                    />
                                </p>
                            </div>
                            <button className="mt-4 w-full cursor-not-allowed rounded-md bg-orange-500 py-2 font-semibold text-white opacity-50">
                                Generate
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="generating"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="flex flex-col items-center justify-center space-y-2">
                                <div className="relative">
                                    <Bot className="size-10 text-orange-500" />
                                    <Sparkles className="absolute -right-1 -top-1 size-4 text-yellow-400" />
                                </div>
                                <h2 className="text-md text-center font-bold text-neutral-800">
                                    Creating your Volt...
                                </h2>
                            </div>
                            <div className="w-full space-y-2 pt-4">
                                {aiSteps.map((step, index) => {
                                    const Icon = step.icon;
                                    const isActive = index === currentStepIndex;
                                    const isCompleted = index < currentStepIndex;

                                    return (
                                        <div
                                            key={index}
                                            className="flex items-center space-x-3 transition-all duration-300"
                                        >
                                            <div className="flex size-6 items-center justify-center">
                                                {isCompleted ? (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                    >
                                                        <CheckCircle className="size-5 text-green-500" />
                                                    </motion.div>
                                                ) : (
                                                    <div className="relative flex size-5 items-center justify-center">
                                                        {isActive && (
                                                            <motion.div
                                                                className="absolute size-full rounded-full bg-orange-200"
                                                                animate={{
                                                                    scale: [1, 1.5, 1],
                                                                    opacity: [0.5, 1, 0.5],
                                                                }}
                                                                transition={{
                                                                    duration: 1.5,
                                                                    repeat: Infinity,
                                                                }}
                                                            />
                                                        )}
                                                        <Icon
                                                            className={cn(
                                                                `h-4 w-4 transition-colors duration-300`,
                                                                isActive
                                                                    ? 'text-orange-600'
                                                                    : 'text-neutral-400'
                                                            )}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <span
                                                className={cn(
                                                    `text-sm transition-colors duration-300`,
                                                    {
                                                        'font-semibold text-orange-600': isActive,
                                                        'text-neutral-700 line-through decoration-green-500':
                                                            isCompleted,
                                                        'text-neutral-500':
                                                            !isActive && !isCompleted,
                                                    }
                                                )}
                                            >
                                                {step.text}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
