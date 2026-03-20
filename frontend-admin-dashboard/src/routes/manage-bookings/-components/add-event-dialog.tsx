import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateBooking, useAutoSuggestUsers } from '../-hooks/use-booking-data';
import { getInstituteId } from '@/constants/helper';
import { toast } from 'sonner';
import { BookingType } from '../-types/booking-types';
import { Textarea } from '@/components/ui/textarea';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
// import { useDebounce } from '@uidotdev/usehooks';

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

interface AddEventDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    bookingType: BookingType;
}

interface UserOption {
    id: string;
    fullName: string;
    email: string;
}

export const AddEventDialog = ({ open, onOpenChange, bookingType }: AddEventDialogProps) => {
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
    const [openCombobox, setOpenCombobox] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Debounce the search query to avoid too many API calls
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    const instituteId = getInstituteId();
    const { mutate: createBooking, isPending } = useCreateBooking();

    // Fetch users based on search
    const { data: userSuggestions } = useAutoSuggestUsers(
        instituteId,
        debouncedSearchQuery,
        undefined // Fetch all roles for now, or could filter by roles if needed
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!instituteId) return;

        const startDateTime = new Date(`${date}T${startTime}`);
        const endDateTime = new Date(`${date}T${endTime}`);

        const toIsoWithOffset = (d: Date) => {
            const pad = (n: number) => (n < 10 ? '0' + n : n);
            const tzo = -d.getTimezoneOffset();
            const dif = tzo >= 0 ? '+' : '-';
            return (
                d.getFullYear() +
                '-' +
                pad(d.getMonth() + 1) +
                '-' +
                pad(d.getDate()) +
                'T' +
                pad(d.getHours()) +
                ':' +
                pad(d.getMinutes()) +
                ':' +
                pad(d.getSeconds()) +
                '.000' +
                dif +
                pad(Math.floor(Math.abs(tzo) / 60)) +
                ':' +
                pad(Math.abs(tzo) % 60)
            );
        };

        createBooking(
            {
                institute_id: instituteId,
                title,
                subject,
                description_html: `<p>${description}</p>`,
                start_time: toIsoWithOffset(startDateTime),
                last_entry_time: toIsoWithOffset(endDateTime),
                session_end_date: date,
                booking_type_id: bookingType.id,
                time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                participant_user_ids: selectedUsers.map((u) => u.id),
            },
            {
                onSuccess: () => {
                    toast.success('Event created successfully');
                    onOpenChange(false);
                    // Reset form
                    setTitle('');
                    setSubject('');
                    setDescription('');
                    setDate('');
                    setStartTime('');
                    setEndTime('');
                    setSelectedUsers([]);
                    setSearchQuery('');
                },
                onError: (error) => {
                    toast.error('Failed to create event');
                    console.error(error);
                },
            }
        );
    };

    const handleSelectUser = (user: UserOption) => {
        if (!selectedUsers.some((u) => u.id === user.id)) {
            setSelectedUsers([...selectedUsers, user]);
        }
        setOpenCombobox(false);
        setSearchQuery('');
    };

    const handleRemoveUser = (userId: string) => {
        setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="overflow-visible sm:max-w-[600px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Quick Add Event</DialogTitle>
                        <DialogDescription>
                            Create a quick {bookingType.type} event and add participants.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                Title
                            </Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="col-span-3"
                                placeholder="Meeting Title"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="participants" className="text-right">
                                Participants
                            </Label>
                            <div className="col-span-3 flex flex-col gap-2">
                                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openCombobox}
                                            className="w-full justify-between"
                                        >
                                            Add participants...
                                            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0" align="start">
                                        <Command shouldFilter={false}>
                                            <CommandInput
                                                placeholder="Search user by name or email..."
                                                value={searchQuery}
                                                onValueChange={setSearchQuery}
                                            />
                                            <CommandList>
                                                {debouncedSearchQuery.length < 3 && (
                                                    <div className="py-6 text-center text-sm">
                                                        Type at least 3 characters to search...
                                                    </div>
                                                )}
                                                {debouncedSearchQuery.length >= 3 &&
                                                    userSuggestions?.length === 0 && (
                                                        <CommandEmpty>No users found.</CommandEmpty>
                                                    )}
                                                {debouncedSearchQuery.length >= 3 &&
                                                    userSuggestions?.map((user) => (
                                                        <CommandItem
                                                            key={user.id}
                                                            value={user.id}
                                                            onSelect={() =>
                                                                handleSelectUser({
                                                                    id: user.id,
                                                                    fullName: user.fullName,
                                                                    email: user.email,
                                                                })
                                                            }
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    'mr-2 h-4 w-4',
                                                                    selectedUsers.some(
                                                                        (u) => u.id === user.id
                                                                    )
                                                                        ? 'opacity-100'
                                                                        : 'opacity-0'
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span>{user.fullName}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {user.email}
                                                                </span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                {selectedUsers.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {selectedUsers.map((user) => (
                                            <Badge
                                                key={user.id}
                                                variant="secondary"
                                                className="flex items-center gap-1"
                                            >
                                                {user.fullName}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveUser(user.id)}
                                                    className="rounded-full p-0.5 hover:bg-muted"
                                                >
                                                    <X className="size-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="subject" className="text-right">
                                Subject
                            </Label>
                            <Input
                                id="subject"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="col-span-3"
                                placeholder="Subject"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="date" className="text-right">
                                Date
                            </Label>
                            <Input
                                id="date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="start-time" className="text-right">
                                Time
                            </Label>
                            <div className="col-span-3 flex gap-2">
                                <Input
                                    id="start-time"
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    required
                                    className="flex-1"
                                />
                                <span className="flex items-center">-</span>
                                <Input
                                    id="end-time"
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    required
                                    className="flex-1"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">
                                Description
                            </Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? 'Creating...' : 'Create Event'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
