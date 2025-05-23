import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertCircle } from 'lucide-react'

interface TimesUpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFinish: () => void
}

export function TimesUpModal({ open, onOpenChange, onFinish }: TimesUpModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary-500" />
            Time is up!
          </AlertDialogTitle>
          <AlertDialogDescription>
            Time for the Assessment has ended. Click to submit your responses.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={onFinish}
            className="w-full bg-primary-500 text-white"
          >
            Finish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

