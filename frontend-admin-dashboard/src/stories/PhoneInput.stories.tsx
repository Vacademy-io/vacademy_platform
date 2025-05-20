import PhoneInputField from "@/components/design-system/phone-input-field";
import { Meta, StoryObj } from "@storybook/react";
import { ComponentProps } from "react";
import { z } from "zod";
import FormWrapper from "./FormWrapper";

type StoryProps = ComponentProps<typeof PhoneInputField>;

const meta: Meta<StoryProps> = {
    component: PhoneInputField,
    tags: ["autodocs"],
    parameters: {
        layout: "centered",
    },
};

const phoneSchema = z.object({
    phone: z.string().min(1, "Phone number is required"),
});

export default meta;

type Story = StoryObj<StoryProps>;

export const Default: Story = {
    args: {
        label: "Phone Number",
        name: "phone",
        placeholder: "Enter your phone number",
        control: {},
        disabled: false,
        country: "us",
        required: true,
        value: "",
    },
    render: (args) => {
        return (
            <FormWrapper formSchema={phoneSchema}>
                <PhoneInputField {...args} />
            </FormWrapper>
        );
    },
};
