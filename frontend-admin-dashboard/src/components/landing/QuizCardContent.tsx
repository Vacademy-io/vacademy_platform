import { motion } from 'framer-motion';
import { Check, Send } from 'lucide-react';

const quiz = {
    question: 'What is the primary benefit of using Volt for presentations?',
    options: [
        "It's free",
        'It supports offline mode',
        'It fosters active audience engagement',
        'It has the most slide templates',
    ],
    correctAnswer: 2,
};

export const QuizCardContent = () => {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-200">
            <div className="relative h-[500px] w-[280px] overflow-hidden rounded-[40px] border-4 border-slate-800 bg-white shadow-2xl">
                {/* Notch */}
                <div className="absolute left-1/2 top-0 h-6 w-32 -translate-x-1/2 rounded-b-lg bg-slate-800"></div>

                <div className="p-6 pt-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">
                            Question 1 of 5
                        </p>
                        <h2 className="mt-2 text-lg font-bold leading-tight text-slate-800">
                            {quiz.question}
                        </h2>
                    </motion.div>

                    <motion.div
                        className="mt-6 space-y-3"
                        initial="hidden"
                        animate="visible"
                        variants={{
                            hidden: { opacity: 0 },
                            visible: {
                                opacity: 1,
                                transition: { staggerChildren: 0.2, delayChildren: 0.5 },
                            },
                        }}
                    >
                        {quiz.options.map((option, index) => (
                            <motion.div
                                key={index}
                                className="flex cursor-pointer items-center rounded-lg border border-slate-200 bg-slate-50 p-3"
                                variants={{
                                    hidden: { opacity: 0, x: -20 },
                                    visible: { opacity: 1, x: 0 },
                                }}
                            >
                                <div className="mr-3 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-300">
                                    {index === quiz.correctAnswer && (
                                        <div className="size-2.5 rounded-full bg-orange-500"></div>
                                    )}
                                </div>
                                <span className="text-sm text-slate-700">{option}</span>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
                {/* Bottom bar */}
                <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Ask a follow-up..."
                            className="flex-1 rounded-full bg-slate-100 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                        <button className="rounded-full bg-orange-500 p-2 text-white">
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
