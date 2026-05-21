# 03 — Form & Data-Entry UX

Forms should feel **simple, guided, efficient, and clean**. Most "weak form" complaints come from
ad-hoc inputs, no validation feedback, and asking for fields users don't need.

## Stack (always)

`react-hook-form` + `zod` (`zodResolver`) + the `Form`/`FormField` plumbing
(`@/components/ui/form`) + design-system fields (`MyInput`, `SelectField`, `MultiSelectField`).

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { MyInput } from '@/components/design-system/input';
import { SelectField } from '@/components/design-system/select-field';
import { MyButton } from '@/components/design-system/button';

const schema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  role: z.string().min(1, 'Pick a role'),
});

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { fullName: '', role: '' },
});

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
    <FormField control={form.control} name="fullName" render={({ field }) => (
      <FormItem>
        <FormLabel>Full name</FormLabel>
        <FormControl><MyInput {...field} required /></FormControl>
        <FormMessage />
      </FormItem>
    )} />

    <SelectField control={form.control} name="role" label="Role" required
      options={[{ _id: '1', value: 'teacher', label: 'Teacher' }]} />

    <div className="flex justify-end gap-3">
      <MyButton buttonType="secondary" type="button" onClick={onCancel}>Cancel</MyButton>
      <MyButton buttonType="primary" onAsyncClick={form.handleSubmit(onSubmit)} loadingText="Saving…">
        Save
      </MyButton>
    </div>
  </form>
</Form>
```

## Standards

**Field structure**
- Every field: visible **label** (not placeholder-as-label), optional helper `text-caption`,
  inline error via `FormMessage`.
- Mark required fields with the `required` prop (consistent asterisk). Don't mark everything required.
- Group related fields with spacing (`space-y-4`) and section headings (`text-subtitle`/`FormStepHeading`).

**Only ask what you need**
- Cut irrelevant/optional fields — a leading cause of clutter. If a field isn't used downstream,
  remove it. Prefer sensible defaults over extra inputs.
- Use progressive disclosure: hide advanced/optional fields behind "Advanced" or a later step.

**Validation**
- Validate with zod; show errors **inline** under the field, not just a toast.
- Validate on submit + on blur for touched fields; don't error-spam while the user is still typing.
- Error copy is specific and kind: "Enter a valid email", not "Invalid".

**Dropdowns in forms**
- >~8 options → searchable (`SearchableSelect` / combobox). 
- Multi-value → `MultiSelectField` (removable badges).
- Always a placeholder + empty state.

**Multi-step forms**
- Use `FormStepHeading` + `FormSubmitButtons` patterns where they exist.
- Show progress (step n of m). Validate each step before advancing. Preserve entered data on back.

**Submit / async**
- Submit via `MyButton onAsyncClick` (auto disables + spinner → no double submit).
- On success: toast + navigate/close. On failure: inline error or toast with a retry path.

**Accessibility**
- Labels tied to inputs (the `Form` plumbing handles `htmlFor`/`id`).
- Errors announced (FormMessage). Logical tab order. Don't trap focus except in modals.

## Anti-patterns

- ❌ Bare `<input>`/`<select>` with manual `useState` and no validation.
- ❌ Placeholder used instead of a label.
- ❌ Errors only as toasts.
- ❌ 20-field single-screen forms — split or trim.
- ❌ Inconsistent button order — always `[secondary Cancel] [primary Save]`, right-aligned.
