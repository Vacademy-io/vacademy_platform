import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Switch } from '@/components/ui/switch';
import SelectField from '@/components/design-system/select-field';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
} from '@/components/ui/form';
import { reportApiError } from '@/lib/report-api-error';
import { HrTextField, HrTextareaField } from '@/routes/erp/people/-components/HrFormFields';
import { humanizeToken } from '@/routes/erp/people/-components/EmployeeFields';
import type { HolidayDTO } from '@/routes/erp/-shared/hr-types';
import { useSaveHoliday } from '../-hooks/use-attendance';
import { HOLIDAY_TYPES, monthOf } from './attendance-meta';

const schema = z.object({
    name: z.string().trim().min(1, 'Give the holiday a name'),
    date: z.string().min(1, 'Pick the date'),
    type: z.enum(HOLIDAY_TYPES),
    is_optional: z.boolean(),
    description: z.string().trim().max(500, 'Keep the description under 500 characters'),
});

type HolidayForm = z.infer<typeof schema>;

interface HolidayDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** `null` to create; a holiday to edit. */
    holiday: HolidayDTO | null;
    /** The year the list is showing — new holidays default into it. */
    year: number;
}

/**
 * Add or edit one holiday.
 *
 * The date carries the year: saving a 2027 date while looking at 2026 files it
 * under 2027, which is why the year field isn't a separate input that could
 * disagree with the date.
 */
export const HolidayDialog = ({ open, onOpenChange, holiday, year }: HolidayDialogProps) => {
    const mutation = useSaveHoliday(year);
    const isEdit = !!holiday?.id;

    const form = useForm<HolidayForm>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            date: '',
            type: 'NATIONAL',
            is_optional: false,
            description: '',
        },
        mode: 'onBlur',
    });

    useEffect(() => {
        if (!open) return;
        form.reset(
            holiday
                ? {
                      name: holiday.name ?? '',
                      date: (holiday.date ?? '').slice(0, 10),
                      type: (HOLIDAY_TYPES as readonly string[]).includes(
                          (holiday.type ?? '').toUpperCase()
                      )
                          ? ((holiday.type ?? '').toUpperCase() as HolidayForm['type'])
                          : 'NATIONAL',
                      is_optional: holiday.is_optional ?? false,
                      description: holiday.description ?? '',
                  }
                : {
                      name: '',
                      date: '',
                      type: 'NATIONAL',
                      is_optional: false,
                      description: '',
                  }
        );
    }, [open, holiday, form]);

    const onSubmit = async (values: HolidayForm) => {
        try {
            await mutation.mutateAsync({
                ...(holiday?.id ? { id: holiday.id } : {}),
                name: values.name,
                date: values.date,
                type: values.type,
                is_optional: values.is_optional,
                year: monthOf(values.date).year,
                description: values.description || undefined,
            });
            toast.success(isEdit ? 'Holiday updated' : 'Holiday added');
            onOpenChange(false);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-attendance',
                tags: { action: isEdit ? 'update-holiday' : 'create-holiday' },
                fallbackMessage: 'Could not save the holiday.',
            });
        }
    };

    return (
        <MyDialog
            heading={isEdit ? 'Edit holiday' : 'Add holiday'}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-xl"
            footer={
                <div className="flex justify-end gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        onAsyncClick={form.handleSubmit(onSubmit)}
                        loadingText="Saving…"
                    >
                        {isEdit ? 'Save changes' : 'Add holiday'}
                    </MyButton>
                </div>
            }
        >
            <Form {...form}>
                <form className="flex flex-col gap-4" noValidate>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <HrTextField
                            control={form.control}
                            name="name"
                            label="Name"
                            required
                            placeholder="Independence Day"
                        />
                        <HrTextField
                            control={form.control}
                            name="date"
                            label="Date"
                            inputType="date"
                            required
                        />
                    </div>

                    <SelectField
                        control={form.control}
                        name="type"
                        label="Type"
                        className="w-full sm:w-full"
                        labelStyle="text-body font-regular text-foreground"
                        options={HOLIDAY_TYPES.map((type, index) => ({
                            _id: index,
                            value: type,
                            label: humanizeToken(type),
                        }))}
                    />

                    <FormField
                        control={form.control}
                        name="is_optional"
                        render={({ field }) => (
                            <FormItem className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
                                <div className="flex flex-col gap-1">
                                    <FormLabel className="text-body font-regular text-foreground">
                                        Optional holiday
                                    </FormLabel>
                                    <FormDescription className="text-caption text-muted-foreground">
                                        Employees choose whether to take it, up to the allowance
                                        your leave policy sets — it isn&apos;t a closed day for
                                        everyone.
                                    </FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={!!field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <HrTextareaField
                        control={form.control}
                        name="description"
                        label="Description"
                        placeholder="Anything staff should know about the day"
                    />
                </form>
            </Form>
        </MyDialog>
    );
};
