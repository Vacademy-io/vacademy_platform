import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { MoreHorizontal, Trash2, Edit3, MessageSquarePlus, UserPlus, Upload, Send, Loader2 as SpinnerIcon } from 'lucide-react'; // Added Send, SpinnerIcon
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; // Import AlertDialog components
import { Textarea } from "@/components/ui/textarea"; // Import Textarea

// Define a type for our user data
interface User {
  id: string;
  name: string;
  whatsappNumber: string;
  email?: string; // Added optional email field
}

// Expected CSV Row structure
interface CsvRow {
  "Full name"?: string; // Updated to match new CSV header
  "Best Contact Number. - Whatsapp number where zoom link can be sent."?: string; // Updated to match new CSV header
  "Email id to send joining details "?: string; // Added email header
  // Allow other columns, but we only care about these
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
  const [newUserEmail, setNewUserEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [csvProcessingError, setCsvProcessingError] = useState<string | null>(null); // For CSV errors

  // Edit User Dialog state
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserWhatsapp, setEditUserWhatsapp] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editFormError, setEditFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input

  // Send Message Dialog state
  const [isSendMessageDialogOpen, setIsSendMessageDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(MESSAGE_TEMPLATES[0]?.id);
  const [userMessageStatuses, setUserMessageStatuses] = useState<UserMessageStatus[]>([]);
  const [isBulkSending, setIsBulkSending] = useState(false);

  // State for Clear All Users confirmation
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);

  // State for CSV import error details
  const [csvImportErrorDetails, setCsvImportErrorDetails] = useState<string[]>([]);

  // State for custom template fields
  const [customFields, setCustomFields] = useState({
    join_link: '',
    morning_quote: '',
    daily_habit_heading: '',
    daily_habit_sub_heading: '',
    daily_habit_text: '',
  });

  // State for Send Email Dialog
  const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const emailBodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [emailSendingStatuses, setEmailSendingStatuses] = useState<UserMessageStatus[]>([]);
  const [isBulkEmailSending, setIsBulkEmailSending] = useState(false);

  // State for Email Preview
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState('');

