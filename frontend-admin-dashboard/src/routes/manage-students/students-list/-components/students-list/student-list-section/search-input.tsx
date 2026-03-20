import { MagnifyingGlass } from '@phosphor-icons/react';
import { MyInput } from '../../../../../../components/design-system/input';

interface SearchInputProps {
    searchInput: string;
    onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
}

export const SearchInput = ({ searchInput, onSearchChange, placeholder }: SearchInputProps) => {
    return (
        <div className="group relative">
            {/* <div className="to-primary-600/20 absolute -inset-0.5 rounded-lg bg-gradient-to-r from-primary-500/20 opacity-0 blur transition duration-300 group-focus-within:opacity-100"></div> */}
            <div className="relative">
                <MyInput
                    inputType="text"
                    input={searchInput}
                    onChangeFunction={onSearchChange}
                    inputPlaceholder={placeholder}
                    className="border-neutral-200/50 bg-gradient-to-r from-white to-neutral-50/50 pl-10 pr-4 transition-all duration-200 hover:border-neutral-300 focus:border-primary-300"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 transition-all duration-200 group-focus-within:text-primary-500">
                    <MagnifyingGlass className="size-4 text-neutral-500 transition-all duration-200 group-focus-within:scale-110 group-focus-within:text-primary-500" />
                </div>
                {searchInput && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="size-2 animate-pulse rounded-full bg-primary-500"></div>
                    </div>
                )}
            </div>
        </div>
    );
};
