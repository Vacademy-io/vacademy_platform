import { createFileRoute } from "@tanstack/react-router";
import CourseCatalougePage from "./-component/CourseCatalougePage";

export const Route = createFileRoute("/courses/")({
    component: CoursesContainerComponent,
    validateSearch: (search) => {
        return {
            instituteId:
                (search.instituteId as string) ??
                "dd9b9687-56ee-467a-9fc4-8c5835eae7f9",
        };
    },
});

function CoursesContainerComponent() {
    return (
        <div className="min-h-screen bg-white">
            <CourseCatalougePage />
        </div>
    );
}
