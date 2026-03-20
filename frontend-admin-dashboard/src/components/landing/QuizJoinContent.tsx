import { motion, Transition } from 'framer-motion';
import { QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';

const quiz = {
    question: 'What is the primary benefit of using Volt?',
    options: ['It fosters active audience engagement', "It's free", 'It supports offline mode'],
    correctAnswer: 0,
};

const MockQrCode = () => (
    <svg viewBox="0 0 100 100" className="size-full">
        <rect width="30" height="30" fill="black" />
        <rect x="70" width="30" height="30" fill="black" />
        <rect y="70" width="30" height="30" fill="black" />
        <rect x="10" y="10" width="10" height="10" fill="white" />
        <rect x="80" y="10" width="10" height="10" fill="white" />
        <rect x="10" y="80" width="10" height="10" fill="white" />
        <rect x="40" y="0" width="10" height="10" fill="black" />
        <rect x="60" y="20" width="10" height="10" fill="black" />
        <rect x="0" y="40" width="10" height="10" fill="black" />
        <rect x="20" y="60" width="10" height="10" fill="black" />
        <rect x="40" y="40" width="20" height="20" fill="black" />
        <rect x="70" y="40" width="10" height="10" fill="black" />
        <rect x="40" y="70" width="10" height="10" fill="black" />
        <rect x="90" y="60" width="10" height="10" fill="black" />
        <rect x="70" y="90" width="10" height="10" fill="black" />
        <rect x="90" y="90" width="10" height="10" fill="black" />
    </svg>
);

export const QuizJoinContent = () => {
    const [animationState, setAnimationState] = useState('laptop');

    useEffect(() => {
        const sequence = ['laptop', 'mobile', 'hidden'];
        let currentIndex = 0;

        const interval = setInterval(() => {
            currentIndex = (currentIndex + 1) % sequence.length;
            const nextState = sequence[currentIndex];
            if (nextState) {
                setAnimationState(nextState);
            }
        }, 2500); // Tweak duration for the right feel (2.5s per state)

        return () => clearInterval(interval);
    }, []);

    const laptopVariants = {
        hidden: { opacity: 0, x: -50, scale: 0.9 },
        laptop: { opacity: 1, x: 0, scale: 1 },
        mobile: { opacity: 1, x: 0, scale: 1 }, // Keep laptop visible when mobile appears
    };

    const mobileVariants = {
        hidden: { opacity: 0, x: 50, scale: 0.9 },
        laptop: { opacity: 0, x: 50, scale: 0.9 }, // Mobile is hidden when laptop is shown
        mobile: { opacity: 1, x: 0, scale: 1 },
    };

    const transition: Transition = { duration: 0.8, ease: 'easeInOut' };

    return (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-slate-100 p-4">
            <div className="relative flex size-full scale-[0.7] flex-col items-center justify-center gap-2 md:scale-[0.8] lg:scale-100 lg:flex-row lg:gap-8">
                {/* Laptop */}
                <motion.div
                    className="relative h-auto w-[320px] shrink-0 lg:w-[400px]"
                    variants={laptopVariants}
                    animate={animationState}
                    transition={transition}
                >
                    <div className="flex h-auto flex-col items-center justify-center rounded-t-lg border-4 border-b-0 border-slate-300 bg-white p-4 shadow-lg">
                        <QrCode className="text-orange-500" size={24} />
                        <h3 className="text-md mt-1 font-bold text-slate-800">Join the Session</h3>
                        <p className="text-xs text-slate-500">Scan to participate</p>
                        <div className="mt-2 size-20">
                            <MockQrCode />
                        </div>
                    </div>
                    <div className="absolute -left-[5%] bottom-0 h-3 w-[110%] rounded-b-md bg-slate-200"></div>
                </motion.div>

                {/* Mobile */}
                <motion.div
                    className="relative h-auto w-[150px] shrink-0 overflow-hidden rounded-[20px] border-2 border-slate-300 bg-white shadow-lg lg:w-[180px]"
                    variants={mobileVariants}
                    animate={animationState}
                    transition={transition}
                >
                    <div className="absolute left-1/2 top-0 h-3 w-12 -translate-x-1/2 rounded-b-md bg-slate-300"></div>
                    <div className="p-2 pt-5">
                        <p className="text-[9px] font-semibold uppercase text-orange-500">
                            Question 1/5
                        </p>
                        <h2 className="mt-1 text-xs font-bold leading-tight text-slate-800">
                            {quiz.question}
                        </h2>
                        <div className="mt-2 space-y-1.5">
                            {quiz.options.map((option, index) => (
                                <div
                                    key={index}
                                    className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-1.5"
                                >
                                    <div className="mr-1.5 flex size-3 shrink-0 items-center justify-center rounded-full border border-slate-300">
                                        {index === quiz.correctAnswer && (
                                            <div className="size-1.5 rounded-full bg-orange-500"></div>
                                        )}
                                    </div>
                                    <span className="text-[10px] leading-tight text-slate-700">
                                        {option}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
