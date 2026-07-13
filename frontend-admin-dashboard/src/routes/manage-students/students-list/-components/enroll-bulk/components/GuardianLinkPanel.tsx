import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { MyInput } from '@/components/design-system/input';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { useAutosuggestUsers } from '../../../-hooks/useAutosuggestUsers';
import { AutosuggestUser, ParentLinkPersonInput } from '../../../-types/bulk-assign-types';

const createNewSchema = z.object({
    fullName: z.string().min(1, 'Name is required'),
    email: z.string().email('Enter a valid email'),
    mobileNumber: z.string().optional(),
});
type CreateNewFormValues = z.infer<typeof createNewSchema>;

interface Props {
    instituteId: string;
    /** "Student" or "Guardian" — used in tab labels and copy. */
    personLabel: string;
    /** Roles to filter the "link existing" autosuggest search by. */
    searchRoles: string[];
    value: ParentLinkPersonInput | undefined;
    onChange: (value: ParentLinkPersonInput) => void;
}

/**
 * Reusable "Add {person}" / "Link Existing {person}" picker used inside a
 * learner chip's guardian-link sub-form — for either the student (when the
 * chip itself is flagged as the guardian) or the guardian (when adding one
 * for the chip).
 */
export const GuardianLinkPanel = ({ instituteId, personLabel, searchRoles, value, onChange }: Props) => {
    const [tab, setTab] = useState<'create_new' | 'link_existing'>(value?.kind ?? 'create_new');
    const [searchQuery, setSearchQuery] = useState('');

    const form = useForm<CreateNewFormValues>({
        resolver: zodResolver(createNewSchema),
        mode: 'onChange',
        defaultValues: {
            fullName: value?.kind === 'create_new' ? value.fullName : '',
            email: value?.kind === 'create_new' ? value.email : '',
            mobileNumber: value?.kind === 'create_new' ? value.mobileNumber : '',
        },
    });

    const emitCreateNew = <K extends keyof CreateNewFormValues>(field: K, fieldValue: string) => {
        // react-hook-form's setValue overload can't verify a generic `string`
        // matches PathValueImpl<K> for an arbitrary K — every field on this
        // form is in fact a plain string, so the cast is safe.
        form.setValue(field, fieldValue as CreateNewFormValues[K], { shouldValidate: true });
        const next = { ...form.getValues(), [field]: fieldValue };
        onChange({
            kind: 'create_new',
            fullName: next.fullName || '',
            email: next.email || '',
            mobileNumber: next.mobileNumber || '',
        });
    };

    const { data: suggestedUsers, isFetching } = useAutosuggestUsers({
        instituteId,
        query: searchQuery,
        roles: searchRoles,
        enabled: tab === 'link_existing',
    });

    const selectedExisting = value?.kind === 'link_existing' ? value : null;

    const selectExisting = (u: AutosuggestUser) => {
        onChange({ kind: 'link_existing', userId: u.id, name: u.full_name || u.username, email: u.email });
        setSearchQuery('');
    };

    const clearExisting = () => {
        onChange({ kind: 'link_existing', userId: '', name: '', email: '' });
    };

    return (
        <div className="rounded-md border border-neutral-200 bg-white p-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'create_new' | 'link_existing')}>
                <TabsList className="h-8 w-full">
                    <TabsTrigger value="create_new" className="flex-1 text-caption">
                        Add {personLabel}
                    </TabsTrigger>
                    <TabsTrigger value="link_existing" className="flex-1 text-caption">
                        Link Existing {personLabel}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="create_new" className="mt-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        <MyInput
                            label="Full name"
                            required
                            size="small"
                            inputType="text"
                            inputPlaceholder={`${personLabel}'s full name`}
                            input={form.watch('fullName')}
                            onChangeFunction={(e) => emitCreateNew('fullName', e.target.value)}
                            error={form.formState.errors.fullName?.message}
                        />
                        <MyInput
                            label="Email"
                            required
                            size="small"
                            inputType="email"
                            inputPlaceholder="name@example.com"
                            input={form.watch('email')}
                            onChangeFunction={(e) => emitCreateNew('email', e.target.value)}
                            error={form.formState.errors.email?.message}
                        />
                        <MyInput
                            label="Mobile (optional)"
                            size="small"
                            inputType="tel"
                            inputPlaceholder="9876543210"
                            input={form.watch('mobileNumber')}
                            onChangeFunction={(e) => emitCreateNew('mobileNumber', e.target.value)}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="link_existing" className="mt-3">
                    {selectedExisting?.userId ? (
                        <div className="flex items-center justify-between rounded-md border border-primary-200 bg-primary-50 px-3 py-2">
                            <div>
                                <p className="text-caption font-medium text-primary-700">
                                    {selectedExisting.name}
                                </p>
                                <p className="text-caption text-primary-400">{selectedExisting.email}</p>
                            </div>
                            <button
                                type="button"
                                onClick={clearExisting}
                                className="rounded-full text-primary-400 hover:text-primary-700"
                                title="Change"
                            >
                                <X size={12} weight="bold" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="relative">
                                <MagnifyingGlass
                                    size={14}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                                />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={`Search ${personLabel.toLowerCase()} by name, email…`}
                                    className="h-8 pl-9 text-caption"
                                />
                            </div>
                            {isFetching && <p className="mt-2 text-caption text-neutral-400">Searching…</p>}
                            {!isFetching && suggestedUsers && suggestedUsers.length > 0 && (
                                <div className="mt-2 rounded-md border border-neutral-200 bg-white shadow-sm">
                                    {suggestedUsers.map((u: AutosuggestUser) => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            onClick={() => selectExisting(u)}
                                            className="flex w-full items-center justify-between border-b border-neutral-100 px-3 py-2 text-left text-caption last:border-b-0 hover:bg-primary-50"
                                        >
                                            <div>
                                                <p className="font-medium text-neutral-800">
                                                    {u.full_name || u.username}
                                                </p>
                                                <p className="text-caption text-neutral-400">{u.email}</p>
                                            </div>
                                            <span className="font-medium text-primary-500">+ Select</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {!isFetching && searchQuery.length >= 2 && (!suggestedUsers || suggestedUsers.length === 0) && (
                                <p className="mt-2 text-caption text-neutral-400">
                                    No {personLabel.toLowerCase()} found matching "{searchQuery}"
                                </p>
                            )}
                            {searchQuery.length < 2 && (
                                <p className="mt-2 text-caption text-neutral-400">
                                    Type at least 2 characters to search
                                </p>
                            )}
                        </>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};
