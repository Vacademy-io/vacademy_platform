import { useState } from "react";
import { useLanguageStore } from "@/stores/localization/useLanguageStore";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "../../ui/dropdown-menu";
import { CaretUp, CaretDown, Check } from "@phosphor-icons/react";
import { useSyncLanguage } from "@/hooks/useSyncLanguage";

export const LanguageDropdown = () => {
    useSyncLanguage();

    const { language, setLanguage } = useLanguageStore();
    const [isOpen, setIsOpen] = useState(false);

    const handleChangeLanguage = (lang: string) => {
        setLanguage(lang);
        setIsOpen(false);
    };

    return (
        <div className="absolute right-8 top-8 hidden">
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger className="flex w-48 items-center justify-between rounded-md border border-neutral-300 bg-neutral-50 px-3 py-1 text-neutral-600">
                    <div>{language}</div>
                    {isOpen ? <CaretUp /> : <CaretDown />}
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 border border-neutral-300 bg-neutral-50 p-0 text-neutral-600 outline-none">
                    <DropdownMenuItem
                        className="flex items-center justify-between px-3 hover:cursor-pointer focus:bg-primary-100 focus:text-neutral-600"
                        onClick={() => handleChangeLanguage("English")}
                    >
                        <div>English</div>
                        {language === "English" && <Check className="text-primary-400" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="flex items-center justify-between px-3 hover:cursor-pointer focus:bg-primary-100 focus:text-neutral-600"
                        onClick={() => handleChangeLanguage("हिन्दी")}
                    >
                        <div>हिन्दी</div>
                        {language === "हिन्दी" && <Check className="text-primary-400" />}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
