// components/SessionOptionsModal.tsx
/* eslint-disable */
// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, X, Settings2, Trophy, Timer, MinusCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export interface SessionOptions {
    can_join_in_between: boolean;
    show_results_at_last_slide: boolean;
    is_session_recorded: boolean;
    allow_chat: boolean;
    default_seconds_for_question: number;
    student_attempts: number;
    points_per_correct_answer: number;
    negative_marking_enabled: boolean;
    negative_marks_per_wrong_answer: number;
}

interface SessionOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (options: SessionOptions) => void;
    isCreatingSession: boolean;
}

export const SessionOptionsModal: React.FC<SessionOptionsModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    isCreatingSession,
}) => {
    const [options, setOptions] = useState<SessionOptions>({
        can_join_in_between: true,
        show_results_at_last_slide: true,
        default_seconds_for_question: 60,
        student_attempts: 1,
        is_session_recorded: false,
        allow_chat: false,
        points_per_correct_answer: 10,
        negative_marking_enabled: false,
        negative_marks_per_wrong_answer: 0,
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setOptions((prev) => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value,
        }));
    };

    const handleSwitchChange = (name: keyof SessionOptions, checked: boolean) => {
        setOptions((prev) => ({
            ...prev,
            [name]: checked,
        }));
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(options);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm transition-opacity duration-300 ease-in-out">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto scale-100 transform rounded-xl bg-white p-6 shadow-2xl transition-all duration-300 ease-in-out sm:p-8">
                <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-3">
                    <h2 className="flex items-center text-xl font-semibold text-slate-800 sm:text-2xl">
                        <Settings2 className="mr-2.5 size-6 text-orange-500" />
                        Session Options
                    </h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="size-5" />
                    </Button>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-6">
                    {/* Boolean Toggles */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3 transition-colors hover:border-orange-300/70">
                            <Label
                                htmlFor="can_join_in_between"
                                className="flex-1 cursor-pointer text-sm font-medium text-slate-700"
                            >
                                Allow Join In-Between
                            </Label>
                            <Switch
                                id="can_join_in_between"
                                name="can_join_in_between"
                                checked={options.can_join_in_between}
                                onCheckedChange={(checked) =>
                                    handleSwitchChange('can_join_in_between', checked)
                                }
                                className="data-[state=checked]:bg-orange-500"
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3 transition-colors hover:border-orange-300/70">
                            <Label
                                htmlFor="show_results_at_last_slide"
                                className="flex-1 cursor-pointer text-sm font-medium text-slate-700"
                            >
                                <div className="flex items-center gap-1.5">
                                    <Trophy className="size-4 text-amber-500" />
                                    Show Leaderboard at End
                                </div>
                                <p className="mt-0.5 text-xs text-slate-400 font-normal">
                                    Hides correct/wrong during session. Shows final leaderboard.
                                </p>
                            </Label>
                            <Switch
                                id="show_results_at_last_slide"
                                name="show_results_at_last_slide"
                                checked={options.show_results_at_last_slide}
                                onCheckedChange={(checked) =>
                                    handleSwitchChange('show_results_at_last_slide', checked)
                                }
                                className="data-[state=checked]:bg-orange-500"
                            />
                        </div>

                        {/* Scoring Config — visible only when show_results_at_last_slide is ON */}
                        {options.show_results_at_last_slide && (
                            <div className="ml-2 space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Trophy className="size-3.5" />
                                    Scoring Configuration
                                </p>

                                <div>
                                    <Label
                                        htmlFor="points_per_correct_answer"
                                        className="mb-1 block text-sm font-medium text-slate-700"
                                    >
                                        Points per Correct Answer
                                    </Label>
                                    <Input
                                        type="number"
                                        id="points_per_correct_answer"
                                        name="points_per_correct_answer"
                                        value={options.points_per_correct_answer}
                                        onChange={handleInputChange}
                                        min="1"
                                        className="w-full rounded-md border-slate-300 p-2 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                                        placeholder="e.g., 10"
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-2.5">
                                    <Label
                                        htmlFor="negative_marking_enabled"
                                        className="flex-1 cursor-pointer text-sm font-medium text-slate-700"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <MinusCircle className="size-3.5 text-red-400" />
                                            Enable Negative Marking
                                        </div>
                                    </Label>
                                    <Switch
                                        id="negative_marking_enabled"
                                        name="negative_marking_enabled"
                                        checked={options.negative_marking_enabled}
                                        onCheckedChange={(checked) =>
                                            handleSwitchChange('negative_marking_enabled', checked)
                                        }
                                        className="data-[state=checked]:bg-red-500"
                                    />
                                </div>

                                {options.negative_marking_enabled && (
                                    <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                                        <Label
                                            htmlFor="negative_marks_per_wrong_answer"
                                            className="mb-1 block text-sm font-medium text-slate-700"
                                        >
                                            Marks Deducted per Wrong Answer
                                        </Label>
                                        <Input
                                            type="number"
                                            id="negative_marks_per_wrong_answer"
                                            name="negative_marks_per_wrong_answer"
                                            value={options.negative_marks_per_wrong_answer}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.5"
                                            className="w-full rounded-md border-slate-300 p-2 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                                            placeholder="e.g., 2"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3 transition-colors hover:border-orange-300/70">
                            <Label
                                htmlFor="allow_chat"
                                className="flex-1 cursor-pointer text-sm font-medium text-slate-700"
                            >
                                Allow Learners Chat
                            </Label>
                            <Switch
                                id="allow_chat"
                                name="allow_chat"
                                checked={options.allow_chat}
                                onCheckedChange={(checked) =>
                                    handleSwitchChange('allow_chat', checked)
                                }
                                className="data-[state=checked]:bg-orange-500"
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3 transition-colors hover:border-orange-300/70">
                            <Label
                                htmlFor="is_session_recorded"
                                className="flex-1 cursor-pointer text-sm font-medium text-slate-700"
                            >
                                Record Presentation Audio
                            </Label>
                            <Switch
                                id="is_session_recorded"
                                name="is_session_recorded"
                                checked={options.is_session_recorded}
                                onCheckedChange={(checked) =>
                                    handleSwitchChange('is_session_recorded', checked)
                                }
                                className="data-[state=checked]:bg-green-500"
                            />
                        </div>
                    </div>

                    {/* Numeric Inputs */}
                    <div className="space-y-4 pt-2">
                        <div>
                            <Label
                                htmlFor="default_seconds_for_question"
                                className="mb-1.5 block text-sm font-medium text-slate-700"
                            >
                                <div className="flex items-center gap-1.5">
                                    <Timer className="size-4 text-blue-500" />
                                    Seconds per Question (Timer)
                                </div>
                                <p className="mt-0.5 text-xs text-slate-400 font-normal">
                                    Participants see a countdown. Submission disabled when time's up.
                                </p>
                            </Label>
                            <Input
                                type="number"
                                id="default_seconds_for_question"
                                name="default_seconds_for_question"
                                value={options.default_seconds_for_question}
                                onChange={handleInputChange}
                                min="10"
                                className="w-full rounded-md border-slate-300 p-2.5 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                                placeholder="e.g., 60"
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isCreatingSession}
                            className="rounded-lg border-slate-300 px-5 py-2 text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isCreatingSession}
                            className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-white hover:bg-orange-600 focus-visible:ring-orange-400"
                        >
                            {isCreatingSession ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create & Start'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
