import { Input } from "@/components/ui/input";
import { MagnifyingGlass, XCircle } from "@phosphor-icons/react";

interface ScheduleTestSearchComponent {
    onSearch: (searchValue: string) => void;
    searchText: string;
    setSearchText: (text: string) => void;
    clearSearch: () => void;
}

export const ScheduleTestSearchComponent = ({
    onSearch,
    searchText,
    setSearchText,
    clearSearch,
}: ScheduleTestSearchComponent) => {
    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            onSearch(searchText);
        }
    };

    return (
        <div className="relative w-full">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Search Question Paper"
                className="pl-9 pr-8 w-full bg-background"
            />
            {searchText && (
                <XCircle
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                    onClick={clearSearch}
                />
            )}
        </div>
    );
};
