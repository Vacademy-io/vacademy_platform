export interface MyFilterOption {
    id: string;
    name: string;
}

export interface MyFilterProps {
    label: string;
    data: MyFilterOption[] | undefined;
    selectedItems: MyFilterOption[];
    onSelectionChange: (selectedItems: MyFilterOption[]) => void;
}
