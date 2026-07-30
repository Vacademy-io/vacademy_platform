import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check } from '@phosphor-icons/react';
import { MyInput } from '@/components/design-system/input';
import { cn } from '@/lib/utils';
import { searchStudents } from '../-services/mentorship-service';
import type { StudentRow } from '../-types/mentorship-types';

interface MenteePickerProps {
    instituteId: string;
    selected: StudentRow[];
    onChange: (rows: StudentRow[]) => void;
}

/** Search enrolled (ACTIVE) students and multi-select them for assignment. */
export function MenteePicker({ instituteId, selected, onChange }: MenteePickerProps) {
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebounced(query), 300);
        return () => clearTimeout(t);
    }, [query]);

    const { data, isLoading } = useQuery({
        queryKey: ['mentorship-student-search', instituteId, debounced],
        queryFn: () => searchStudents({ instituteId, name: debounced }),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });

    const selectedIds = useMemo(() => new Set(selected.map((s) => s.user_id)), [selected]);
    const results = data?.content ?? [];

    const toggle = (row: StudentRow) => {
        if (selectedIds.has(row.user_id)) {
            onChange(selected.filter((s) => s.user_id !== row.user_id));
        } else {
            onChange([...selected, row]);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <MyInput
                input={query}
                onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                inputType="text"
                inputPlaceholder="Search enrolled students by name"
                label="Students"
            />
            {selected.length > 0 && (
                <span className="text-caption text-neutral-500">{selected.length} selected</span>
            )}
            <div className="max-h-64 overflow-y-auto rounded-md border border-neutral-200">
                {isLoading ? (
                    <div className="p-4 text-body text-neutral-400">Searching…</div>
                ) : results.length === 0 ? (
                    <div className="p-4 text-body text-neutral-400">
                        {debounced ? 'No students found' : 'Type a name to search students'}
                    </div>
                ) : (
                    results.map((row) => {
                        const isSel = selectedIds.has(row.user_id);
                        return (
                            <button
                                type="button"
                                key={row.user_id}
                                onClick={() => toggle(row)}
                                className={cn(
                                    'flex w-full items-center justify-between gap-3 border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50',
                                    isSel && 'bg-primary-50'
                                )}
                            >
                                <span className="flex flex-col">
                                    <span className="text-body text-neutral-700">
                                        {row.full_name || row.username || row.user_id}
                                    </span>
                                    {row.email && (
                                        <span className="text-caption text-neutral-400">{row.email}</span>
                                    )}
                                </span>
                                {isSel && <Check size={18} weight="bold" className="text-primary-500" />}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
