import PhoneInputField from '@/components/design-system/phone-input-field';
import { Meta, StoryObj } from '@storybook/react';
import { ComponentProps } from 'react';
import { z } from 'zod';
import FormWrapper from './FormWrapper';
import { useForm } from 'react-hook-form';

type StoryProps = ComponentProps<typeof PhoneInputField>;

const meta: Meta<StoryProps> = {
    component: PhoneInputField,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    },
};

export default meta;

const phoneSchema = z.object({
    phone: z.string().min(1, 'Phone number is required'),
});

type Story = StoryObj<StoryProps>;

export const Default: Story = {
    args: {
        label: 'Phone Number',
        name: 'phone',
        placeholder: 'Enter your phone number',
        disabled: false,
        country: 'us',
        required: true,
        // ⛔ Removed: value: '', (not valid for controlled inputs)
    },
    render: (args) => {
        const { control } = useForm({
            defaultValues: {
                phone: '',
            },
            mode: 'onChange',
        });

        return (
            <FormWrapper formSchema={phoneSchema}>
                <PhoneInputField {...args} control={control} />
            </FormWrapper>
        );
    },
};
