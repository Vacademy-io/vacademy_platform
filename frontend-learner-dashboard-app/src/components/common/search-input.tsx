import { MagnifyingGlass } from "@phosphor-icons/react";
import { MyInput } from "../design-system/input";

interface SearchInputProps {
    searchInput: string;
    onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
}

export const SearchInput = ({ searchInput, onSearchChange, placeholder }: SearchInputProps) => {
    return (
        <div className="relative">
            <MyInput
                inputType="text"
                input={searchInput}
                onChangeFunction={onSearchChange}
                inputPlaceholder={placeholder}
                className="ps-9 pe-9"
            />
            <MagnifyingGlass className="absolute start-3 top-1/4 size-5 text-neutral-600" />
        </div>
    );
};
