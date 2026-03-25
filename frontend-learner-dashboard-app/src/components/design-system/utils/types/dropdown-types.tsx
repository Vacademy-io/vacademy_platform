export interface myDropDownProps {
    currentValue: string;
    setCurrentValue: (value: string | ((prevState: string) => string)) => void; // Updated this line
    dropdownList: string[];
}
