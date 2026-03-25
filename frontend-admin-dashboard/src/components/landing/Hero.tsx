'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useRouter } from '@tanstack/react-router';
import { Zap, Mic, Bot, BarChart, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function Hero() {
    const router = useRouter();
    const [sessionCode, setSessionCode] = useState('');

    const handleJoinSession = () => {
        if (sessionCode.trim()) {
            window.open(`https://engage.vacademy.io/${sessionCode.trim()}`, '_blank');
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5,
            },
        },
    };

    return (
        <section className="relative overflow-hidden bg-slate-50">
            <div className="px-4 pb-20 pt-32 sm:px-0">
                <div className="container mx-auto text-center sm:px-6 lg:px-8">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="relative z-10"
                    >
                        <motion.div
                            variants={itemVariants}
                            className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1 text-sm font-medium text-orange-600"
                        >
                            <Zap className="size-4" />
                            <span>Presentations, Reimagined</span>
                        </motion.div>

                        <motion.h1
                            variants={itemVariants}
                            className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl"
                        >
                            Turn Passive Lectures into
                            <br />
                            <span className="relative inline-block px-2">
                                <span className="absolute inset-0 -skew-x-12 bg-orange-500" />
                                <span className="relative text-white">Active Experiences</span>
                            </span>
                        </motion.h1>

                        <motion.p
                            variants={itemVariants}
                            className="mx-auto mt-6 max-w-2xl px-4 text-lg text-slate-600 sm:px-0"
                        >
                            Volt is the AI-powered live presentation platform that makes learning
                            active and engaging. Create interactive content in seconds and get
                            real-time feedback from your audience.
                        </motion.p>

                        <motion.div
                            variants={itemVariants}
                            className="mt-8 flex flex-col items-center justify-center gap-4 px-4 sm:flex-row sm:px-0"
                        >
                            <Button
                                size="lg"
                                onClick={() =>
                                    router.navigate({
                                        to: '/signup/onboarding',
                                        search: { assess: true, lms: true },
                                    })
                                }
                                className="w-full bg-slate-800 text-white shadow-lg transition-transform hover:scale-105 hover:bg-slate-700 sm:w-auto"
                            >
                                Get Started for Free
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full sm:w-auto"
                                onClick={() => {
                                    const featuresSection = document.getElementById('features');
                                    if (featuresSection) {
                                        featuresSection.scrollIntoView({ behavior: 'smooth' });
                                    }
                                }}
                            >
                                See Features
                            </Button>
                        </motion.div>

                        <motion.div
                            variants={itemVariants}
                            className="mx-auto mt-12 w-full max-w-md"
                        >
                            <p className="mb-2 text-sm font-medium text-slate-500">
                                Already have a code? Join a session now.
                            </p>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="text"
                                    placeholder="Enter session code..."
                                    className="flex-1 text-center font-semibold tracking-wider"
                                    value={sessionCode}
                                    onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                                    onKeyPress={(e) => e.key === 'Enter' && handleJoinSession()}
                                />
                                <Button
                                    className="bg-orange-500 text-white hover:bg-orange-600"
                                    onClick={handleJoinSession}
                                    disabled={!sessionCode.trim()}
                                >
                                    Join <ArrowRight className="ml-2 size-4" />
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Animated background icons */}
                    <motion.div
                        className="absolute inset-0 z-0"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <motion.div
                            variants={itemVariants}
                            className="absolute left-1/4 top-1/4 -translate-x-1/2 -translate-y-1/2 text-orange-100"
                        >
                            <Bot size={64} />
                        </motion.div>
                        <motion.div
                            variants={itemVariants}
                            className="absolute right-1/4 top-1/2 text-blue-100"
                        >
                            <Mic size={48} />
                        </motion.div>
                        <motion.div
                            variants={itemVariants}
                            className="absolute bottom-1/4 right-1/3 text-green-100"
                        >
                            <BarChart size={56} />
                        </motion.div>
                        <motion.div
                            variants={itemVariants}
                            className="absolute bottom-1/3 left-1/3 text-purple-100"
                        >
                            <Zap size={40} />
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
