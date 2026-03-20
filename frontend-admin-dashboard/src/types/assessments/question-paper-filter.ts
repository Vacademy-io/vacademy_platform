export interface FilterOption {
    id: string;
    name: string;
}

export interface FilterProps {
    label: string;
    data: FilterOption[] | undefined;
    selectedItems: FilterOption[];
    onSelectionChange: (selectedItems: FilterOption[]) => void;
}
