'use client';

import { VoltFeaturesGrid } from './VoltFeaturesGrid';

export function Features() {
    return (
        <section id="features" className="bg-slate-50">
            <div className="py-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-3xl text-center">
                        <h2 className="text-base font-semibold leading-7 text-orange-600">
                            Features
                        </h2>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                            Everything You Need for Interactive Presentations
                        </p>
                        <p className="mt-6 text-lg leading-8 text-gray-600">
                            From AI creation to real-time analytics, Volt provides a comprehensive
                            suite of tools to make your presentations unforgettable.
                        </p>
                    </div>

                    <div className="mt-16">
                        <VoltFeaturesGrid />
                    </div>
                </div>
            </div>
        </section>
    );
}
