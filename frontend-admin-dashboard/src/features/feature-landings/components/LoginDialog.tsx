import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { LoginForm } from '@/routes/login/-components/LoginPages/sections/login-form';

interface LoginDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto p-0 sm:max-w-3xl">
                <DialogTitle className="sr-only">Login</DialogTitle>
                <LoginForm />
            </DialogContent>
        </Dialog>
    );
}
