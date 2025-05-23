export const FormStepHeading = ({
    stepNumber,
    heading,
}: {
    stepNumber: number;
    heading: string;
}) => {
    return (
        <div className="flex w-full items-center gap-3">
            <div className="text-subtitle">Step {stepNumber}</div>
            <div className="text-h3 font-semibold">{heading}</div>
        </div>
    );
};
