import { useRouter } from "@tanstack/react-router";
import { Helmet } from "react-helmet";
import { Button } from "../ui/button";

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

            <div className="grid h-screen select-none place-content-center bg-base-primary px-4 text-gray-700 dark:text-gray-800">
                <div className="text-center">
                    <h1 className="text-9xl font-black">404</h1>
                    <p className="text-2xl font-bold tracking-tight sm:text-4xl">
                        Oops! Page Not Found
                    </p>
                    <p className="mt-4 text-gray-500">
                        We couldn&apos;t find the page you were trying to access.
                        <br />
                        This might be due to a typing error, a temporary issue, or the page may have
                        been removed.
                    </p>
                    <div className="mt-8 flex justify-center gap-5 text-base-white">
                        <Button asChild variant={"default"} className="h-10 min-w-32">
                            <div>Return Home</div>
                        </Button>
                        <Button asChild variant={"default"} className="h-10 min-w-32">
                            <div onClick={() => router.history.back()}>Go Back</div>
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}

export default RootNotFoundComponent;
