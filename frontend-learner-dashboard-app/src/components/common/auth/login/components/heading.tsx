import { Trans } from "react-i18next";
import { HeadingProps } from "@/types/loginTypes";

export const Heading = ({ heading, subHeading }: HeadingProps) => {
    return (
        <div className="flex w-full flex-col gap-4 p-4 text-neutral-600 md:gap-3 md:p-3 lg:gap-2 lg:p-2">
            <div className="w-full text-center text-2xl font-bold md:text-h1 lg:text-3xl">{heading}</div>
            <div className="w-full text-center">
                {/*
                 * NOTE: this branches on a *display* string, so it cannot match
                 * once `heading` is localised. It is already unreachable today
                 * (the sole caller passes "Select Your Institute"); kept as-is
                 * to preserve behaviour. Should become an explicit prop.
                 */}
                {heading == "Set New Password" ? (
                    <div>
                        <Trans
                            i18nKey="login.setPasswordSecureNote"
                            ns="auth"
                            components={{
                                highlight: <span className="text-primary-500" />,
                            }}
                        />
                    </div>
                ) : (
                    <div className="text-sm  md:text-base lg:text-base">{subHeading}</div>
                )}
            </div>
        </div>
    );
};
