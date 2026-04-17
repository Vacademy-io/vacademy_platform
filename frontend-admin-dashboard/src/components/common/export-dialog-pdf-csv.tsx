import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { MyButton } from '../design-system/button';
import { Export } from '@phosphor-icons/react';
import { FileText, FileSpreadsheet, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportOptionCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    accentClass: string;
    iconTileClass: string;
    loading?: boolean;
    disabled?: boolean;
    onClick?: () => void;
}

const ExportOptionCard = ({
    icon,
    title,
    description,
    accentClass,
    iconTileClass,
    loading,
    disabled,
    onClick,
}: ExportOptionCardProps) => {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading || disabled}
            className={cn(
                'group relative flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all',
                'hover:-translate-y-0.5 hover:shadow-md',
                accentClass,
                'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none'
            )}
        >
            <div
                className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110',
                    iconTileClass
                )}
            >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500">{description}</p>
            </div>
            <Download className="h-4 w-4 text-slate-400 transition-colors group-hover:text-slate-700" />
        </button>
    );
};

const ExportDialogPDFCSV = ({
    handleExportPDF,
    handleExportCSV,
    isPDFLoading,
    isCSVLoading,
    isEnablePDF = true,
    isEnableCSV = true,
}: {
    handleExportPDF?: () => void;
    handleExportCSV?: () => void;
    isPDFLoading?: boolean;
    isCSVLoading?: boolean;
    isEnablePDF?: boolean;
    isEnableCSV?: boolean;
}) => {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <MyButton
                    type="button"
                    scale="small"
                    buttonType="secondary"
                    className="font-medium"
                >
                    <Export size={20} />
                    Export
                </MyButton>
            </DialogTrigger>
            <DialogContent className="w-[440px] gap-0 p-0">
                <DialogHeader className="border-b border-slate-200 px-6 py-4">
                    <DialogTitle className="text-lg font-semibold text-slate-900">
                        Export Data
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500">
                        Choose a format to download the report.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 p-6">
                    {isEnablePDF && (
                        <ExportOptionCard
                            icon={<FileText className="h-5 w-5" />}
                            title="Download as PDF"
                            description="Formatted document, ideal for printing"
                            accentClass="hover:border-rose-300 hover:bg-rose-50/40"
                            iconTileClass="bg-rose-50 text-rose-600"
                            loading={isPDFLoading}
                            onClick={handleExportPDF}
                        />
                    )}
                    {isEnableCSV && (
                        <ExportOptionCard
                            icon={<FileSpreadsheet className="h-5 w-5" />}
                            title="Download as CSV"
                            description="Raw data, open in Excel or Sheets"
                            accentClass="hover:border-emerald-300 hover:bg-emerald-50/40"
                            iconTileClass="bg-emerald-50 text-emerald-600"
                            loading={isCSVLoading}
                            onClick={handleExportCSV}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ExportDialogPDFCSV;
