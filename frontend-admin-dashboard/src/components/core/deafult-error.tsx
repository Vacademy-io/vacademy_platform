import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';
import { MyButton } from '../design-system/button';
import { removeCookiesAndLogout } from '@/lib/auth/sessionUtility';
import { ErrorFeedbackDialog } from './error-feedback-dialog';

function RootErrorComponent({ error }: { error?: unknown }) {
    const router = useRouter();
    const navigate = useNavigate();
    const [eventId, setEventId] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (error && import.meta.env.VITE_ENABLE_SENTRY === 'true') {
            // Capture the error when the component mounts
            const id = Sentry.captureException(error);
            setEventId(id);
        }
    }, [error]);

    return (
        <>
            <Helmet>
                <title>Unknown error occurred (500)</title>
                <meta
                    name="description"
                    content="An unexpected error occurred on the server. Please check your connection or try again later."
                />
            </Helmet>

            <div className="flex h-screen w-screen select-none items-center justify-center px-4 text-gray-700 dark:text-gray-800">
                <div className="text-center">
                    <h1 className="text-9xl font-black">500</h1>
                    <p className="text-2xl font-bold tracking-tight sm:text-4xl">
                        Something Went Wrong !
                    </p>
                    <p className="mt-4 text-gray-500">
                        An unexpected error occurred. We&apos;ve logged the issue and are working to
                        fix it.
                        <br />
                        Please try again later or contact support if the problem persists.
                    </p>

                    {!!error && process.env.NODE_ENV === 'development' && (
                        <div className="mx-auto mt-4 max-w-2xl overflow-auto rounded-md bg-red-50 p-4 text-left text-xs text-red-800">
                            <pre>{String(error)}</pre>
                        </div>
                    )}

                    <div className="my-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <MyButton asChild className="h-10 min-w-32">
                            <Link to="/dashboard">Return Home</Link>
                        </MyButton>
                        <MyButton
                            buttonType="secondary"
                            className="h-10 min-w-32"
                            onClick={() => router.history.back()}
                        >
                            Go Back
                        </MyButton>
                        <ErrorFeedbackDialog
                            error={error as Error}
                            eventId={eventId}
                            trigger={
                                <MyButton
                                    buttonType="secondary"
                                    className="h-10 min-w-32 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                    Report Issue
                                </MyButton>
                            }
                        />
                    </div>
                    <MyButton
                        onClick={() => {
                            removeCookiesAndLogout();
                            navigate({ to: '/login' });
                        }}
                    >
                        Logout
                    </MyButton>
                </div>
            </div>
        </>
    );
}

export default RootErrorComponent;
