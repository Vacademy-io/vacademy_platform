import { ArrowsClockwise, WifiSlash, CloudSlash } from '@phosphor-icons/react';
import { MyButton } from '../design-system/button';

export function OfflineErrorPage() {
    return (
        <div className="h-screen w-full bg-gray-50 overflow-y-auto flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto text-center w-full">
                <div className="mb-8 flex justify-center">
                    <div className="relative">
                        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-200 border-4 border-white shadow-sm">
                            <WifiSlash className="h-12 w-12 text-slate-600 animate-pulse" aria-hidden="true" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md border border-gray-100">
                            <CloudSlash className="h-5 w-5 text-slate-500" aria-hidden="true" />
                        </div>
                    </div>
                </div>
                
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">No Connection</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">You are offline</h1>
                <p className="mt-4 text-base text-gray-500 max-w-md mx-auto">
                    It looks like you've lost your connection to the internet. Please check your network settings and try reconnecting.
                </p>

                <div className="mt-8 flex justify-center">
                    <MyButton
                        className="w-full sm:w-auto"
                        onClick={() => window.location.reload()}
                    >
                        <ArrowsClockwise className="mr-2 h-4 w-4" />
                        Try Again
                    </MyButton>
                </div>
            </div>
        </div>
    );
}
