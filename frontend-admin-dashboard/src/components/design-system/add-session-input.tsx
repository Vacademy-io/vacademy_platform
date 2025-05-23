import { MyButton } from "@/components/design-system/button";
import { MyInput } from "@/components/design-system/input";
import { Plus, X } from "@phosphor-icons/react";
import { Dispatch, SetStateAction, useState } from "react";

interface AddSessionInputProps {
    newSessionName: string;
    setNewSessionName: Dispatch<SetStateAction<string>>;
    newSessionStartDate: string;
    setNewSessionStartDate: Dispatch<SetStateAction<string>>;
    handleAddSession: (sessionName: string, startDate: string) => void;
}

export const AddSessionInput = ({
    newSessionName,
    setNewSessionName,
    newSessionStartDate,
    setNewSessionStartDate,
    handleAddSession,
}: AddSessionInputProps) => {
    const [showNewSessionInput, setShowNewSessionInput] = useState(false);
    return (
        <>
            {showNewSessionInput ? (
                <div className="flex items-end gap-4">
                    <div className="flex flex-col gap-4">
                        <MyInput
                            inputType="text"
                            inputPlaceholder="Eg. 2024-2025"
                            className="w-[230]"
                            input={newSessionName}
                            onChangeFunction={(e) => setNewSessionName(e.target.value)}
                            required={true}
                            label="New Session"
                        />
                        <MyInput
                            inputType="date"
                            inputPlaceholder="DD/MM/YYYY"
                            className="w-[200px] text-neutral-500"
                            input={newSessionStartDate}
                            onChangeFunction={(e) => setNewSessionStartDate(e.target.value)}
                            required={true}
                            label="Start Date"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <MyButton
                            onClick={() => {
                                if (newSessionName && newSessionStartDate) {
                                    handleAddSession(newSessionName, newSessionStartDate);
                                    setNewSessionName("");
                                    setNewSessionStartDate("");
                                    setShowNewSessionInput(false);
                                }
                            }}
                            buttonType="primary"
                            layoutVariant="icon"
                            scale="small"
                        >
                            <Plus />
                        </MyButton>
                        <MyButton
                            onClick={() => {
                                setShowNewSessionInput(false);
                            }}
                            buttonType="secondary"
                            layoutVariant="icon"
                            scale="small"
                        >
                            <X />
                        </MyButton>
                    </div>
                </div>
            ) : (
                <MyButton
                    onClick={() => setShowNewSessionInput(true)}
                    buttonType="text"
                    layoutVariant="default"
                    scale="small"
                    id="add-session-button"
                    className="w-fit text-primary-500 hover:bg-white active:bg-white"
                >
                    <Plus /> Add Session
                </MyButton>
            )}
        </>
    );
};
