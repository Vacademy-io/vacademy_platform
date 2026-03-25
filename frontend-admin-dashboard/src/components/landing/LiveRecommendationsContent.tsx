import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Mic, PlusCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

const recommendations = [
    { text: 'Create a poll for this question?', icon: Lightbulb },
    { text: 'Summarize the key points?', icon: Lightbulb },
    { text: 'Add an action items slide?', icon: Lightbulb },
];

export const LiveRecommendationsContent = () => {
    const [currentRecommendation, setCurrentRecommendation] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentRecommendation((prev) => (prev + 1) % recommendations.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-slate-100 p-4">
            <div className="relative flex size-full scale-[0.85] flex-col items-center justify-center md:scale-100">
                {/* Mock Slide Content */}
                <motion.div
                    className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-xl"
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <h3 className="text-xl font-bold text-slate-800">Quarterly Growth Metrics</h3>
                    <p className="mt-2 text-slate-500">
                        "Based on these results, what should be our next steps?"
                    </p>
                </motion.div>

                {/* Live Bar */}
                <div className="absolute bottom-10 flex w-full max-w-md justify-center">
                    <div className="flex items-center gap-4 rounded-full bg-black/50 px-6 py-2 text-white backdrop-blur-sm">
                        <Mic size={20} />
                        <span className="text-sm font-medium">Listening...</span>
                    </div>
                </div>

                {/* Animated Recommendation */}
                <div className="absolute top-12 flex w-full max-w-md justify-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentRecommendation}
                            initial={{ opacity: 0, y: -20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                            className="flex items-center gap-3 rounded-full bg-orange-500 px-4 py-2 text-white shadow-2xl"
                        >
                            <Lightbulb size={18} />
                            <span className="text-sm font-semibold">
                                {recommendations[currentRecommendation]?.text}
                            </span>
                            <PlusCircle
                                size={20}
                                className="ml-2 cursor-pointer transition-transform hover:scale-110"
                            />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
