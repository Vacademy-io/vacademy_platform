import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Info } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyInput } from '@/components/design-system/input';
import SelectField from '@/components/design-system/select-field';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { reportApiError } from '@/lib/report-api-error';
import { hrKeys, saveSalaryComponent } from '@/routes/erp/-shared/hr-service';
import type { ComponentType, SalaryComponentDTO } from '@/routes/erp/-shared/hr-types';
import { COMPONENT_CATEGORY_OPTIONS, COMPONENT_TYPE_OPTIONS } from './salary-meta';

const schema = z.object({
    name: z.string().trim().min(1, 'Give the component a name'),
    code: z
        .string()
        .trim()
        .min(2, 'Codes are at least 2 characters')
        .regex(
            /^[A-Z0-9_]+$/,
            'Uppercase letters, digits and underscores only — no spaces (e.g. BASIC, HRA, SPECIAL_ALLOWANCE)'
        ),
    type: z.enum(['EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION']),
    category: z.enum(['FIXED', 'VARIABLE', 'STATUTORY']),
    is_taxable: z.boolean(),
    is_statutory: z.boolean(),
    display_order: z.string().regex(/^\d*$/, 'Whole numbers only'),
    gl_account_code: z.string().trim().max(64, 'That looks too long for an account code'),
    description: z.string().trim().max(500, 'Keep the description under 500 characters'),
});

type ComponentFormValues = z.infer<typeof schema>;

const emptyValues: ComponentFormValues = {
    name: '',
    code: '',
    type: 'EARNING',
    category: 'FIXED',
    is_taxable: true,
    is_statutory: false,
    display_order: '',
    gl_account_code: '',
    description: '',
};

interface ComponentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** `null` to create; a component to edit. */
    component: SalaryComponentDTO | null;
    /** Uppercase codes already in use, so a duplicate is caught before the round trip. */
    existingCodes: string[];
}

/**
 * Add or edit one salary component.
 *
 * The code field is the load-bearing one: the payroll engine resolves template
 * rows and formula variables by code, so it is normalised to uppercase as the
 * user types and validated against the codes already in use — a duplicate or a
 * code with a space produces components the engine silently never matches.
 */
