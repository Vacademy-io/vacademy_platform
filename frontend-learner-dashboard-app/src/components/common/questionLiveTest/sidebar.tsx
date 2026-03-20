"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { QuestionNavigator } from "./question-navigator";

export function Sidebar({
  isOpen,
  onClose,
  evaluationType,
}: {
  isOpen: boolean;
  onClose: () => void;
  evaluationType: string;
}) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="p-0 w-80">
        <QuestionNavigator onClose={onClose} evaluationType={evaluationType} />
      </SheetContent>
    </Sheet>
  );
}
