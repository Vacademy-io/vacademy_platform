'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Menu, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from '@tanstack/react-router';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function JoinSessionPopover() {
    const [sessionCode, setSessionCode] = useState('');

    const handleJoinSession = () => {
        if (sessionCode.trim()) {
            window.open(
                `https://${import.meta.env.VITE_ENGAGE_DOMAIN || 'engage.vacademy.io'}/${sessionCode.trim()}`,
                '_blank'
            );
        }
    };

    return (
        <div className="grid gap-4 p-4">
            <div className="space-y-2">
                <h4 className="font-medium leading-none">Join Session</h4>
                <p className="text-sm text-muted-foreground">
                    Enter the code to join a live session.
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Input
                    id="session-code"
                    placeholder="Enter Code"
                    className="flex-1 text-center font-semibold tracking-wider"
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleJoinSession()}
                />
                <Button
                    onClick={handleJoinSession}
                    disabled={!sessionCode.trim()}
                    className="bg-orange-500 text-white hover:bg-orange-600"
                >
                    <ArrowRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}

export function Header() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const handleScroll = (): void => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    }, [isMenuOpen]);

    return (
        <>
            <motion.header
                className={cn(
                    'fixed left-0 right-0 top-0 z-50 transition-all duration-300',
                    isScrolled ? 'bg-white/80 shadow-md backdrop-blur-sm' : 'bg-transparent'
                )}
            >
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-20 items-center justify-between">
                        <div
                            className="flex cursor-pointer items-center gap-2"
                            onClick={() => router.navigate({ to: '/landing' })}
                        >
                            <Zap className="size-7 text-orange-500" />
                            <span className="text-2xl font-bold tracking-tight text-slate-900">
                                Volt
                            </span>
                        </div>
                        {/* Desktop Menu */}
                        <div className="hidden items-center gap-2 md:flex">
                            <Button
                                variant="ghost"
                                onClick={() => router.navigate({ to: '/pricing' })}
                            >
                                Pricing
                            </Button>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost">Join</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80">
                                    <JoinSessionPopover />
                                </PopoverContent>
                            </Popover>

                            <div className="h-6 w-px bg-slate-200" />

                            <Button
                                variant="ghost"
                                onClick={() => router.navigate({ to: '/login' })}
                            >
                                Sign In
                            </Button>
                            <Button
                                onClick={() =>
                                    router.navigate({
                                        to: '/signup/onboarding',
                                        search: { assess: true, lms: true },
                                    })
                                }
                                className="bg-slate-800 text-white hover:bg-slate-700"
                            >
                                Get Started
                            </Button>
                        </div>
                        {/* Mobile Menu Button */}
                        <div className="md:hidden">
                            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(true)}>
                                <Menu className="size-6" />
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.header>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="fixed right-0 top-0 size-full max-w-xs bg-white p-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Zap className="size-7 text-orange-500" />
                                    <span className="text-2xl font-bold tracking-tight text-slate-900">
                                        Volt
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <X className="size-6" />
                                </Button>
                            </div>
                            <div className="mt-10 flex flex-col space-y-4">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={() => router.navigate({ to: '/pricing' })}
                                >
                                    Pricing
                                </Button>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="lg">
                                            Join a Session
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                        <JoinSessionPopover />
                                    </PopoverContent>
                                </Popover>
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={() => {
                                        router.navigate({ to: '/login' });
                                        setIsMenuOpen(false);
                                    }}
                                >
                                    Sign In
                                </Button>
                                <Button
                                    size="lg"
                                    className="bg-slate-800 text-white hover:bg-slate-700"
                                    onClick={() => {
                                        router.navigate({
                                            to: '/signup/onboarding',
                                            search: { assess: true, lms: true },
                                        });
                                        setIsMenuOpen(false);
                                    }}
                                >
                                    Get Started for Free
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
