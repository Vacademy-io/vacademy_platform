"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface MarkingCriteriaDialogProps {
    markingJson: string;
}

export function MarkingCriteriaDialog({ markingJson }: MarkingCriteriaDialogProps) {
    const [open, setOpen] = useState(false);

    let markingData = { total_marks: 0, criteria: [] };
    try {
        markingData = JSON.parse(markingJson);
    } catch (error) {
        console.error("Failed to parse marking JSON:", error);
    }

    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)} className="">
                <Eye className="mr-2 size-4" />
                View
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[80vh] min-w-fit overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Marking Criteria for {markingData.total_marks} marks
                        </DialogTitle>
                    </DialogHeader>

                    <div className="mt-4">
                        <h3 className="mb-2 font-medium">Selected Criteria:</h3>

                        <div className="rounded-md border">
                            <div className="flex justify-between border-b bg-muted/50 p-3">
                                <div className="font-medium">Criteria</div>
                                <div className="font-medium">Marks</div>
                                {/* <div className="font-medium">Action</div> */}
                            </div>

                            {markingData.criteria && markingData.criteria.length > 0 ? (
                                // eslint-disable-next-line
                                markingData.criteria.map((criterion: any, index: number) => (
                                    <div
                                        key={index}
                                        className="flex justify-between gap-x-4 border-b p-3 last:border-0"
                                    >
                                        <div>{criterion.name}</div>
                                        <div>{criterion.marks}</div>
                                        {/* <div>-</div> */}
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-muted-foreground">
                                    No criteria selected, please select criteria from available list
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
