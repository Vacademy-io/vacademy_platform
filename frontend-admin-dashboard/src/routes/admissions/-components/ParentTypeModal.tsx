import React from 'react';
import { X, User } from 'lucide-react';

interface ParentTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: 'father' | 'mother') => void;
}

export const ParentTypeModal: React.FC<ParentTypeModalProps> = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl border border-neutral-100 scale-in-center">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-neutral-900">Select Parent Type</h2>
                        <p className="mt-1 text-sm text-neutral-500">
                            Specify if the contact details belong to the father or mother
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-neutral-100 text-neutral-400 transition-colors"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <div className="mt-6 space-y-3">
                    <button
                        onClick={() => onSelect('father')}
                        className="flex w-full items-center gap-4 rounded-xl border border-neutral-200 p-4 text-left transition-all hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-md group"
                    >
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                            <User className="size-6 transition-transform group-hover:scale-110" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-neutral-900">Father</h3>
                            <p className="text-sm text-neutral-500">Map details to father's info</p>
                        </div>
                    </button>

                    <button
                        onClick={() => onSelect('mother')}
                        className="flex w-full items-center gap-4 rounded-xl border border-neutral-200 p-4 text-left transition-all hover:border-pink-500 hover:bg-pink-50/50 hover:shadow-md group"
                    >
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600 group-hover:bg-pink-600 group-hover:text-white transition-colors shadow-sm">
                            <User className="size-6 transition-transform group-hover:scale-110" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-neutral-900">Mother</h3>
                            <p className="text-sm text-neutral-500">Map details to mother's info</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};
