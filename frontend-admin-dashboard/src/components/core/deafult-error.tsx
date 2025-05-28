import { Link, useRouter } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { Button } from '../ui/button';

function RootErrorComponent() {
    const router = useRouter();

    return (
        <>
            <Helmet>
                <title>Unknown error occurred (500)</title>
                <meta
                    name="description"
                    content="An unexpected error occurred on the server. Please try again later or contact support."
                />
            </Helmet>

            <div className="bg-base-primary grid h-screen select-none place-content-center px-4 text-gray-700 dark:text-gray-800">
                <div className="text-center">
                    <h1 className="text-9xl font-black">500</h1>
                    <p className="text-2xl font-bold tracking-tight sm:text-4xl">
                        Something Went Wrong !
                    </p>
                    <p className="mt-4 text-gray-500">
                        An unexpected error occurred on our server. We&apos;re working to fix it as
                        quickly as possible.
                        <br />
                        Please try again later or contact support if the problem persists.
                    </p>

                    <div className="text-base-white mt-8 flex justify-center gap-5">
                        <Button asChild variant="default" className="h-10 min-w-32">
                            <Link to="/dashboard">Return Home</Link>
                        </Button>
                        <Button
                            variant="default"
                            className="h-10 min-w-32"
                            onClick={() => router.history.back()}
                        >
                            Go Back
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}

export default RootErrorComponent;
