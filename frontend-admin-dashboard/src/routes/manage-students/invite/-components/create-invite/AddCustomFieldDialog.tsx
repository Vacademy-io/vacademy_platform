import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { DotsSixVertical, PencilSimple, Plus, TrashSimple } from 'phosphor-react';

// Define types for dropdown options
export interface DropdownOption {
    id: number;
    value: string;
    disabled: boolean;
}

interface AddCustomFieldDialogProps {
    trigger: React.ReactNode;
    onAddField: (type: string, name: string, oldKey: boolean, options?: DropdownOption[]) => void;
}

export const AddCustomFieldDialog = ({ trigger, onAddField }: AddCustomFieldDialogProps) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedOptionValue, setSelectedOptionValue] = useState('textfield');
    const [textFieldValue, setTextFieldValue] = useState('');
    const [dropdownOptions, setDropdownOptions] = useState<DropdownOption[]>([]);

    const handleAddDropdownOptions = () => {
        setDropdownOptions((prevOptions) => [
            ...prevOptions,
            { id: prevOptions.length, value: `option ${prevOptions.length + 1}`, disabled: true },
        ]);
    };

    const handleDeleteOptionField = (id: number) => {
        setDropdownOptions((prevFields) => prevFields.filter((field) => field.id !== id));
    };

    const handleValueChange = (id: number, newValue: string) => {
        setDropdownOptions((prevOptions) =>
            prevOptions.map((option) =>
                option.id === id ? { ...option, value: newValue } : option
            )
        );
    };

    const handleEditClick = (id: number) => {
        setDropdownOptions((prevOptions) =>
            prevOptions.map((option) =>
                option.id === id ? { ...option, disabled: !option.disabled } : option
            )
        );
    };

    // Function to close the dialog and add the new field
    const handleCloseDialog = () => {
        // Create the new field and pass to parent component
        onAddField(
            selectedOptionValue,
            textFieldValue,
            false,
            selectedOptionValue === 'dropdown' ? dropdownOptions : undefined
        );

        // Reset dialog and temporary values
        setIsDialogOpen(false);
        setTextFieldValue('');
        setDropdownOptions([]);
    };

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="p-0">
                <h1 className="rounded-lg bg-primary-50 p-4 text-primary-500">Add Custom Field</h1>
                <div className="flex flex-col gap-4 px-4">
                    <h1>Select the type of custom field you want to add:</h1>
                    <RadioGroup
                        defaultValue={selectedOptionValue}
                        onValueChange={(value) => setSelectedOptionValue(value)}
                        className="flex items-center gap-6"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="textfield" id="option-one" />
                            <Label htmlFor="option-one">Text Field</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="dropdown" id="option-two" />
                            <Label htmlFor="option-two">Dropdown</Label>
                        </div>
                    </RadioGroup>
                    {selectedOptionValue === 'textfield' ? (
                        <div className="flex flex-col gap-1">
                            <h1>
                                Text Field Name
                                <span className="text-subtitle text-danger-600">*</span>
                            </h1>
                            <MyInput
                                inputType="text"
                                inputPlaceholder="Type Here"
                                input={textFieldValue}
                                onChangeFunction={(e) => setTextFieldValue(e.target.value)}
                                size="large"
                                className="w-full"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            <h1>
                                Dropdown Name
                                <span className="text-subtitle text-danger-600">*</span>
                            </h1>
                            <MyInput
                                inputType="text"
                                inputPlaceholder="Type Here"
                                input={textFieldValue}
                                onChangeFunction={(e) => setTextFieldValue(e.target.value)}
                                size="large"
                                className="w-full"
                            />
                            <h1 className="mt-4">Dropdown Options</h1>
                            <div className="flex flex-col gap-4">
                                {dropdownOptions.map((option) => (
                                    <div
                                        className="flex w-full items-center justify-between rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-1"
                                        key={option.id}
                                    >
                                        <MyInput
                                            inputType="text"
                                            inputPlaceholder={option.value}
                                            input={option.value}
                                            onChangeFunction={(e) =>
                                                handleValueChange(option.id, e.target.value)
                                            }
                                            size="large"
                                            disabled={option.disabled}
                                            className="border-none pl-0"
                                        />
                                        <div className="flex items-center gap-6">
                                            <MyButton
                                                type="button"
                                                scale="medium"
                                                buttonType="secondary"
                                                className="h-6 min-w-6 !rounded-sm px-1"
                                                onClick={() => handleEditClick(option.id)}
                                            >
                                                <PencilSimple size={32} />
                                            </MyButton>
                                            {dropdownOptions.length > 1 && (
                                                <MyButton
                                                    type="button"
                                                    scale="medium"
                                                    buttonType="secondary"
                                                    onClick={() =>
                                                        handleDeleteOptionField(option.id)
                                                    }
                                                    className="h-6 min-w-6 !rounded-sm px-1"
                                                >
                                                    <TrashSimple className="!size-4 text-danger-500" />
                                                </MyButton>
                                            )}
                                            <DotsSixVertical size={20} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <MyButton
                                type="button"
                                scale="small"
                                buttonType="secondary"
                                className="mt-2 w-20 min-w-4 border-none font-thin !text-primary-500"
                                onClick={handleAddDropdownOptions}
                            >
                                <Plus size={18} />
                                Add
                            </MyButton>
                        </div>
                    )}
                    <div className="mb-6 flex justify-center">
                        <MyButton
                            type="button"
                            scale="medium"
                            buttonType="primary"
                            className="mt-4 w-fit"
                            onClick={handleCloseDialog}
                        >
                            Done
                        </MyButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
