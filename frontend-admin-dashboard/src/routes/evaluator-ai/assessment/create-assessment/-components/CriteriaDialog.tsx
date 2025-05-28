import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
    marking_1,
    marking_2,
    marking_4,
    marking_5,
    marking_8,
    marking_10,
} from "../-constants/criteria";
import { Plus, Trash } from "phosphor-react";
import { cn } from "@/lib/utils";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Criteria } from "../-hooks/sectionData";

interface CriteriaDialogProps {
    marks: number;
    onAddCriteria: (criteria: { name: string; marks: number }) => void;
    onRemoveCriteria: (criteriaName: string) => void; // Add this prop
    selectedCriteria: Array<{ name: string; marks: number }>;
}

export const CriteriaDialog = ({
    marks,
    onAddCriteria,
    selectedCriteria,
    onRemoveCriteria,
}: CriteriaDialogProps) => {
    const [newCriteriaName, setNewCriteriaName] = useState("");
    const [newCriteriaMarks, setNewCriteriaMarks] = useState(marks);

    const getCriteriaByMarks = (marks: number): Criteria[] => {
        const markingSchemes = {
            1: marking_1,
            2: marking_2,
            4: marking_4,
            5: marking_5,
            8: marking_8,
            10: marking_10,
        };
        // @ts-expect-error : //TODO: Fix this type error
        return markingSchemes[marks]?.criteria || [];
    };

    const availableCriteria = getCriteriaByMarks(marks);

    const handleSelectAll = () => {
        const unselectedCriteria = availableCriteria.filter(
            (criteria) => !selectedCriteria.some((sc) => sc.name === criteria.name),
        );
        unselectedCriteria.forEach((criteria) => onAddCriteria(criteria));
    };
    const handleRemoveAll = () => {
        selectedCriteria.forEach((criteria) => onRemoveCriteria(criteria.name));
        setNewCriteriaName("");
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">View/Edit Criteria</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[60vh] min-w-[720px] overflow-y-scroll">
                <DialogHeader className="flex-row items-center justify-between gap-x-2">
                    <DialogTitle>Marking Criteria for {marks} marks</DialogTitle>

                    <Button
                        variant="outline"
                        onClick={() => {
                            if (availableCriteria.length === selectedCriteria.length)
                                handleRemoveAll();
                            else handleSelectAll();
                        }}
                    >
                        {availableCriteria.length === selectedCriteria.length
                            ? "Remove All"
                            : "Select All"}
                    </Button>
                </DialogHeader>

                <div className="mt-4">
                    <h3 className="mb-2 font-semibold">Selected Criteria:</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Criteria</TableHead>
                                <TableHead>Marks</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedCriteria.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center">
                                        No criteria selected, please select criteria from available
                                        list
                                    </TableCell>
                                </TableRow>
                            )}
                            {selectedCriteria.map((criteria, index) => (
                                <TableRow key={index}>
                                    <TableCell>{criteria.name}</TableCell>
                                    <TableCell>{criteria.marks}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => onRemoveCriteria(criteria.name)}
                                        >
                                            <Trash size={16} />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Add Custom Criteria Form - Always visible */}
                <Accordion type="single" collapsible>
                    <AccordionItem value="custom-criteria">
                        <AccordionTrigger>Custom Criteria</AccordionTrigger>
                        <AccordionContent>
                            <div className="">
                                <h3 className="mb-2 font-semibold">Add Custom Criteria:</h3>
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
                                        max={marks}
                                        onChange={(e) =>
                                            setNewCriteriaMarks(Number(e.target.value))
                                        }
                                    />
                                    <Button
                                        onClick={() => {
                                            if (newCriteriaName && newCriteriaMarks > 0) {
                                                onAddCriteria({
                                                    name: newCriteriaName,
                                                    marks: newCriteriaMarks,
                                                });
                                                setNewCriteriaName("");
                                                setNewCriteriaMarks(marks);
                                            }
                                        }}
                                        variant={"outline"}
                                        className="bg-primary-500 hover:bg-primary-400"
                                        disabled={!newCriteriaName || newCriteriaMarks <= 0}
                                    >
                                        <Plus size={16} className="text-white" />
                                    </Button>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                {availableCriteria.length > 0 && (
                    <>
                        <Accordion type="single" collapsible>
                            <AccordionItem value="custom-criteria">
                                <AccordionTrigger>Predefined Criteria</AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Criteria</TableHead>
                                                <TableHead>Marks</TableHead>
                                                <TableHead>Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {availableCriteria.map((criteria, index) => {
                                                const isSelected = selectedCriteria.some(
                                                    (sc) => sc.name === criteria.name,
                                                );
                                                return (
                                                    <TableRow key={index}>
                                                        <TableCell>{criteria.name}</TableCell>
                                                        <TableCell>{criteria.marks}</TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant={
                                                                    isSelected
                                                                        ? "destructive"
                                                                        : "outline"
                                                                }
                                                                className={cn(
                                                                    !isSelected &&
                                                                        "bg-primary-500 hover:bg-primary-400",
                                                                )}
                                                                onClick={() =>
                                                                    isSelected
                                                                        ? onRemoveCriteria(
                                                                              criteria.name,
                                                                          )
                                                                        : onAddCriteria(criteria)
                                                                }
                                                            >
                                                                {isSelected ? (
                                                                    <Trash size={16} className="" />
                                                                ) : (
                                                                    <Plus
                                                                        size={16}
                                                                        className="text-white"
                                                                    />
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