  const baseEmailHtmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Preview</title> <!-- Title for preview window, not actual email -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #fdf8f6;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        .email-container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);
            overflow: hidden;
        }
        .header {
            background-color: #e8dcd9;
            padding: 32px 24px;
            text-align: center;
            border-top-left-radius: 16px;
            border-top-right-radius: 16px;
        }
        .content {
            padding: 32px 24px;
            color: #374151;
            line-height: 1.6;
        }
        .button {
            display: inline-block;
            background-color: #8B4513;
            color: #ffffff;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: background-color 0.3s ease;
        }
        .button:hover {
            background-color: #6F360F;
        }
        .footer {
            background-color: #fdf8f6;
            padding: 24px;
            text-align: center;
            color: #6b7280;
            font-size: 0.875rem;
            border-bottom-left-radius: 16px;
            border-bottom-right-radius: 16px;
        }
        /* Additional styles for content if needed */
        .content p { margin-bottom: 1em; }
        .content h1, .content h2, .content h3 { margin-bottom: 0.5em; color: #8B4513; }
        .content ul, .content ol { margin-left: 20px; margin-bottom: 1em; }
        .content a { color: #8B4513; text-decoration: underline; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
             <h1 style="font-size: 24px; color: #6F360F; margin:0;">Aanandham Yoga</h1>
        </div>
        <div class="content">
            {{EMAIL_BODY_CONTENT}}
        </div>
        <div class="footer">
            
            <p>&copy; ${new Date().getFullYear()} Aanandham Yoga</p>
        </div>
    </div>
</body>
</html>
`;

  const placeholderList = [
    { value: '{{name}}', label: 'Name' },
    { value: '{{whatsappNumber}}', label: 'WhatsApp' },
    { value: '{{email}}', label: 'Email' },
    { value: '{{join_link}}', label: 'Join Link' },
    { value: '{{morning_quote}}', label: 'Morning Quote' },
    { value: '{{daily_habit_heading}}', label: 'Habit Heading' },
    { value: '{{daily_habit_sub_heading}}', label: 'Habit Sub-Heading' },
    { value: '{{daily_habit_text}}', label: 'Habit Text' },
  ];

  const handleCustomFieldChange = (fieldName: keyof typeof customFields, value: string) => {
    setCustomFields(prev => ({ ...prev, [fieldName]: value }));
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = emailBodyTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const newText = text.substring(0, start) + placeholder + text.substring(end);
      setEmailBody(newText);
      textarea.focus();
      setTimeout(() => {
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
    }
  };

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
    setCsvImportErrorDetails([]); // Clear previous detailed errors
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
          setCsvImportErrorDetails(parseErrors.map(err => `Row ${err.row}: ${err.message}`));
          return;
        }

        let importedCount = 0;
        let invalidCount = 0;
        const newUsersFromCsv: User[] = [];
        const validationErrorMessages: string[] = [];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Simple email validation regex

        data.forEach((row: CsvRow, index: number) => {
          const name = row["Full name"]?.trim();
          const originalWhatsappInput = row["Best Contact Number. - Whatsapp number where zoom link can be sent."]?.trim();
          let emailInput = row["Email id to send joining details "]?.trim(); // Trim first
          let processedNumberPart = originalWhatsappInput;
          let formattedWhatsappNumber = "";

          // Process Email: lowercase and remove all spaces
          if (emailInput) {
            emailInput = emailInput.toLowerCase().replace(/\s+/g, '');
          }

          if (processedNumberPart) {
            // Remove initial spaces that might have been missed by trim, or all spaces
            processedNumberPart = processedNumberPart.replace(/\s+/g, ''); 

            let hadPlusPrefix = false;
            if (processedNumberPart.startsWith('+')) {
              hadPlusPrefix = true;
              processedNumberPart = processedNumberPart.substring(1);
            }
            
            // Now, remove all non-digit characters from the number part
            processedNumberPart = processedNumberPart.replace(/\D/g, '');

            if (hadPlusPrefix) {
              // If it had a '+', we assume the country code was included and cleaned. 
              // Common issue: +44 (0) 7... -> after stripping non-digits, leading 0 might reappear if not handled.
              // Example: +44(0)7... -> 4407... -> if 0 is stripped again -> 447... (Correct)
              // If it becomes like 4407..., stripping the 0 if it's a UK style number part after CC
              if (processedNumberPart.startsWith('440')) {
                processedNumberPart = '44' + processedNumberPart.substring(3); // Keep 44, remove 0, take rest
              }
              formattedWhatsappNumber = processedNumberPart;
            } else if (processedNumberPart.startsWith('0')) {
              // Starts with 0 (and didn't have +), strip 0, add 44 (UK)
              formattedWhatsappNumber = '44' + processedNumberPart.substring(1);
            } else {
              // No '+', no leading '0', assume Indian, add 91
              // but only if processedNumberPart is not empty after stripping non-digits
              if (processedNumberPart) { // Ensure it's not empty after stripping non-digits
                formattedWhatsappNumber = '91' + processedNumberPart;
              } else {
                // If it became empty, it was invalid input (e.g. just symbols)
                // This will be caught by the later checks if name/whatsappNumberInput was missing initially
                // or by the length check if formattedWhatsappNumber remains empty.
              }
            }
          } // End of if (processedNumberPart)
          
          let rowHasError = false;
          if (!name) {
            validationErrorMessages.push(`Row ${index + 2}: Missing 'Full name'.`);
            rowHasError = true;
          }
          if (!originalWhatsappInput) { // Check original input for presence
            validationErrorMessages.push(`Row ${index + 2}: Missing 'Best Contact Number'.`);
            rowHasError = true;
          }
          if (emailInput && !emailRegex.test(emailInput)) {
            validationErrorMessages.push(`Row ${index + 2}: Invalid email format for '${emailInput}'.`);
            rowHasError = true;
          }

          if (rowHasError) { // If basic field presence errors, skip further processing for this row
            invalidCount++;
            return;
          }
          
          // After all formatting, check formattedWhatsappNumber
          // It should be purely digits now. The main check is length.
          if (!formattedWhatsappNumber || !/^\d{10,15}$/.test(formattedWhatsappNumber)) {
            validationErrorMessages.push(`Row ${index + 2}: Invalid WhatsApp format for '${originalWhatsappInput || "(empty)"}' (processed to: '${formattedWhatsappNumber || "(empty)"}'). Must result in 10-15 digits.`);
            invalidCount++;
            return;
          }

          newUsersFromCsv.push({
            id: uuidv4(),
            name: name!, // name is checked for undefined above
            whatsappNumber: formattedWhatsappNumber,
            email: emailInput || undefined, // Use processed email or undefined
          });
          importedCount++;
        });

        setCsvImportErrorDetails(validationErrorMessages); // Store detailed errors for display

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
  const openEditUserDialog = (userId: string) => {
    const userToEdit = users.find(user => user.id === userId);
    if (userToEdit) {
      setEditingUser(userToEdit);
      setEditUserName(userToEdit.name);
      setEditUserWhatsapp(userToEdit.whatsappNumber);
      setEditUserEmail(userToEdit.email || '');
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
    const whatsappTrimmed = newUserWhatsapp.trim().replace(/\s+/g, '');
    if (!whatsappTrimmed) {
      setFormError("WhatsApp number cannot be empty.");
      return;
    }
    if (!/^\d{10,15}$/.test(whatsappTrimmed)) {
        setFormError("Invalid WhatsApp number. Must be 10-15 digits (e.g., 1234567890).");
        return;
    }
    const emailProcessed = newUserEmail.trim().toLowerCase().replace(/\s+/g, '');
    if (emailProcessed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailProcessed)) {
        setFormError("Invalid email format.");
        return;
    }
    setFormError(null);

    const newUser: User = {
      id: uuidv4(),
      name: newUserName.trim(),
      whatsappNumber: whatsappTrimmed,
      email: emailProcessed || undefined,
    };
    setUsers(prevUsers => [newUser, ...prevUsers]);
    setNewUserName('');
    setNewUserWhatsapp('');
    setNewUserEmail('');
    setIsAddUserDialogOpen(false);
    toast.success("User added successfully!");
  };

  const handleSaveEditedUser = () => {
    if (!editingUser) return;

    if (!editUserName.trim()) {
      setEditFormError("User name cannot be empty.");
      return;
    }
    const whatsappTrimmed = editUserWhatsapp.trim().replace(/\s+/g, '');
    if (!whatsappTrimmed) {
      setEditFormError("WhatsApp number cannot be empty.");
      return;
    }
    if (!/^\d{10,15}$/.test(whatsappTrimmed)) {
        setEditFormError("Invalid WhatsApp number. Must be 10-15 digits (e.g., 1234567890).");
        return;
    }
    const emailProcessed = editUserEmail.trim().toLowerCase().replace(/\s+/g, '');
    if (emailProcessed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailProcessed)) {
        setEditFormError("Invalid email format.");
        return;
    }
    setEditFormError(null);

    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === editingUser.id 
          ? { ...user, name: editUserName.trim(), whatsappNumber: whatsappTrimmed, email: emailProcessed || undefined }
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

  const handleConfirmClearAllUsers = () => {
    setUsers([]);
    setSelectedUserIds(new Set());
    setIsClearAllDialogOpen(false);
    toast.success("All users have been cleared.");
  };

  const generateEmailPreviewHtml = () => {
    if (!emailBody.trim()) {
      // If body is empty, show a simple message within the template
      const emptyBodyMessage = '<p class="text-gray-500 italic">Email body is empty. Start typing to see a preview.</p>';
      setEmailPreviewHtml(baseEmailHtmlTemplate.replace('{{EMAIL_BODY_CONTENT}}', emptyBodyMessage));
      return;
    }

    let populatedBodyContent = emailBody;
    const firstRecipientStatus = emailSendingStatuses.find(status => users.find(u => u.id === status.userId && u.email));
    const sampleUser = firstRecipientStatus ? users.find(u => u.id === firstRecipientStatus.userId) : null;

    const samplePlaceholders = {
      name: sampleUser?.name || '[Sample Name]',
      whatsappNumber: sampleUser?.whatsappNumber || '[Sample WhatsApp]',
      email: sampleUser?.email || '[Sample Email]',
      join_link: customFields.join_link || '[Join Link]',
      morning_quote: customFields.morning_quote || '[Morning Quote]',
      daily_habit_heading: customFields.daily_habit_heading || '[Habit Heading]',
      daily_habit_sub_heading: customFields.daily_habit_sub_heading || '[Habit Sub-Heading]',
      daily_habit_text: customFields.daily_habit_text || '[Habit Text]',
    };

    for (const key in samplePlaceholders) {
      const placeholder = `{{${key}}}`;
      populatedBodyContent = populatedBodyContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), samplePlaceholders[key as keyof typeof samplePlaceholders]);
    }

    // Heuristic to check if user input is already HTML
    const isLikelyHtml = populatedBodyContent.trim().startsWith('<') && populatedBodyContent.includes('</');
    // Heuristic to check if user input is a full HTML document
    const isFullHtmlDoc = isLikelyHtml && /<html\b[^>]*>/i.test(populatedBodyContent) && /<body\b[^>]*>/i.test(populatedBodyContent);

    if (isFullHtmlDoc) {
      setEmailPreviewHtml(populatedBodyContent); // Use user's full HTML
    } else if (isLikelyHtml) {
      // User provided an HTML snippet, embed it in our template
      setEmailPreviewHtml(baseEmailHtmlTemplate.replace('{{EMAIL_BODY_CONTENT}}', populatedBodyContent));
    } else {
      // Plain text: convert newlines to <br> and embed in our template
      const plainTextAsHtml = populatedBodyContent.replace(/\n/g, '<br />');
      setEmailPreviewHtml(baseEmailHtmlTemplate.replace('{{EMAIL_BODY_CONTENT}}', plainTextAsHtml));
    }
  };

  const handleSendBulkEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Subject and body are required.");
      return;
    }
    
    if (emailSendingStatuses.length === 0) {
        toast.error("No valid recipients to send email to.");
        return;
    }

    setIsBulkEmailSending(true);
    toast.info("Processing emails...", { id: 'bulk-email-progress' });

    setEmailSendingStatuses(prevStatuses => 
        prevStatuses.map(s => ({ ...s, status: 'sending' }))
    );

    const usersFromState = users;

    const apiUsersPayload = emailSendingStatuses.map(statusEntry => {
      const user = usersFromState.find(u => u.id === statusEntry.userId);
      if (!user || !user.email) return null; 
      return {
        user_id: user.id,
        channel_id: user.email,
        placeholders: {
          name: user.name,
          whatsappNumber: user.whatsappNumber || '',
          email: user.email,
          join_link: customFields.join_link,
          morning_quote: customFields.morning_quote,
          daily_habit_heading: customFields.daily_habit_heading,
          daily_habit_sub_heading: customFields.daily_habit_sub_heading,
          daily_habit_text: customFields.daily_habit_text,
        },
      };
    }).filter(p => p !== null) as any[];

    if (apiUsersPayload.length === 0) {
        toast.error("Could not prepare payload for any user.");
        setIsBulkEmailSending(false);
        setEmailSendingStatuses(prevStatuses => 
            prevStatuses.map(s => ({ ...s, status: 'pending' }))
        );
        return;
    }

    // Determine the final API body based on whether emailBody is plain text or HTML
    let finalApiBody = emailBody; // This is the user's input with {{placeholders}}
    const originalUserInputIsLikelyHtml = emailBody.trim().startsWith('<') && emailBody.includes('</');
    const originalUserInputIsFullHtmlDoc = originalUserInputIsLikelyHtml && 
                                         /<html\b[^>]*>/i.test(emailBody) && 
                                         /<body\b[^>]*>/i.test(emailBody);

    if (!originalUserInputIsLikelyHtml) { // If plain text
        const plainTextWithPlaceholdersAsHtml = emailBody.replace(/\n/g, '<br />');
        finalApiBody = baseEmailHtmlTemplate.replace('{{EMAIL_BODY_CONTENT}}', plainTextWithPlaceholdersAsHtml);
    } else if (originalUserInputIsLikelyHtml && !originalUserInputIsFullHtmlDoc) { // HTML snippet
        // Wrap snippet in the base template to ensure consistent structure for the backend
        finalApiBody = baseEmailHtmlTemplate.replace('{{EMAIL_BODY_CONTENT}}', emailBody);
    }
    // If originalUserInputIsFullHtmlDoc, finalApiBody remains as emailBody (user's full HTML with placeholders)

    const requestBody = {
      body: finalApiBody, // Use the potentially wrapped body with {{placeholders}} intact
      notification_type: "EMAIL",
      subject: emailSubject,
      source: "USER_MANAGEMENT_BULK_EMAIL",
      source_id: uuidv4(),
      users: apiUsersPayload,
    };

    try {
      const response = await fetch('https://backend-stage.vacademy.io/notification-service/v1/send-email-to-users-public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        toast.success(`Successfully sent request for ${apiUsersPayload.length} email(s). Check individual statuses if API provides them.`, { id: 'bulk-email-progress' });
        setEmailSendingStatuses(prevStatuses => 
          prevStatuses.map(s => ({ ...s, status: 'sent' }))
        );
      } else {
        const errorData = await response.json().catch(() => ({ message: "Failed to parse error response" }));
        console.error("API Error:", response.status, errorData);
        toast.error(`API Error: ${errorData.message || response.statusText}`, { id: 'bulk-email-progress' });
        setEmailSendingStatuses(prevStatuses => 
          prevStatuses.map(s => ({ ...s, status: 'failed', error: errorData.message || response.statusText }))
        );
      }
    } catch (error: any) {
      console.error("Network or other error sending email:", error);
      toast.error(`Error: ${error.message || "An unexpected error occurred."}`, { id: 'bulk-email-progress' });
      setEmailSendingStatuses(prevStatuses => 
        prevStatuses.map(s => ({ ...s, status: 'failed', error: error.message || "Network error" }))
      );
    }

    setIsBulkEmailSending(false);
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
        <div className="flex space-x-2 flex-wrap gap-y-2">
          <Button variant="outline" onClick={handleImportCsvClick} className="bg-white">
            <Upload className="mr-2 size-4" />
            Import CSV
          </Button>
          <Dialog open={isAddUserDialogOpen} onOpenChange={(isOpen) => {setIsAddUserDialogOpen(isOpen); if(!isOpen) {setNewUserName(''); setNewUserWhatsapp(''); setNewUserEmail(''); setFormError(null);}}}>
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
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-email" className="text-right">
                    Email (Optional)
                  </Label>
                  <Input
                    id="add-email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., user@example.com"
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
          {/* Clear All Users Button and Dialog */}
          <AlertDialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={users.length === 0}>
                <Trash2 className="mr-2 size-4" />
                Clear All Users ({users.length})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all
                  {users.length > 0 ? ` ${users.length} ` : ' '}
                  user(s) from the list.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmClearAllUsers} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  Yes, delete all users
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* Custom Template Fields Section */}
      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-gray-700">Custom Message Variables</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Define values for placeholders that can be used in your WhatsApp message templates.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <Label htmlFor="join_link" className="text-sm font-medium text-gray-700">Join Link (URL)</Label>
            <Input 
              id="join_link" 
              value={customFields.join_link} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCustomFieldChange('join_link', e.target.value)} 
              placeholder="https://example.com/meeting" 
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="daily_habit_heading" className="text-sm font-medium text-gray-700">Daily Habit Heading</Label>
            <Input 
              id="daily_habit_heading" 
              value={customFields.daily_habit_heading} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCustomFieldChange('daily_habit_heading', e.target.value)} 
              placeholder="e.g., Your Habit for Today"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="daily_habit_sub_heading" className="text-sm font-medium text-gray-700">Daily Habit Sub-Heading</Label>
            <Input 
              id="daily_habit_sub_heading" 
              value={customFields.daily_habit_sub_heading} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCustomFieldChange('daily_habit_sub_heading', e.target.value)} 
              placeholder="e.g., Focus on this simple task"
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="morning_quote" className="text-sm font-medium text-gray-700">Morning Quote</Label>
            <Textarea 
              id="morning_quote" 
              value={customFields.morning_quote} 
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleCustomFieldChange('morning_quote', e.target.value)} 
              placeholder="Enter your morning quote here..."
              className="mt-1"
              rows={3}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="daily_habit_text" className="text-sm font-medium text-gray-700">Daily Habit Text</Label>
            <Textarea 
              id="daily_habit_text" 
              value={customFields.daily_habit_text} 
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleCustomFieldChange('daily_habit_text', e.target.value)} 
              placeholder="Describe the daily habit..."
              className="mt-1"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {csvProcessingError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 border border-red-200 text-sm">
            {csvProcessingError}
        </div>
      )}
      {/* Display CSV Import Error Details */}
      {csvImportErrorDetails.length > 0 && (
        <Card className="mb-6 shadow-md bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-amber-800">CSV Import Issues ({csvImportErrorDetails.length})</CardTitle>
            <CardDescription className="text-sm text-amber-700">
              The following rows from your CSV file could not be imported. Please correct them and try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1 text-sm text-amber-700 max-h-60 overflow-y-auto">
              {csvImportErrorDetails.map((errorMsg, index) => (
                <li key={index}>{errorMsg}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
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
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-email" className="text-right">
                    Email (Optional)
                  </Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., user@example.com"
                  />
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
            <div className="flex space-x-2 flex-wrap gap-y-2">
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleInitiateSendMessage} 
                disabled={selectedUserIds.size === 0}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <MessageSquarePlus className="mr-2 size-4" />
                Send WhatsApp ({selectedUserIds.size})
              </Button>
              {/* Send Email Button */}
              <Button 
                variant="default"
                size="sm"
                onClick={() => {
                  const usersToEmail = users.filter(user => selectedUserIds.has(user.id) && user.email);
                  if (usersToEmail.length === 0) {
                    toast.error("No selected users have email addresses.");
                    return;
                  }
                  setEmailSendingStatuses(usersToEmail.map(u => ({ userId: u.id, name: u.name, status: 'pending' })));
                  setIsSendEmailDialogOpen(true);
                }}
                disabled={selectedUserIds.size === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Send className="mr-2 size-4" /> {/* Using Send icon for email */}
                Send Email ({selectedUserIds.size > 0 ? users.filter(u => selectedUserIds.has(u.id) && u.email).length : 0})
              </Button>
            </div>
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
                <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-600">Email</TableHead>
                <TableHead className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-gray-500">
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
                    <TableCell className="px-4 py-3 text-gray-600">{user.email || 'N/A'}</TableCell>
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

      {/* Send Email Dialog */}
      <Dialog open={isSendEmailDialogOpen} onOpenChange={(isOpen) => { if (isBulkEmailSending && isOpen) return; setIsSendEmailDialogOpen(isOpen); if (!isOpen) { setEmailSubject(''); setEmailBody(''); setEmailSendingStatuses([]); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compose and Send Email</DialogTitle>
            <DialogDescription>
              Compose your email below. Selected users with email addresses will receive it.
              Number of recipients: {emailSendingStatuses.length}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input 
                id="email-subject" 
                value={emailSubject} 
                onChange={(e) => setEmailSubject(e.target.value)} 
                placeholder="Your email subject" 
                className="mt-1"
                disabled={isBulkEmailSending}
              />
            </div>
            <div>
              <Label htmlFor="email-body">Body</Label>
              <div className="mt-1 mb-2 flex flex-wrap gap-2 items-center">
                {placeholderList.map(p => (
                  <Button key={p.value} variant="outline" size="sm" onClick={() => insertPlaceholder(p.value)} disabled={isBulkEmailSending || showEmailPreview} className="text-xs px-2 py-1 h-auto">
                    Insert {p.label}
                  </Button>
                ))}
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                        if (showEmailPreview) {
                            setShowEmailPreview(false);
                        } else {
                            generateEmailPreviewHtml();
                            setShowEmailPreview(true);
                        }
                    }}
                    disabled={isBulkEmailSending}
                    className="text-xs px-2 py-1 h-auto ml-auto"
                >
                    {showEmailPreview ? 'Hide Preview' : 'Show Preview'}
                </Button>
              </div>
              {!showEmailPreview ? (
                <Textarea 
                  id="email-body" 
                  ref={emailBodyTextareaRef}
                  value={emailBody} 
                  onChange={(e) => setEmailBody(e.target.value)} 
                  placeholder="Type your email message here...\nUse placeholders like {{name}} or {{join_link}}."
                  className="mt-1 min-h-[200px] max-h-[400px] overflow-y-auto"
                  rows={10}
                  disabled={isBulkEmailSending}
                />
              ) : (
                <div 
                  id="email-preview-area"
                  className="mt-1 p-3 border rounded-md min-h-[200px] max-h-[400px] overflow-y-auto bg-gray-50 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: emailPreviewHtml }}
                />
              )}
            </div>
            {isBulkEmailSending && emailSendingStatuses.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                <p className="text-sm font-medium mb-2">Sending Progress ({emailSendingStatuses.filter(s=>s.status === 'sent' || s.status === 'failed').length}/{emailSendingStatuses.length}):</p>
                {emailSendingStatuses.map(s => (
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
              <Button type="button" variant="outline" disabled={isBulkEmailSending}>Cancel</Button>
            </DialogClose>
            <Button 
              type="button" 
              onClick={handleSendBulkEmail}
              disabled={!emailSubject.trim() || !emailBody.trim() || emailSendingStatuses.length === 0 || isBulkEmailSending}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
              {isBulkEmailSending ? <SpinnerIcon className="animate-spin mr-2 size-4" /> : <Send className="mr-2 size-4" />} 
              {isBulkEmailSending ? 'Sending...' : `Send to ${emailSendingStatuses.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageUsersPage; 