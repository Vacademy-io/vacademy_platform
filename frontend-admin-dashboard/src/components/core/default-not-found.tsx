import { Link, useRouter } from '@tanstack/react-router';
import { ArrowLeft, FileQuestion, Home } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { Button } from '../ui/button';
import { ErrorFeedbackDialog } from './error-feedback-dialog';

function RootNotFoundComponent() {
    const router = useRouter();

    return (
        <>
            <Helmet>
                <title>Page Not Found (404)</title>
                <meta
                    name="description"
                    content="Page not found. We couldn't find the page you were looking for. Please check the URL or try searching."
                />
            </Helmet>

            <div className="flex size-full min-h-[80vh] flex-col items-center justify-center bg-background px-4 text-center">
                <div className="relative flex max-w-md flex-col items-center">
                    {/* Decorative blurred background */}
                    <div className="bg-primary/10 absolute -top-16 left-1/2 size-32 -translate-x-1/2 rounded-full blur-[80px]" />

                    <div className="z-10 mb-6 flex size-20 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-inset ring-foreground/10 backdrop-blur-sm">
                        <FileQuestion className="size-10 text-muted-foreground" strokeWidth={1.5} />
                    </div>

                    <h1 className="z-10 mb-2 font-mono text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                        Page not found
                    </h1>

                    <p className="z-10 mb-8 max-w-xs text-base text-muted-foreground">
                        Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have
                        been removed or renamed.
                    </p>

                    <div className="z-10 flex flex-col gap-3 sm:flex-row">
                        <Button asChild variant="default" className="min-w-[140px] gap-2 shadow-sm">
                            <Link to="/dashboard">
                                <Home className="size-4" />
                                Return Home
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            className="min-w-[140px] gap-2 bg-background shadow-sm hover:bg-muted/50"
                            onClick={() => router.history.back()}
                        >
                            <ArrowLeft className="size-4" />
                            Go Back
                        </Button>
                    </div>

                    <div className="z-10 mt-12">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Spot a problem?</span>
                            <ErrorFeedbackDialog
                                trigger={
                                    <button className="hover:text-primary hover:decoration-primary font-medium text-foreground underline decoration-muted-foreground/30 underline-offset-4 transition-colors">
                                        Report Issue
                                    </button>
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default RootNotFoundComponent;
