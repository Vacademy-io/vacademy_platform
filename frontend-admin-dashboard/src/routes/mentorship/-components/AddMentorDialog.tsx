import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, UploadSimple, UserCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MyDialog } from '@/components/design-system/dialog';
import { getUserId } from '@/utils/userDetails';
import { useFileUpload } from '@/hooks/use-file-upload';
import {
    fetchEligibleOrgUsers,
    type InstituteUser,
} from '@/routes/manage-institute/teams/-services/institute-users-service';
import { useCreateMentor } from '../-hooks/use-mentorship';

interface AddMentorDialogProps {
    instituteId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function initials(name?: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? '').concat(parts.length > 1 ? (parts[1]?.[0] ?? '') : '').toUpperCase() || '?';
}

/**
 * Make an existing institute team member (staff) a mentor: pick them from the
 * team, optionally set a mentor photo / display name / title / bio.
 */
export function AddMentorDialog({ instituteId, open, onOpenChange }: AddMentorDialogProps) {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<InstituteUser | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [title, setTitle] = useState('');
    const [bio, setBio] = useState('');
    const [photoFileId, setPhotoFileId] = useState<string | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const createMentor = useCreateMentor();
    const { uploadFile, getPublicUrl } = useFileUpload();

    const membersQuery = useQuery({
        queryKey: ['mentorship-eligible-org-users', instituteId],
        enabled: !!instituteId && open,
        queryFn: () => fetchEligibleOrgUsers(instituteId),
        staleTime: 60_000,
    });

    const members = membersQuery.data ?? [];
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return members;
        return members.filter(
            (m) =>
                (m.full_name || '').toLowerCase().includes(q) ||
                (m.email || '').toLowerCase().includes(q)
        );
    }, [members, search]);

    const reset = () => {
        setSearch('');
        setSelected(null);
        setDisplayName('');
        setTitle('');
        setBio('');
        setPhotoFileId(null);
        setPhotoUrl(null);
    };

    const pick = async (m: InstituteUser) => {
        setSelected(m);
        setDisplayName((prev) => prev || m.full_name || '');
        // Default the mentor photo to the member's existing team avatar (admin can replace).
        if (m.profile_pic_file_id) {
            setPhotoFileId(m.profile_pic_file_id);
            try {
                setPhotoUrl(await getPublicUrl(m.profile_pic_file_id));
            } catch {
                /* avatar is best-effort */
            }
        }
    };

    const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingPhoto(true);
        try {
            const fileId = await uploadFile({
                file,
                setIsUploading: setUploadingPhoto,
                userId: getUserId() || 'admin',
                source: instituteId,
                sourceId: 'MENTORS',
            });
            if (fileId) {
                setPhotoFileId(fileId);
                setPhotoUrl(await getPublicUrl(fileId));
            }
        } catch {
            toast.error('Photo upload failed');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const submit = async () => {
        if (!selected) {
            toast.error('Select a team member');
            return;
        }
        setSubmitting(true);
        try {
            await createMentor.mutateAsync({
                institute_id: instituteId,
                user_id: selected.id,
                display_name: displayName || selected.full_name,
                title,
                bio,
                profile_image_file_id: photoFileId || undefined,
            });
            toast.success('Mentor added');
            reset();
            onOpenChange(false);
        } catch {
            toast.error('Failed to add mentor');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <MyDialog
            heading="Add mentor"
            open={open}
            onOpenChange={(o) => {
                if (!o) reset();
                onOpenChange(o);
            }}
            dialogWidth="max-w-lg"
            footer={
                <div className="flex justify-end gap-2">
                    <MyButton type="button" buttonType="secondary" scale="medium" onClick={() => onOpenChange(false)}>
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        onClick={submit}
                        disable={submitting || !selected}
                        title={!selected ? 'Choose a team member above first' : undefined}
                    >
                        {submitting ? 'Adding…' : 'Add mentor'}
                    </MyButton>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="text-body text-neutral-600">
                    Pick a member of your institute&apos;s team to make them a mentor. They get the
                    Mentor role and appear to their assigned students.
                </p>

                {!selected ? (
                    <div className="flex flex-col gap-2">
                        <span className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
                            Choose a team member
                        </span>
                        <MyInput
                            input={search}
                            onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                            inputType="text"
                            inputPlaceholder="Search your team by name or email"
                            label="Team member"
                        />
                        <div className="max-h-64 overflow-y-auto rounded-md border border-neutral-200">
                            {membersQuery.isLoading ? (
                                <div className="p-4 text-body text-neutral-400">Loading team…</div>
                            ) : membersQuery.isError ? (
                                <div className="p-4 text-body text-danger-600">Couldn&apos;t load your team.</div>
                            ) : filtered.length === 0 ? (
                                <div className="p-4 text-body text-neutral-400">
                                    {members.length === 0 ? 'No team members found.' : 'No matches.'}
                                </div>
                            ) : (
                                filtered.map((m) => (
                                    <button
                                        type="button"
                                        key={m.id}
                                        onClick={() => pick(m)}
                                        className="flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50"
                                    >
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-caption font-semibold text-primary-600">
                                            {initials(m.full_name)}
                                        </span>
                                        <span className="flex flex-col">
                                            <span className="text-body text-neutral-700">
                                                {m.full_name || m.email || m.id}
                                            </span>
                                            <span className="text-caption text-neutral-400">
                                                {m.email}
                                                {m.roles && m.roles.length ? ` · ${m.roles.join(', ')}` : ''}
                                            </span>
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-3 rounded-md border border-primary-200 bg-primary-50 px-3 py-2">
                            <div className="flex items-center gap-2">
                                <Check size={16} weight="bold" className="text-primary-500" />
                                <div className="flex flex-col">
                                    <span className="text-body font-medium text-neutral-700">
                                        {selected.full_name || selected.email}
                                    </span>
                                    <span className="text-caption text-neutral-400">{selected.email}</span>
                                </div>
                            </div>
                            <MyButton
                                type="button"
                                buttonType="text"
                                scale="small"
                                onClick={() => setSelected(null)}
                                title="Pick a different team member"
                            >
                                Change
                            </MyButton>
                        </div>

                        <span className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
                            Mentor profile
                        </span>
                        <p className="-mt-2 text-caption text-neutral-400">
                            How this mentor appears to their assigned students.
                        </p>

                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-neutral-100">
                                {photoUrl ? (
                                    <img src={photoUrl} alt="Mentor" className="h-full w-full object-cover" />
                                ) : (
                                    <UserCircle size={40} className="text-neutral-300" />
                                )}
                            </div>
                            <div className="flex flex-col gap-1">
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => fileInputRef.current?.click()}
                                    disable={uploadingPhoto}
                                >
                                    <UploadSimple size={16} />{' '}
                                    {uploadingPhoto ? 'Uploading…' : photoUrl ? 'Change photo' : 'Upload photo'}
                                </MyButton>
                                <span className="text-caption text-neutral-400">
                                    Optional. Defaults to their team profile photo.
                                </span>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={onPhotoChange}
                            />
                        </div>

                        <MyInput
                            input={displayName}
                            onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                            inputType="text"
                            inputPlaceholder={selected.full_name || 'Display name'}
                            label="Display name"
                        />
                        <MyInput
                            input={title}
                            onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                            inputType="text"
                            inputPlaceholder="e.g. Senior Career Mentor"
                            label="Title"
                        />
                        <MyInput
                            input={bio}
                            onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) => setBio(e.target.value)}
                            inputType="text"
                            inputPlaceholder="Short bio (optional)"
                            label="Bio"
                        />
                    </>
                )}
            </div>
        </MyDialog>
    );
}
