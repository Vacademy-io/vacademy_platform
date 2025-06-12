import { useRouter } from "@tanstack/react-router";
import { Helmet } from "react-helmet";
import { Button } from "../ui/button";

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

            <div className="grid h-screen select-none place-content-center bg-base-primary px-4 text-gray-700 dark:text-gray-800">
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

                    <div className="mt-8 flex justify-center gap-5 text-base-white">
                        <Button asChild variant="default" className="h-10 min-w-32">
                            <div>Return Home</div>
                        </Button>
                        <Button asChild variant="default" className="h-10 min-w-32">
                            <div onClick={() => router.history.back()}>Go Back</div>
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}

export default RootErrorComponent;
