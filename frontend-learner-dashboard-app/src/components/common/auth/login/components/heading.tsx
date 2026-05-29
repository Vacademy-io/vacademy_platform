import { HeadingProps } from "@/types/loginTypes";

export const Heading = ({ heading, subHeading }: HeadingProps) => {
    return (
        <div className="flex w-full flex-col gap-4 p-4 text-neutral-600 md:gap-3 md:p-3 lg:gap-2 lg:p-2">
            <div className="w-full text-center text-2xl font-bold md:text-h1 lg:text-3xl">{heading}</div>
            <div className="w-full text-center">
                {heading == "Set New Password" ? (
                    <div>
                        Secure your account <span className="text-primary-500">email</span> with a
                        new password
                    </div>
                ) : (
                    <div className="text-sm  md:text-base lg:text-base">{subHeading}</div>
                )}
            </div>
        </div>
    );
};
