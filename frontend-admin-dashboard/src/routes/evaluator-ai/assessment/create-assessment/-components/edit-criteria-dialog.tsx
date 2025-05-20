import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash } from "phosphor-react";
import { Label } from "@/components/ui/label";

interface EditCriteriaDialogProps {
    markingJson: string;
    onSave: (updatedMarkingJson: string) => void;
}

const EditCriteriaDialog = ({ markingJson, onSave }: EditCriteriaDialogProps) => {
    const [open, setOpen] = useState(false);
    const [totalMarks, setTotalMarks] = useState(0);
    const [criteria, setCriteria] = useState<Array<{ name: string; marks: number }>>([]);
    const [newCriteriaName, setNewCriteriaName] = useState("");
    const [newCriteriaMarks, setNewCriteriaMarks] = useState(0);
    // Parse markingJson on open
    const handleOpen = () => {
        try {
            const data = JSON.parse(markingJson);
            setTotalMarks(data.total_marks || 0);
            setCriteria(Array.isArray(data.criteria) ? data.criteria : []);
        } catch {
            setTotalMarks(0);
            setCriteria([]);
        }
        setOpen(true);
    };

    const handleAddCriteria = () => {
        if (!newCriteriaName || newCriteriaMarks <= 0) return;
        setCriteria([...criteria, { name: newCriteriaName, marks: newCriteriaMarks }]);
        setNewCriteriaName("");
        setNewCriteriaMarks(0);
    };

    const handleRemoveCriteria = (idx: number) => {
        setCriteria(criteria.filter((_, i) => i !== idx));
    };

    const handleSave = () => {
        const updated = JSON.stringify({ total_marks: totalMarks, criteria });
        onSave(updated);
        setOpen(false);
    };

    return (
        <>
            <Button variant="outline" onClick={handleOpen} className="ml-2">
                Edit
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[80vh] min-w-[600px] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Marking Criteria</DialogTitle>
                    </DialogHeader>
                    <div className="my-4 flex items-center gap-2">
                        <Label className="text-base font-medium">Total Marks:</Label>
                        <Input
                            type="number"
                            value={totalMarks}
                            min={1}
                            onChange={(e) => setTotalMarks(Number(e.target.value))}
                            className="w-20"
                        />
                    </div>
                    <div className="mb-4">
                        <h3 className="mb-2 font-semibold">Criteria:</h3>
                        <div className="rounded-md border">
                            <div className="flex justify-between border-b bg-muted/50 p-3">
                                <div className="font-medium">Criteria</div>
                                <div className="font-medium">Marks</div>
                                <div className="font-medium">Action</div>
                            </div>
                            {criteria.length > 0 ? (
                                criteria.map((c, idx) => (
                                    <div
                                        key={idx}
                                        className="flex justify-between gap-x-4 border-b p-3 last:border-0"
                                    >
                                        <div>{c.name}</div>
                                        <div>{c.marks}</div>
                                        <div>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                onClick={() => handleRemoveCriteria(idx)}
                                            >
                                                <Trash size={16} />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-muted-foreground">
                                    No criteria. Add one below.
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="mb-6">
                        <h3 className="mb-2 font-semibold">Add New Criteria:</h3>
                        <div className="flex items-center gap-4">
                            <Input
                                placeholder="Enter criteria description"
                                className="flex-1"
                                value={newCriteriaName}
                                onChange={(e) => setNewCriteriaName(e.target.value)}
                            />
                            <Input
                                placeholder="Marks"
                                type="number"
                                className="w-24"
                                value={newCriteriaMarks}
                                min={1}
                                max={totalMarks}
                                onChange={(e) => setNewCriteriaMarks(Number(e.target.value))}
                            />
                            <Button
                                onClick={handleAddCriteria}
                                variant="outline"
                                className="bg-primary-500 hover:bg-primary-400"
                                disabled={!newCriteriaName || newCriteriaMarks <= 0}
                            >
                                <Plus size={16} className="text-white" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="default" onClick={handleSave}>
                            Save
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default EditCriteriaDialog;
