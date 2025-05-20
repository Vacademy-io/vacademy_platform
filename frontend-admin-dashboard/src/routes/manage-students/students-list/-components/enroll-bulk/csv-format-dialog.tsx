import { MyDialog } from '@/components/design-system/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Dispatch, SetStateAction, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { UploadCSVButton } from './upload-csv-button';
import { enrollBulkFormType } from '@/routes/manage-students/students-list/-schemas/student-bulk-enroll/enroll-bulk-schema';
import { CSVFormatFormType } from '@/routes/manage-students/students-list/-schemas/student-bulk-enroll/enroll-bulk-schema';
import { csvFormatSchema } from '@/routes/manage-students/students-list/-schemas/student-bulk-enroll/enroll-bulk-schema';

export const CSVFormatDialog = ({
    packageDetails,
    openDialog,
    setOpenDialog,
}: {
    packageDetails: enrollBulkFormType;
    openDialog: boolean;
    setOpenDialog: Dispatch<SetStateAction<boolean>>;
}) => {
    const defaultValues = {
        autoGenerateUsername: true,
        autoGeneratePassword: true,
        autoGenerateEnrollmentId: true,
        setCommonExpiryDate: true,
        daysFromToday: '365',
        addStudentStatus: true,
        studentStatus: 'ACTIVE',
        fatherName: false,
        motherName: false,
        guardianName: false,
        parentEmail: false,
        parentMobile: false,
        collegeName: false,
        state: false,
        city: false,
        pincode: false,
    };
    const [csvFormatFormValues, setCsvFormatFormValues] = useState(defaultValues);

    const form = useForm<CSVFormatFormType>({
        resolver: zodResolver(csvFormatSchema),
        defaultValues: defaultValues,
    });

    const handleOpenChange = () => {
        setOpenDialog(!openDialog);
    };

    const onSubmit = (data: CSVFormatFormType) => {
        setCsvFormatFormValues(data);
    };

    const footer = (
        <div
            className="flex justify-end"
            onClick={() => {
                formRef.current?.requestSubmit();
            }}
        >
            <UploadCSVButton
                packageDetails={packageDetails}
                csvFormatDetails={csvFormatFormValues}
                setOpenDialog={setOpenDialog} // Pass down the setter function
            />
        </div>
    );

    const formRef = useRef<HTMLFormElement>(null);

    return (
        <MyDialog
            heading="Choose CSV Format"
            dialogWidth="w-full"
            open={openDialog}
            onOpenChange={handleOpenChange}
            footer={footer}
        >
            <div className="px-6 text-neutral-600">
                <Form {...form}>
                    <form
                        ref={formRef}
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="flex flex-col gap-6"
                    >
                        <div className="flex flex-col gap-4">
                            <h3 className="font-medium text-neutral-900">Enrollment Preferences</h3>
                            <div className="flex flex-col gap-3">
                                <FormField
                                    control={form.control}
                                    name="autoGenerateUsername"
                                    render={({ field }) => (
                                        <FormItem className="flex items-end space-x-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                                Auto-generate username
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="autoGeneratePassword"
                                    render={({ field }) => (
                                        <FormItem className="flex items-end space-x-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                                Auto-generate password
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="autoGenerateEnrollmentId"
                                    render={({ field }) => (
                                        <FormItem className="flex items-end space-x-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                                Auto-generate enrollment ID
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />

                                <div className="flex items-center gap-6">
                                    <FormField
                                        control={form.control}
                                        name="setCommonExpiryDate"
                                        render={({ field }) => (
                                            <FormItem className="flex items-end space-x-2">
                                                <FormControl className="flex items-center">
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal">
                                                    Set common expiry date
                                                </FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="daysFromToday"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input {...field} className="w-14" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <span className="text-neutral-600">days from today</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <FormField
                                        control={form.control}
                                        name="addStudentStatus"
                                        render={({ field }) => (
                                            <FormItem className="flex items-end space-x-2">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal">
                                                    Add student status
                                                </FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="studentStatus"
                                        render={({ field }) => (
                                            <FormItem>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                >
                                                    <SelectTrigger className="w-32">
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ACTIVE">
                                                            Active
                                                        </SelectItem>
                                                        <SelectItem value="INACTIVE">
                                                            Inactive
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <h3 className="font-medium text-neutral-900">
                                Optional CSV column selection
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { name: 'fatherName', label: "Father's Name" },
                                    { name: 'collegeName', label: 'College/School Name' },
                                    { name: 'motherName', label: "Mother's Name" },
                                    { name: 'state', label: 'State' },
                                    { name: 'guardianName', label: "Guardian's Name" },
                                    { name: 'city', label: 'City' },
                                    { name: 'parentEmail', label: "Parent/Guardian's Email" },
                                    { name: 'pincode', label: 'Pincode' },
                                    {
                                        name: 'parentMobile',
                                        label: "Parent/Guardian's Mobile Number",
                                    },
                                ].map((field) => (
                                    <FormField
                                        key={field.name}
                                        control={form.control}
                                        name={field.name as keyof CSVFormatFormType}
                                        render={({ field: formField }) => (
                                            <FormItem className="flex items-end space-x-2">
                                                <FormControl>
                                                    <Checkbox
                                                        // checked={formField.value}
                                                        onCheckedChange={formField.onChange}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal">
                                                    {field.label}
                                                </FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                    </form>
                </Form>
            </div>
        </MyDialog>
    );
};
