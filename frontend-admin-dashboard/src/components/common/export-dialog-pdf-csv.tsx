import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { MyButton } from "../design-system/button";
import { Export } from "phosphor-react";
import { DashboardLoader } from "../core/dashboard-loader";

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
            <DialogContent className="flex flex-col !p-0">
                <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                    Export
                </h1>
                <div className="mb-4 flex flex-col items-center justify-center gap-4">
                    {isEnablePDF && (
                        <MyButton
                            type="button"
                            scale="large"
                            buttonType="secondary"
                            className="font-medium"
                            onClick={handleExportPDF}
                        >
                            {isPDFLoading ? <DashboardLoader size={20} /> : "PDF"}
                        </MyButton>
                    )}
                    {isEnableCSV && (
                        <MyButton
                            type="button"
                            scale="large"
                            buttonType="secondary"
                            className="font-medium"
                            onClick={handleExportCSV}
                        >
                            {isCSVLoading ? <DashboardLoader size={20} /> : "CSV"}
                        </MyButton>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ExportDialogPDFCSV;