export const ComponentDialog = ({
    open,
    onOpenChange,
    component,
    existingCodes,
}: ComponentDialogProps) => {
    const queryClient = useQueryClient();
    const isEdit = !!component?.id;

    const form = useForm<ComponentFormValues>({
        resolver: zodResolver(schema),
        defaultValues: emptyValues,
        mode: 'onBlur',
    });

    useEffect(() => {
        if (!open) return;
        form.reset(
            component
                ? {
                      name: component.name ?? '',
                      code: (component.code ?? '').toUpperCase(),
                      type: (component.type ?? 'EARNING') as ComponentFormValues['type'],
                      category: (['FIXED', 'VARIABLE', 'STATUTORY'].includes(
                          (component.category ?? '').toUpperCase()
                      )
                          ? (component.category ?? '').toUpperCase()
                          : 'FIXED') as ComponentFormValues['category'],
                      is_taxable: component.is_taxable ?? true,
                      is_statutory: component.is_statutory ?? false,
                      display_order:
                          component.display_order === undefined || component.display_order === null
                              ? ''
                              : String(component.display_order),
                      gl_account_code: component.gl_account_code ?? '',
                      description: component.description ?? '',
                  }
                : emptyValues
        );
    }, [open, component, form]);

    const mutation = useMutation({
        mutationFn: (payload: SalaryComponentDTO) => saveSalaryComponent(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: hrKeys.salaryComponents() });
            queryClient.invalidateQueries({ queryKey: hrKeys.salaryTemplates() });
            toast.success(isEdit ? 'Component updated' : 'Component created');
            onOpenChange(false);
        },
        onError: (error) => {
            reportApiError(error, {
                feature: 'erp-salary',
                tags: { action: isEdit ? 'update-component' : 'create-component' },
                fallbackMessage: 'Could not save the salary component.',
            });
        },
    });

    const onSubmit = async (values: ComponentFormValues) => {
        const code = values.code.toUpperCase();
        const clash = existingCodes.some(
            (existing) => existing === code && code !== (component?.code ?? '').toUpperCase()
        );
        if (clash) {
            form.setError('code', {
                message: 'Another component already uses this code',
            });
            return;
        }

        await mutation.mutateAsync({
            ...(component?.id ? { id: component.id } : {}),
            name: values.name,
            code,
            type: values.type as ComponentType,
            category: values.category,
            is_taxable: values.is_taxable,
            is_statutory: values.is_statutory,
            display_order: values.display_order === '' ? 0 : Number(values.display_order),
            gl_account_code: values.gl_account_code || undefined,
            description: values.description || undefined,
            // Not editable here — preserved so a save never silently retires a component.
            is_active: component?.is_active ?? true,
        });
    };

    return (
        <MyDialog
            heading={isEdit ? 'Edit salary component' : 'Add salary component'}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-2xl"
            footer={
                <>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        type="button"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onAsyncClick={form.handleSubmit(onSubmit)}
                        loadingText="Saving…"
                    >
                        {isEdit ? 'Save changes' : 'Create component'}
                    </MyButton>
                </>
            }
        >
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex flex-col gap-4"
                    noValidate
                >
                    <div className="flex items-start gap-2 rounded-md bg-info-50 p-3 text-caption text-neutral-600">
                        <Info size={16} className="mt-0.5 shrink-0 text-info-600" />
                        <span>
                            TDS, PF, ESI and PT are system components — payroll creates them for you
                            when it runs. Don&apos;t add them here, or an employee ends up with the
                            deduction twice.
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <MyInput
                                            inputType="text"
                                            inputPlaceholder="House rent allowance"
                                            className="w-full sm:w-full"
                                            required
                                            input={field.value}
                                            name={field.name}
                                            onBlur={field.onBlur}
                                            onChangeFunction={(event) =>
                                                field.onChange(event.target.value)
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Code</FormLabel>
                                    <FormControl>
                                        <MyInput
                                            inputType="text"
                                            inputPlaceholder="HRA"
                                            className="w-full font-mono sm:w-full"
                                            required
                                            input={field.value}
                                            name={field.name}
                                            onBlur={field.onBlur}
                                            onChangeFunction={(event) =>
                                                field.onChange(
                                                    event.target.value
                                                        .toUpperCase()
                                                        .replace(/\s+/g, '_')
                                                )
                                            }
                                        />
                                    </FormControl>
                                    <FormDescription className="text-caption text-neutral-500">
                                        The payroll engine matches on this — e.g. BASIC, HRA.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <SelectField
                            control={form.control}
                            name="type"
                            label="Type"
                            required
                            options={COMPONENT_TYPE_OPTIONS}
                            className="w-full sm:w-full"
                        />

                        <SelectField
                            control={form.control}
                            name="category"
                            label="Category"
                            required
                            options={COMPONENT_CATEGORY_OPTIONS}
                            className="w-full sm:w-full"
                        />

                        <FormField
                            control={form.control}
                            name="display_order"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Display order</FormLabel>
                                    <FormControl>
                                        <MyInput
                                            inputType="number"
                                            inputPlaceholder="10"
                                            className="w-full sm:w-full"
                                            input={field.value}
                                            name={field.name}
                                            onBlur={field.onBlur}
                                            onChangeFunction={(event) =>
                                                field.onChange(event.target.value)
                                            }
                                        />
                                    </FormControl>
                                    <FormDescription className="text-caption text-neutral-500">
                                        Lower numbers appear higher on the payslip.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="gl_account_code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>GL account code</FormLabel>
                                    <FormControl>
                                        <MyInput
                                            inputType="text"
                                            inputPlaceholder="5100"
                                            className="w-full font-mono sm:w-full"
                                            input={field.value}
                                            name={field.name}
                                            onBlur={field.onBlur}
                                            onChangeFunction={(event) =>
                                                field.onChange(event.target.value)
                                            }
                                        />
                                    </FormControl>
                                    <FormDescription className="text-caption text-neutral-500">
                                        Where this component posts in the accounting journal. Blank
                                        uses the default for its type.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                        <FormField
                            control={form.control}
                            name="is_taxable"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center gap-2">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={(checked) =>
                                                field.onChange(checked === true)
                                            }
                                        />
                                    </FormControl>
                                    <FormLabel className="!mt-0 text-body text-neutral-600">
                                        Taxable
                                    </FormLabel>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="is_statutory"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center gap-2">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={(checked) =>
                                                field.onChange(checked === true)
                                            }
                                        />
                                    </FormControl>
                                    <FormLabel className="!mt-0 text-body text-neutral-600">
                                        Statutory
                                    </FormLabel>
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                    <Textarea
                                        {...field}
                                        placeholder="What this component is for, so the next admin doesn't have to guess."
                                        className="text-body"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
        </MyDialog>
    );
};
