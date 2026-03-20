'use client';
import { Zap, Twitter, Github, Youtube } from 'lucide-react';
import { useRouter } from '@tanstack/react-router';

export function Footer() {
    const router = useRouter();

    const handleScrollLink = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        e.preventDefault();
        if (href.startsWith('#')) {
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            router.navigate({ to: href });
        }
    };

    return (
        <footer className="bg-slate-50">
            <div className="mx-auto max-w-7xl overflow-hidden px-6 py-12 lg:px-8">
                <nav className="flex flex-wrap justify-center gap-x-8 gap-y-4" aria-label="Footer">
                    <a
                        href="#features"
                        onClick={(e) => handleScrollLink(e, '#features')}
                        className="text-sm leading-6 text-gray-600 hover:text-gray-900"
                    >
                        Features
                    </a>
                    <a
                        href="#use-cases"
                        onClick={(e) => handleScrollLink(e, '#use-cases')}
                        className="text-sm leading-6 text-gray-600 hover:text-gray-900"
                    >
                        Use Cases
                    </a>
                    <a
                        href="#"
                        onClick={(e) => e.preventDefault()}
                        className="cursor-not-allowed text-sm leading-6 text-gray-600 opacity-50 hover:text-gray-900"
                    >
                        Pricing
                    </a>
                    <a
                        href="#"
                        onClick={(e) => e.preventDefault()}
                        className="cursor-not-allowed text-sm leading-6 text-gray-600 opacity-50 hover:text-gray-900"
                    >
                        Contact
                    </a>
                </nav>
                <div className="mt-10 flex justify-center space-x-10">
                    <a href="#" className="text-gray-400 hover:text-gray-500">
                        <span className="sr-only">Twitter</span>
                        <Twitter className="size-6" />
                    </a>
                    <a href="#" className="text-gray-400 hover:text-gray-500">
                        <span className="sr-only">GitHub</span>
                        <Github className="size-6" />
                    </a>
                    <a href="#" className="text-gray-400 hover:text-gray-500">
                        <span className="sr-only">YouTube</span>
                        <Youtube className="size-6" />
                    </a>
                </div>
                <div className="mt-10 flex items-center justify-center gap-2">
                    <Zap className="size-5 text-slate-500" />
                    <span className="text-xl font-bold tracking-tight text-slate-800">Volt</span>
                </div>
                <p className="mt-2 text-center text-xs leading-5 text-gray-500">
                    &copy; {new Date().getFullYear()} V-Academy. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
