import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Mic, Wand2 } from 'lucide-react';
import { useState, useEffect } from 'react';

const fullText =
    "...and as you can see from the data, the engagement metrics have increased by over 20% since we implemented Volt. The key takeaway here is that interactive learning isn't just a buzzword; it's a measurable strategy for success. Any questions on this part?";
const words = fullText.split(' ');

export const AudioTranscriptionContent = () => {
    const [transcribedWords, setTranscribedWords] = useState<string[]>([]);
    const [showInsight, setShowInsight] = useState(false);

    useEffect(() => {
        setTranscribedWords([]);
        setShowInsight(false);
        let currentWordIndex = 0;

        const timer = setInterval(() => {
            if (currentWordIndex < words.length) {
                const nextWord = words[currentWordIndex];
                if (nextWord) {
                    setTranscribedWords((prev) => [...prev, nextWord]);
                }
                currentWordIndex++;
            } else {
                setShowInsight(true);
                // After showing the insight, reset after a delay to loop the animation
                setTimeout(() => {
                    setTranscribedWords([]);
                    setShowInsight(false);
                    currentWordIndex = 0;
                }, 4000); // Wait 4s before restarting
            }
        }, 150); // Speed of transcription

        return () => clearInterval(timer);
    }, []);

    const waveformVariants: Variants = {
        animate: {
            pathLength: [0, 1, 0],
            transition: {
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
            },
        },
    };

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-purple-50 p-4">
            <motion.div
                className="w-full max-w-sm rounded-lg bg-white p-6 shadow-md"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <div className="flex items-center gap-3">
                    <Mic className="text-purple-500" size={24} />
                    <h3 className="text-md font-semibold text-slate-700">Live Transcription</h3>
                </div>

                {/* Waveform */}
                <div className="my-2 flex h-10 items-center justify-center space-x-1">
                    <svg width="100%" height="40" className="stroke-purple-300">
                        <g>
                            {[...Array(5)].map((_, i) => (
                                <motion.path
                                    key={i}
                                    d={`M${10 + i * 20},20 Q${15 + i * 20},${10 + Math.random() * 20},${
                                        20 + i * 20
                                    },20 T${30 + i * 20},20`}
                                    strokeWidth="2"
                                    fill="none"
                                    strokeLinecap="round"
                                    variants={waveformVariants}
                                    animate="animate"
                                />
                            ))}
                        </g>
                    </svg>
                </div>

                <div className="h-24 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-600">
                        {transcribedWords.map((word, i) => (
                            <motion.span
                                key={i}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3 }}
                                className="mr-1"
                            >
                                {word}
                            </motion.span>
                        ))}
                    </p>
                </div>

                <AnimatePresence>
                    {showInsight && (
                        <motion.div
                            className="mt-4 border-t border-slate-200 pt-4"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                transition: { delay: 0.5, duration: 0.5 },
                            }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="mb-2 flex items-center gap-3">
                                <Wand2 className="text-purple-500" size={20} />
                                <h4 className="text-sm font-semibold text-slate-600">
                                    AI-Generated Insight
                                </h4>
                            </div>
                            <p className="rounded-md border border-purple-200 bg-purple-50 p-2 text-xs text-purple-800">
                                This section about a &qout;20% increase in engagement&qout; is a
                                strong point. Consider creating a new slide with a large chart to
                                visualize this data.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
