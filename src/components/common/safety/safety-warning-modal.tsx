import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SafetyWarningModalProps {
    open: boolean;
    onAccept: () => void;
    onReject?: () => void;
}

export function SafetyWarningModal({ open, onAccept, onReject }: SafetyWarningModalProps) {
    const [parentalAnswer, setParentalAnswer] = useState("");
    const [error, setError] = useState("");

    // Simple math challenge for "Adult Action"
    // Challenge: 12 + 7 = ?
    const validateParentalGate = () => {
        if (parentalAnswer.trim() === "19") {
            onAccept();
        } else {
            setError("Incorrect answer. Please try again.");
        }
    };

    return (
        <AlertDialog open={open}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Safety First</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4 text-left">
                        <p className="font-semibold text-red-600">
                            Please read carefully before proceeding:
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                <strong>Be Safe Online:</strong> Never share personal information (like your phone number, address, or school) with strangers.
                            </li>
                            <li>
                                <strong>Chat with Caution:</strong> Only interact with people you know and trust.
                            </li>
                            <li>
                                <strong>Respect Others:</strong> Be kind and respectful in all online interactions.
                            </li>
                        </ul>
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                            <p className="mb-2 font-medium text-gray-900">Adult Verification Required</p>
                            <p className="text-sm text-gray-500 mb-4">
                                To access social features (like chat or live sessions), an adult must verify this action.
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="challenge">What is 12 + 7?</Label>
                                <Input
                                    id="challenge"
                                    value={parentalAnswer}
                                    onChange={(e) => {
                                        setParentalAnswer(e.target.value);
                                        setError("");
                                    }}
                                    placeholder="Enter the number"
                                />
                                {error && <p className="text-red-500 text-sm">{error}</p>}
                            </div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    {onReject && (
                        <AlertDialogCancel onClick={onReject}>Go Back</AlertDialogCancel>
                    )}
                    <AlertDialogAction onClick={(e) => {
                        e.preventDefault(); // Prevent auto-close
                        validateParentalGate();
                    }}>
                        I Agree & Proceed
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
