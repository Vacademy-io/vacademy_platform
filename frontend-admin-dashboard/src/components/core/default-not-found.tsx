import { Link, useRouter } from "@tanstack/react-router";
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

            <div className="flex w-full select-none items-center justify-center px-4 text-gray-700 dark:text-gray-800">
                <div className="relative flex w-full flex-col items-center justify-center text-center">
                    <h1 className="absolute top-10 font-mono text-9xl font-light">404</h1>
                    <img src="/caveman.gif" alt="" />
                    <p className="absolute bottom-10 mt-8 font-mono text-[40px]">
                        Look like you&apos;re lost
                        <br />
                        <span className="text-xl">the page you are looking for not available!</span>
                    </p>
                    <div className="mt-8 flex justify-center gap-5">
                        <Button asChild variant={"outline"} className="h-10 min-w-32">
                            <Link to="/dashboard">Return Home</Link>
                        </Button>
                        <Button asChild variant={"outline"} className="h-10 min-w-32">
                            <button onClick={() => router.history.back()}>Go Back</button>
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}

export default RootNotFoundComponent;
