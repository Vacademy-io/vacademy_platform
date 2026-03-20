import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

interface SessionLevel {
    sessionId: string;
    sessionName: string;
    levelId: string;
    levelName: string;
}

interface SessionLevelMappingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessions: Array<{
        id: string;
        name: string;
        levels: Array<{
            id: string;
            name: string;
        }>;
    }>;
    onSave: (selectedMappings: SessionLevel[]) => void;
}

const SessionLevelMappingDialog = ({
    open,
    onOpenChange,
    sessions,
    onSave,
}: SessionLevelMappingDialogProps) => {
    const [selectedMappings, setSelectedMappings] = useState<SessionLevel[]>([]);

    // Create flattened array of session-level combinations
    const sessionLevelMappings = sessions.flatMap((session) =>
        session.levels.map((level) => ({
            sessionId: session.id,
            sessionName: session.name,
            levelId: level.id,
            levelName: level.name,
            key: `${session.id}-${level.id}`,
        }))
    );

    const handleCheckboxChange = (mapping: SessionLevel) => {
        setSelectedMappings((prev) => {
            const exists = prev.some(
                (m) => m.sessionId === mapping.sessionId && m.levelId === mapping.levelId
            );

            if (exists) {
                return prev.filter(
                    (m) => m.sessionId !== mapping.sessionId || m.levelId !== mapping.levelId
                );
            } else {
                return [...prev, mapping];
            }
        });
    };

    const handleSave = () => {
        onSave(selectedMappings);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[600px] w-[420px] flex-col overflow-y-scroll p-0">
                <h1 className="rounded-t-md bg-primary-50 p-4 font-semibold text-primary-500">
                    Select Sessions and Levels
                </h1>
                <div className="flex flex-col gap-4 p-4">
                    {sessionLevelMappings.map((mapping) => (
                        <div key={mapping.key} className="flex items-center space-x-2">
                            <Checkbox
                                id={mapping.key}
                                checked={selectedMappings.some(
                                    (m) =>
                                        m.sessionId === mapping.sessionId &&
                                        m.levelId === mapping.levelId
                                )}
                                onCheckedChange={() =>
                                    handleCheckboxChange({
                                        sessionId: mapping.sessionId,
                                        sessionName: mapping.sessionName,
                                        levelId: mapping.levelId,
                                        levelName: mapping.levelName,
                                    })
                                }
                            />
                            <Label htmlFor={mapping.key} className="text-sm">
                                {mapping.sessionName} - {mapping.levelName}
                            </Label>
                        </div>
                    ))}
                    <div className="flex justify-end gap-2 pt-4">
                        <MyButton
                            type="button"
                            scale="medium"
                            buttonType="secondary"
                            layoutVariant="default"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            type="button"
                            scale="medium"
                            buttonType="primary"
                            layoutVariant="default"
                            onClick={handleSave}
                            disable={selectedMappings.length === 0}
                        >
                            Save
                        </MyButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default SessionLevelMappingDialog;
