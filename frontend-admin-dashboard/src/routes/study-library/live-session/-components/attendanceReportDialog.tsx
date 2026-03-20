import { MyDialog } from '@/components/design-system/dialog';

export default function AttendanceReportDialog({
    open,
    setOpen,
}: {
    open: boolean;
    setOpen: (open: boolean) => void;
}) {
    return (
        <MyDialog heading="Attendance Report" open={open} onOpenChange={setOpen}>
            this is the attendance report dialog
        </MyDialog>
    );
}
