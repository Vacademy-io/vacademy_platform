// import { LanguageDropdown } from "@/components/common/localization/language-dropdown";
import { FormContainerProps } from "@/types/loginTypes";
// import HeaderLogo from "../ui/header_logo";

export function FormContainer({ children }: FormContainerProps) {
  return (
    <div className="w-screen bg-white">
      {/* <HeaderLogo /> */}

      <div className="relative flex w-full items-center justify-center text-neutral-600">
        {/* <LanguageDropdown /> */}
        <div className="items-center justify-center">{children}</div>
      </div>
    </div>
  );
}
