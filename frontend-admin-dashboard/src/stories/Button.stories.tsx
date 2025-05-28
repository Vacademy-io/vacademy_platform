import { ComponentProps } from "react";
import { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { MyButton } from "@/components/design-system/button";

type StoryProps = ComponentProps<typeof MyButton> & {
    buttonText: string;
};

const meta: Meta<StoryProps> = {
    component: MyButton,
    tags: ["autodocs"],
    parameters: {
        layout: "centered",
    },
    args: {
        onClick: fn(),
    },
};

export default meta;

type Story = StoryObj<StoryProps>;

export const Primary: Story = {
    args: {
        buttonType: "primary",
        scale: "large",
        layoutVariant: "default",
        buttonText: "Primary Button",
    },
    render: (args) => {
        return <MyButton {...args}>{args.buttonText}</MyButton>;
    },
};
