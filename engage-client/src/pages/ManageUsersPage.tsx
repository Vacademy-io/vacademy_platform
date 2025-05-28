import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreHorizontal, Trash2, Edit3, MessageSquarePlus, UserPlus, Upload, X, Send, Loader2 as SpinnerIcon } from 'lucide-react'; // Added Send, SpinnerIcon
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Import Select components
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse'; // Keep as default import
import type { ParseResult, ParseError } from 'papaparse'; // Import types separately
import { toast } from "sonner";
import { cn } from "@/lib/utils"; // For conditional classnames

// Define a type for our user data
interface User {
  id: string;
  name: string;
  whatsappNumber: string;
}

// Expected CSV Row structure
interface CsvRow {
  name?: string;
  whatsappNumber?: string;
  // Allow other columns, but we only care about these two
  [key: string]: any; 
}

// Define message templates
const MESSAGE_TEMPLATES = [
  { id: 'template1', name: 'Welcome Message', content: 'Hello {name}! Welcome to our service.' },
  { id: 'template2', name: 'Update Reminder', content: 'Hi {name}, just a friendly reminder about the update.' },
  { id: 'template3', name: 'Special Offer', content: 'Hey {name}, we have a special offer for you!' },
];

type MessageSendingStatus = 'pending' | 'sending' | 'sent' | 'failed';
interface UserMessageStatus {
    userId: string;
    name: string;
    status: MessageSendingStatus;
    error?: string;
}

const ManageUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([
    { id: '1', name: 'Alice Wonderland', whatsappNumber: '11234567890' },
    { id: '2', name: 'Bob The Builder', whatsappNumber: '19876543210' },
    { id: '3', name: 'Charlie Chaplin', whatsappNumber: '15551234567' },
    { id: '4', name: 'Diana Prince', whatsappNumber: '15559876543' },
  ]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // State for Add User Dialog
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserWhatsapp, setNewUserWhatsapp] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [csvProcessingError, setCsvProcessingError] = useState<string | null>(null); // For CSV errors

  // Edit User Dialog state
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserWhatsapp, setEditUserWhatsapp] = useState('');
  const [editFormError, setEditFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input

  // Send Message Dialog state
  const [isSendMessageDialogOpen, setIsSendMessageDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(MESSAGE_TEMPLATES[0]?.id);
  const [userMessageStatuses, setUserMessageStatuses] = useState<UserMessageStatus[]>([]);
  const [isBulkSending, setIsBulkSending] = useState(false);

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedUserIds(new Set(users.map(user => user.id)));
    } else {
      setSelectedUserIds(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean | 'indeterminate') => {
    const newSelectedUserIds = new Set(selectedUserIds);
    if (checked === true) {
      newSelectedUserIds.add(userId);
    } else {
      newSelectedUserIds.delete(userId);
    }
    setSelectedUserIds(newSelectedUserIds);
  };

  const isUserSelected = (userId: string) => selectedUserIds.has(userId);
  const areAllUsersSelected = users.length > 0 && selectedUserIds.size === users.length;
  const isSomeUserSelected = selectedUserIds.size > 0 && selectedUserIds.size < users.length;

  const handleImportCsvClick = () => {
    fileInputRef.current?.click(); // Trigger hidden file input
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setCsvProcessingError(null);
    toast.info("Processing CSV file...", { id: 'csv-processing' });

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<CsvRow>) => {
        const { data, errors: parseErrors } = results;
        if (parseErrors.length > 0) {
          console.error("CSV parsing errors:", parseErrors);
          const errorMessages = parseErrors.slice(0,3).map((err: ParseError) => `Row ${err.row}: ${err.message}`).join("; \n");
          toast.error(`Error parsing CSV: ${errorMessages}`, { id: 'csv-processing' });
          setCsvProcessingError(`Some rows could not be parsed. Please check console for details.`);
          return;
        }

        let importedCount = 0;
        let invalidCount = 0;
        const newUsersFromCsv: User[] = [];
        const validationErrorMessages: string[] = [];

        data.forEach((row: CsvRow, index: number) => {
          const name = row.name?.trim();
          const whatsappNumber = row.whatsappNumber?.trim();

          if (!name || !whatsappNumber) {
            invalidCount++;
            validationErrorMessages.push(`Row ${index + 2}: Missing name or WhatsApp number.`);
            return;
          }
          if (!/^\d{10,15}$/.test(whatsappNumber)) {
            invalidCount++;
            validationErrorMessages.push(`Row ${index + 2}: Invalid WhatsApp format for '${whatsappNumber}' (must be 10-15 digits).`);
            return;
          }

          newUsersFromCsv.push({
            id: uuidv4(),
            name,
            whatsappNumber,
          });
          importedCount++;
        });

        if (newUsersFromCsv.length > 0) {
          setUsers(prevUsers => [...newUsersFromCsv, ...prevUsers]);
        }
        
        if (invalidCount > 0) {
            toast.warning(
                `CSV Processed: ${importedCount} users imported. ${invalidCount} rows had issues.`, 
                { 
                    id: 'csv-processing', 
                    description: validationErrorMessages.slice(0,5).join(" \n"),
                    duration: 8000 
                }
            );
        } else if (importedCount > 0) {
            toast.success(`${importedCount} users successfully imported from CSV.`, { id: 'csv-processing' });
        } else if (parseErrors.length === 0) {
            toast.error("No valid users found in the CSV to import.", { id: 'csv-processing' });
        }
      },
      error: (error: Error) => {
        console.error("Papaparse error:", error);
        toast.error(`Failed to parse CSV: ${error.message}`, { id: 'csv-processing' });
        setCsvProcessingError("An unexpected error occurred while parsing the CSV.");
      }
    });

    // Reset file input to allow re-uploading the same file if needed
    if (event.target) {
      event.target.value = '';
    }
  };

  // Placeholder functions for actions - to be implemented later
  const handleSendWhatsapp = () => console.log("Send WhatsApp to selected:", Array.from(selectedUserIds));
  
  const openEditUserDialog = (userId: string) => {
    const userToEdit = users.find(user => user.id === userId);
    if (userToEdit) {
      setEditingUser(userToEdit);
      setEditUserName(userToEdit.name);
      setEditUserWhatsapp(userToEdit.whatsappNumber);
      setEditFormError(null); // Clear previous errors
      setIsEditUserDialogOpen(true);
    }
  };

  const handleDeleteUser = (userId: string) => {
    console.log("Delete user:", userId);
    setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
    setSelectedUserIds(prevSelected => {
        const newSet = new Set(prevSelected);
        newSet.delete(userId);
        toast.success("User deleted successfully.");
        return newSet;
    });
  };

  const handleSaveNewUser = () => {
    if (!newUserName.trim()) {
      setFormError("User name cannot be empty.");
      return;
    }
    const whatsappTrimmed = newUserWhatsapp.trim();
    if (!whatsappTrimmed) {
      setFormError("WhatsApp number cannot be empty.");
      return;
    }
    if (!/^\d{10,15}$/.test(whatsappTrimmed)) {
        setFormError("Invalid WhatsApp number. Must be 10-15 digits (e.g., 1234567890).");
        return;
    }
    setFormError(null);

    const newUser: User = {
      id: uuidv4(),
      name: newUserName.trim(),
      whatsappNumber: whatsappTrimmed,
    };
    setUsers(prevUsers => [newUser, ...prevUsers]);
    setNewUserName('');
    setNewUserWhatsapp('');
    setIsAddUserDialogOpen(false);
    toast.success("User added successfully!");
  };

  const handleSaveEditedUser = () => {
    if (!editingUser) return;

    if (!editUserName.trim()) {
      setEditFormError("User name cannot be empty.");
      return;
    }
    const whatsappTrimmed = editUserWhatsapp.trim();
    if (!whatsappTrimmed) {
      setEditFormError("WhatsApp number cannot be empty.");
      return;
    }
    if (!/^\d{10,15}$/.test(whatsappTrimmed)) {
        setEditFormError("Invalid WhatsApp number. Must be 10-15 digits (e.g., 1234567890).");
        return;
    }
    setEditFormError(null);

    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === editingUser.id 
          ? { ...user, name: editUserName.trim(), whatsappNumber: whatsappTrimmed }
          : user
      )
    );
    setIsEditUserDialogOpen(false);
    setEditingUser(null);
    toast.success("User updated successfully!");
  };

  // Send Message Logic
  const mockSendMessageAPI = (userId: string, userName: string, message: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate success/failure randomly
        if (Math.random() > 0.2) { // 80% success rate
          console.log(`Mock API: Message sent to ${userName} (${userId}): ${message}`);
          resolve();
        } else {
          console.error(`Mock API: Failed to send to ${userName} (${userId})`);
          reject(new Error('Simulated API Error'));
        }
      }, 1000 + Math.random() * 1500); // Simulate network delay
    });
  };

  const handleInitiateSendMessage = () => {
    const usersToMessage = users.filter(user => selectedUserIds.has(user.id));
    setUserMessageStatuses(usersToMessage.map(u => ({ userId: u.id, name: u.name, status: 'pending' })));
    if (!selectedTemplateId) {
        toast.error("Please select a message template first.");
        return;
    }
    setIsSendMessageDialogOpen(true);
  };

  const processSendMessageQueue = async () => {
    if (!selectedTemplateId) {
      toast.error("No template selected.");
      setIsBulkSending(false);
      return;
    }
    const template = MESSAGE_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (!template) {
      toast.error("Selected template not found.");
      setIsBulkSending(false);
      return;
    }

    setIsBulkSending(true);
    toast.info("Starting to send messages...", {id: 'bulk-send-progress'});

    for (const userStatus of userMessageStatuses) {
        if (userStatus.status === 'pending') { 
            setUserMessageStatuses(prev => prev.map(s => s.userId === userStatus.userId ? { ...s, status: 'sending' } : s));
            try {
                const messageContent = template.content.replace('{name}', userStatus.name);
                await mockSendMessageAPI(userStatus.userId, userStatus.name, messageContent);
                setUserMessageStatuses(prev => prev.map(s => s.userId === userStatus.userId ? { ...s, status: 'sent' } : s));
            } catch (error: any) {
                setUserMessageStatuses(prev => prev.map(s => s.userId === userStatus.userId ? { ...s, status: 'failed', error: error.message } : s));
            }
        }
    }
    setIsBulkSending(false);
    const sentCount = userMessageStatuses.filter(s => s.status === 'sent').length;
    const failedCount = userMessageStatuses.filter(s => s.status === 'failed').length;
    toast.success(`Finished: ${sentCount} sent, ${failedCount} failed.`, {id: 'bulk-send-progress', duration: 5000});
    // Optionally close dialog after a delay or based on results
    // setTimeout(() => setIsSendMessageDialogOpen(false), 3000);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv, text/csv"
        className="hidden"
      />
      <header className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-semibold text-gray-800">Manage Users</h1>
            <p className="text-sm text-gray-600">Add, import, and manage your user list.</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleImportCsvClick} className="bg-white">
            <Upload className="mr-2 size-4" />
            Import CSV
          </Button>
          <Dialog open={isAddUserDialogOpen} onOpenChange={(isOpen) => {setIsAddUserDialogOpen(isOpen); if(!isOpen) {setNewUserName(''); setNewUserWhatsapp(''); setFormError(null);}}}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <UserPlus className="mr-2 size-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Enter the details for the new user. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="add-name"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., John Doe"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-whatsapp" className="text-right">
                    WhatsApp
                  </Label>
                  <Input
                    id="add-whatsapp"
                    type="tel"
                    value={newUserWhatsapp}
                    onChange={(e) => setNewUserWhatsapp(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., 1234567890 (10-15 digits)"
                  />
                </div>
                {formError && (
                  <p className="col-span-4 text-sm text-red-600 text-center pt-1">{formError}</p>
                )}
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline">
                        Cancel
                    </Button>
                 </DialogClose>
                <Button type="button" onClick={handleSaveNewUser} className="bg-primary text-primary-foreground hover:bg-primary/90">Save User</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      {csvProcessingError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 border border-red-200 text-sm">
            {csvProcessingError}
        </div>
      )}

      {/* Edit User Dialog */}
      {editingUser && (
        <Dialog open={isEditUserDialogOpen} onOpenChange={(isOpen) => {setIsEditUserDialogOpen(isOpen); if(!isOpen) {setEditingUser(null); setEditFormError(null);}}}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>
                  Update the user's details. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">
                    Name
                  </Label>
                  <Input id="edit-name" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} className="col-span-3" placeholder="e.g., John Doe" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-whatsapp" className="text-right">
                    WhatsApp
                  </Label>
                  <Input id="edit-whatsapp" type="tel" value={editUserWhatsapp} onChange={(e) => setEditUserWhatsapp(e.target.value)} className="col-span-3" placeholder="e.g., 1234567890 (10-15 digits)" />
                </div>
                {editFormError && (<p className="col-span-4 text-sm text-red-600 text-center pt-1">{editFormError}</p>)}
              </div>
              <DialogFooter>
                 <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="button" onClick={handleSaveEditedUser} className="bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</Button>
              </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

      {/* Send Message Dialog */}
        <Dialog open={isSendMessageDialogOpen} onOpenChange={(isOpen) => { if (isBulkSending && isOpen) return; setIsSendMessageDialogOpen(isOpen); if (!isOpen) setUserMessageStatuses([]); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Send WhatsApp Message</DialogTitle>
                    <DialogDescription>
                        Select a template to send to {selectedUserIds.size} user(s).
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <Label htmlFor="template-select">Message Template</Label>
                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} disabled={isBulkSending}>
                            <SelectTrigger id="template-select" className="w-full mt-1">
                                <SelectValue placeholder="Select a template" />
                            </SelectTrigger>
                            <SelectContent>
                                {MESSAGE_TEMPLATES.map(template => (
                                    <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {isBulkSending && userMessageStatuses.length > 0 && (
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                            <p className="text-sm font-medium mb-2">Sending Progress ({userMessageStatuses.filter(s=>s.status === 'sent' || s.status === 'failed').length}/{userMessageStatuses.length}):</p>
                            {userMessageStatuses.map(s => (
                                <div key={s.userId} className="text-xs flex justify-between items-center p-1.5 rounded bg-gray-100">
                                    <span>{s.name}</span>
                                    {s.status === 'pending' && <span className="text-gray-500">Pending...</span>}
                                    {s.status === 'sending' && <SpinnerIcon className="size-3 animate-spin text-blue-500" />}
                                    {s.status === 'sent' && <span className="text-green-600 font-medium">Sent</span>}
                                    {s.status === 'failed' && <span className="text-red-600 font-medium" title={s.error}>Failed</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isBulkSending}>Cancel</Button>
                    </DialogClose>
                    <Button 
                        type="button" 
                        onClick={processSendMessageQueue} 
                        disabled={!selectedTemplateId || isBulkSending || selectedUserIds.size === 0}
                        className="bg-green-600 hover:bg-green-700 text-white min-w-[100px]"
                    >
                        {isBulkSending ? <SpinnerIcon className="animate-spin mr-2 size-4" /> : <Send className="mr-2 size-4" />} 
                        {isBulkSending ? 'Sending...' : `Send to ${selectedUserIds.size}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      <Card className="shadow-md">
        <CardHeader className="border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle className="text-lg font-medium text-gray-700">User List ({users.length})</CardTitle>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleInitiateSendMessage} // Changed to open the dialog
              disabled={selectedUserIds.size === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <MessageSquarePlus className="mr-2 size-4" />
              Send WhatsApp ({selectedUserIds.size})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-[50px] px-4 py-3">
                  <Checkbox
                    checked={areAllUsersSelected ? true : (isSomeUserSelected ? 'indeterminate' : false)}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all users"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-600">Name</TableHead>
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-600">WhatsApp Number</TableHead>
                <TableHead className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-gray-500">
                    No users found. Click "Add User" or "Import CSV" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50/50 border-b last:border-b-0" data-state={isUserSelected(user.id) ? 'selected' : ''}>
                    <TableCell className="px-4 py-3">
                      <Checkbox
                        checked={isUserSelected(user.id)}
                        onCheckedChange={(checked) => handleSelectUser(user.id, checked)}
                        aria-label={`Select user ${user.name}`}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{user.name}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600">{user.whatsappNumber}</TableCell>
                    <TableCell className="text-right px-4 py-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => openEditUserDialog(user.id)} className="cursor-pointer">
                                    <Edit3 className="mr-2 h-4 w-4"/>
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:!text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer">
                                    <Trash2 className="mr-2 h-4 w-4"/>
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {users.length > 0 && (
              <TableCaption className="py-3 text-sm text-gray-500">
                Showing {users.length} of {users.length} users. {selectedUserIds.size} selected.
              </TableCaption>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageUsersPage; 