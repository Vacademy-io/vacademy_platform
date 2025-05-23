import { Helmet } from "react-helmet";
import { DashboardLoader } from "./dashboard-loader";

function RootPendingComponent() {
    return (
        <>
            <Helmet>
                <title>Page Loading...</title>
                <meta
                    name="description"
                    content="Please wait a moment while we prepare the page. Your experience is just around the corner!"
                />
            </Helmet>
            <div className="flex h-screen w-full items-center justify-center">
                <DashboardLoader />
            </div>
        </>
    );
}

export default RootPendingComponent;
