// components/ui/custom-toast.tsx
import { useToast } from "@/hooks/use-toast";
import {
    Toast,
    ToastClose,
    ToastDescription,
    ToastProvider,
    ToastTitle,
    ToastViewport,
} from "@/components/ui/toast";
import { MdErrorOutline } from "react-icons/md";
import { toast } from "@/hooks/use-toast";

export function CustomToaster() {
    const { toasts } = useToast();

    return (
        <ToastProvider>
            {toasts.map(function ({ id, title, description, action, ...props }) {
                return (
                    <Toast key={id} {...props} className="border-danger-200 bg-danger-100">
                        <div className="grid gap-1">
                            {title && (
                                <ToastTitle className="flex items-center gap-2 text-danger-600">
                                    <div>{title}</div>
                                    <MdErrorOutline className="h-5 w-5" />
                                </ToastTitle>
                            )}
                            {description && (
                                <ToastDescription className="text-neutral-600">
                                    {description}
                                </ToastDescription>
                            )}
                        </div>
                        {action}
                        <ToastClose className="text-danger-600 hover:text-danger-700" />
                    </Toast>
                );
            })}
            <ToastViewport />
        </ToastProvider>
    );
}

// Helper function to show error toast

export const showErrorToast = (description: string) => {
    toast({
        title: "Login Error",
        description: description,
    });
};
