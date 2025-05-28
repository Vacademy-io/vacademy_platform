import { MyDialog } from "@/components/design-system/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Info } from "@phosphor-icons/react";

const CourseInfoData: {
    name: string;
    answer: string;
    example: string;
}[] = [
    {
        name: "Courses",
        answer: "Courses represent the top-level study material and can be named according to the institute's preferences. They define the broad category under which learning is structured.",
        example: `"Premium Batch," "Electrical Engineering," "Primary Education," "2024 Enroll for Corporate Training."`,
    },
    {
        name: "Sessions",
        answer: "Sessions define the specific time frame during which the course material is available or relevant. They help in organizing batches based on academic years or training periods.",
        example: `"2024-2025," "2023-2022."`,
    },
    {
        name: "Levels (Optional)",
        answer: "Levels categorize courses further into subcategories, such as grade levels, difficulty tiers, or specific sections. Institutes may choose to use them or skip them entirely.",
        example: `"9th Class," "8th Class," "Beginner Level," "Advanced Module."`,
    },
];

export const CourseInfoDialog = () => {
    return (
        <MyDialog
            heading="What is a course, level and session?"
            dialogWidth="w-[700px]"
            trigger={
                <Button
                    variant="ghost"
                    className="text-neutral-500 hover:bg-white hover:text-primary-500"
                >
                    <Info weight="fill" />
                </Button>
            }
        >
            <div className="flex flex-col gap-5 px-4 pb-4 text-neutral-600">
                {CourseInfoData.map((info, index) => (
                    <div className="flex flex-col gap-5" key={index}>
                        <div className="flex flex-col gap-2">
                            <p className="text-lg font-semibold">{info.name}:</p>
                            <p className="text-sm text-neutral-500">{info.answer}</p>
                            <p className="text-sm text-neutral-400">Example: {info.example}</p>
                        </div>
                        {index != 2 && <Separator />}
                    </div>
                ))}
            </div>
        </MyDialog>
    );
};
