import { HeadingProps } from "../../../-types/loginTypes";

export const Heading = ({ heading, subHeading }: HeadingProps) => {
    return (
        <div className="flex w-full flex-col gap-2 text-neutral-600">
            <div className="w-full text-center text-h1 font-semibold">{heading}</div>
            <div className="w-full text-center">
                {heading == "Set New Password" ? (
                    <div>
                        Secure your account <span className="text-primary-500">email</span> with a
                        new password
                    </div>
                ) : (
                    <div className="text-subtitle font-regular">{subHeading}</div>
                )}
            </div>
        </div>
    );
};
