import { FormContainerProps } from "@/routes/login/-types/loginTypes";
import { LoginImage } from "@/assets/svgs";
import useInstituteLogoStore from "../../../../../components/common/layout-container/sidebar/institutelogo-global-zustand";

export function FormContainer({ children }: FormContainerProps) {
    const { instituteLogo } = useInstituteLogoStore();
    return (
        <div className="flex min-h-screen w-screen bg-white">
            <div className="relative flex w-full items-center justify-center bg-primary-100">
                <div className="absolute left-8 top-8">
                    <img src={instituteLogo} alt="logo" className="size-12 rounded-full" />
                </div>
                <LoginImage />
            </div>
            <div className="relative flex w-full items-center justify-center text-neutral-600">
                {/* <LanguageDropdown /> */}
                <div className="w-[500px] items-center justify-center">{children}</div>
            </div>
        </div>
    );
}
