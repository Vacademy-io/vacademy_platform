import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { MyButton } from '../design-system/button';
import { Export, DownloadSimple } from '@phosphor-icons/react';
import { DashboardLoader } from '../core/dashboard-loader';

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
            <DialogTrigger>
                <MyButton
                    type="button"
                    scale="large"
                    buttonType="secondary"
                    className="font-medium"
                >
                    <Export size={32} />
                    Export
                </MyButton>
            </DialogTrigger>
            <DialogContent className="flex flex-col !p-0 w-[300px]">
                <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                    Export
                </h1>
                <div className="flex items-center justify-center p-4 gap-4">
                    {isEnablePDF && (
                        <MyButton
                            type="button"
                            scale="medium"
                            buttonType="secondary"
                            className="flex items-center justify-center"
                            onClick={handleExportPDF}
                        >
                            {isPDFLoading ? (
                                <DashboardLoader />
                            ) : (
                                <>
                                    <DownloadSimple size={20} className="mr-2" />
                                    PDF
                                </>
                            )}
                        </MyButton>
                    )}
                    {isEnableCSV && (
                        <MyButton
                            type="button"
                            scale="medium"
                            buttonType="primary"
                            className="flex items-center justify-center"
                            onClick={handleExportCSV}
                        >
                            {isCSVLoading ? (
                                <DashboardLoader />
                            ) : (
                                <>
                                    <DownloadSimple size={20} className="mr-2" />
                                    CSV
                                </>
                            )}
                        </MyButton>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ExportDialogPDFCSV;
