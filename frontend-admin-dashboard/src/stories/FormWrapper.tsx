/* eslint-disable */
import { zodResolver } from "@hookform/resolvers/zod";
import { cloneElement, isValidElement, ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";

const FormWrapper = ({ formSchema, children }: { formSchema: any; children: ReactNode }) => {
    const form = useForm({
        resolver: zodResolver(formSchema),
    });

    return (
        <FormProvider {...form}>
            {children && isValidElement(children)
                ? cloneElement(children, { ...children.props, control: form.control })
                : null}
        </FormProvider>
    );
};

export default FormWrapper;
