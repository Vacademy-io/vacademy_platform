import { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MyButton } from '@/components/design-system/button';
import { X, MagnifyingGlass, Upload, UserPlus } from '@phosphor-icons/react';
import { useAutosuggestUsers } from '../../../../-hooks/useAutosuggestUsers';
import {
    AutosuggestUser,
    LearnerSourceMode,
    NewUserRow,
    SelectedLearner,
} from '../../../../-types/bulk-assign-types';
import { CsvUserImporter } from '../../components/CsvUserImporter';
import { ManualUserEntry } from '../../components/ManualUserEntry';
import { FromCourseSelector } from '../../components/FromCourseSelector';

interface Props {
    instituteId: string;
    selectedLearners: SelectedLearner[];
    onSelectedLearnersChange: (learners: SelectedLearner[]) => void;
}

export const Step1LearnerSelector = ({
    instituteId,
    selectedLearners,
    onSelectedLearnersChange,
}: Props) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [mode, setMode] = useState<LearnerSourceMode>('search');
    const searchRef = useRef<HTMLInputElement>(null);

    const { data: suggestedUsers, isFetching } = useAutosuggestUsers({
        instituteId,
        query: searchQuery,
        roles: ['STUDENT'],
        enabled: mode === 'search',
    });

    const addExistingUser = (user: AutosuggestUser) => {
        if (selectedLearners.some((l) => l.type === 'existing' && l.userId === user.id)) return;
        onSelectedLearnersChange([
            ...selectedLearners,
            {
                type: 'existing',
                userId: user.id,
                email: user.email,
                name: user.full_name || user.username,
            },
        ]);
        setSearchQuery('');
    };

    const addNewUsers = (rows: NewUserRow[]) => {
        const newLearners: SelectedLearner[] = rows.map((row) => ({ type: 'new', newUser: row }));
        onSelectedLearnersChange([...selectedLearners, ...newLearners]);
    };

    const removeLearner = (index: number) => {
        const next = [...selectedLearners];
        next.splice(index, 1);
        onSelectedLearnersChange(next);
    };

    const getLearnerLabel = (l: SelectedLearner) =>
        l.type === 'existing' ? l.name || l.email : l.newUser.full_name || l.newUser.email;

    const getLearnerSub = (l: SelectedLearner) =>
        l.type === 'existing' ? l.email : '(new user)';

    return (
        <div className="flex h-full flex-col gap-4 px-6 py-5">
            {/* Selected learners chip list */}
            {selectedLearners.length > 0 && (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <p className="mb-2 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                        {selectedLearners.length} learner{selectedLearners.length !== 1 ? 's' : ''} selected
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {selectedLearners.map((l, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs text-primary-700"
                            >
                                <div>
                                    <span className="font-medium">{getLearnerLabel(l)}</span>
                                    <span className="ml-1 text-primary-400">{getLearnerSub(l)}</span>
                                </div>
                                <button
                                    onClick={() => removeLearner(idx)}
                                    className="ml-1 rounded-full text-primary-400 hover:text-primary-700"
                                >
                                    <X size={12} weight="bold" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Source mode tabs */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as LearnerSourceMode)}>
                <TabsList className="w-full">
                    <TabsTrigger value="search" className="flex-1">
                        <MagnifyingGlass size={14} className="mr-1.5" />
                        Search Existing
                    </TabsTrigger>
                    <TabsTrigger value="from_course" className="flex-1">
                        <UserPlus size={14} className="mr-1.5" />
                        From Course
                    </TabsTrigger>
                    <TabsTrigger value="csv" className="flex-1">
                        <Upload size={14} className="mr-1.5" />
                        Import CSV
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="flex-1">
                        <UserPlus size={14} className="mr-1.5" />
                        Add Manually
                    </TabsTrigger>
                </TabsList>

                {/* TAB: Search existing students */}
                <TabsContent value="search" className="mt-4">
                    <div className="relative">
                        <MagnifyingGlass
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <Input
                            ref={searchRef}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, email, or username…"
                            className="pl-9"
                        />
                    </div>
                    {isFetching && (
                        <p className="mt-3 text-xs text-neutral-400">Searching…</p>
                    )}
                    {!isFetching && suggestedUsers && suggestedUsers.length > 0 && (
                        <div className="mt-2 rounded-lg border border-neutral-200 bg-white shadow-sm">
                            {suggestedUsers.map((u: AutosuggestUser) => {
                                const alreadyAdded = selectedLearners.some(
                                    (l) => l.type === 'existing' && l.userId === u.id
                                );
                                return (
                                    <button
                                        key={u.id}
                                        onClick={() => addExistingUser(u)}
                                        disabled={alreadyAdded}
                                        className={`flex w-full items-center justify-between border-b border-neutral-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-primary-50 disabled:opacity-50 ${alreadyAdded ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                        <div>
                                            <p className="font-medium text-neutral-800">
                                                {u.full_name || u.username}
                                            </p>
                                            <p className="text-xs text-neutral-400">{u.email}</p>
                                        </div>
                                        {alreadyAdded ? (
                                            <Badge variant="secondary">Added</Badge>
                                        ) : (
                                            <span className="text-xs font-medium text-primary-500">
                                                + Add
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {!isFetching && searchQuery.length >= 2 && (!suggestedUsers || suggestedUsers.length === 0) && (
                        <p className="mt-4 text-center text-sm text-neutral-400">
                            No students found matching "{searchQuery}"
                        </p>
                    )}
                    {searchQuery.length < 2 && (
                        <p className="mt-4 text-center text-sm text-neutral-400">
                            Type at least 2 characters to search
                        </p>
                    )}
                </TabsContent>

                {/* TAB: From another course */}
                <TabsContent value="from_course" className="mt-4">
                    <FromCourseSelector
                        instituteId={instituteId}
                        selectedLearners={selectedLearners}
                        onAdd={(newOnes: SelectedLearner[]) =>
                            onSelectedLearnersChange([...selectedLearners, ...newOnes])
                        }
                    />
                </TabsContent>

                {/* TAB: CSV import */}
                <TabsContent value="csv" className="mt-4">
                    <CsvUserImporter onImport={addNewUsers} />
                </TabsContent>

                {/* TAB: Manual entry */}
                <TabsContent value="manual" className="mt-4">
                    <ManualUserEntry onAdd={addNewUsers} />
                </TabsContent>
            </Tabs>
        </div>
    );
};
