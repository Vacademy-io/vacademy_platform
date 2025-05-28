import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import {
    ValidationError,
    SchemaFields,
} from '@/routes/manage-students/students-list/-types/bulk-upload-types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Warning } from '@phosphor-icons/react';
import { DialogTitle } from '@radix-ui/react-dialog';
import { useEffect } from 'react';

interface ErrorDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    errors: ValidationError[];
    rowData: SchemaFields;
    isApiError?: boolean;
}

export const ErrorDetailsDialog = ({
    isOpen,
    onClose,
    errors,
    rowData,
    isApiError = false,
}: ErrorDetailsDialogProps) => {
    // For API errors, extract useful details from the error message

    const getFormattedApiError = (errorMessage: string) => {
        if (!errorMessage) return { mainError: 'Unknown error', details: '' };

        // Try to extract and format JDBC constraint error messages which contain "Detail:"
        const jdbcPattern = /JDBC exception executing SQL \[(.*?)\] \[(.*?)\]/;
        const detailPattern = /Detail: (.*?)(?=\]|\n|$)/;

        const jdbcMatch = errorMessage.match(jdbcPattern);
        const detailMatch = errorMessage.match(detailPattern);

        if (jdbcMatch && jdbcMatch.length > 2) {
            const sqlStatement = jdbcMatch[1];
            const errorDesc = jdbcMatch[2];
            const detail = detailMatch ? detailMatch[1] : '';

            return {
                mainError: errorDesc,
                details: detail,
                sqlStatement: sqlStatement,
            };
        }

        // If we can't extract a structured error, just return the raw message
        return {
            mainError:
                errorMessage.length > 200 ? errorMessage.substring(0, 197) + '...' : errorMessage,
            details: errorMessage.length > 200 ? errorMessage : '',
        };
    };

    const formattedError =
        isApiError && errors.length > 0 && errors[0]?.currentVal
            ? getFormattedApiError(errors[0].currentVal)
            : null;

    useEffect(() => {
        console.log('formattedError: ', formattedError);
    }, [formattedError]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[800px] max-w-[900px] p-0 font-normal">
                <DialogTitle>
                    <DialogHeader>
                        <div className="flex items-center bg-danger-50 px-6 py-4 text-h3 font-semibold text-danger-600">
                            <Warning className="mr-2 size-5" />
                            {isApiError ? 'Upload Error' : 'Validation Errors'}
                        </div>
                    </DialogHeader>
                </DialogTitle>

                <div className="p-6">
                    {isApiError ? (
                        // Display API errors with better formatting
                        <div className="space-y-4">
                            <div className="rounded-md bg-danger-50 p-4">
                                <h3 className="mb-2 text-lg font-medium text-danger-700">
                                    Upload failed for this entry
                                </h3>
                                {formattedError ? (
                                    <div className="text-danger-600">
                                        <p className="font-medium">{formattedError.mainError}</p>
                                        {formattedError.details && (
                                            <p className="mt-2">{formattedError.details}</p>
                                        )}
                                        {formattedError.sqlStatement && (
                                            <div className="mt-3">
                                                <p className="text-sm text-neutral-700">
                                                    SQL Statement:
                                                </p>
                                                <p className="mt-1 rounded bg-neutral-100 p-2 font-mono text-xs">
                                                    {formattedError.sqlStatement}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap text-danger-600">
                                        {rowData.ERROR ||
                                            rowData.STATUS_MESSAGE ||
                                            'Unknown error occurred during upload.'}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4">
                                <h3 className="mb-2 text-lg font-medium">Row Data</h3>
                                <Table className="border">
                                    <TableHeader className="bg-neutral-100">
                                        <TableRow>
                                            <TableHead className="w-1/3 border-r p-3 font-semibold text-neutral-700">
                                                Field
                                            </TableHead>
                                            <TableHead className="w-2/3 p-3 font-semibold text-neutral-700">
                                                Value
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.entries(rowData)
                                            .filter(
                                                ([key]) =>
                                                    key !== 'ERROR' &&
                                                    key !== 'STATUS' &&
                                                    key !== 'STATUS_MESSAGE'
                                            )
                                            .map(([key, value]) => (
                                                <TableRow key={key}>
                                                    <TableCell className="border-r p-3 font-medium">
                                                        {key.replace(/_/g, ' ')}
                                                    </TableCell>
                                                    <TableCell className="p-3">
                                                        {value?.toString() || 'N/A'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ) : (
                        // Display validation errors
                        <Table className="border">
                            <TableHeader className="bg-neutral-100">
                                <TableRow>
                                    <TableHead className="w-1/5 border-r p-3 font-semibold text-neutral-700">
                                        Position
                                    </TableHead>
                                    <TableHead className="w-1/4 border-r p-3 font-semibold text-neutral-700">
                                        Error
                                    </TableHead>
                                    <TableHead className="w-1/3 border-r p-3 font-semibold text-neutral-700">
                                        Resolution
                                    </TableHead>
                                    <TableHead className="w-1/5 p-3 font-semibold text-neutral-700">
                                        Current Value
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {errors.map((error, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="border-r p-3">
                                            {`In row ${error.path[0] + 1} of ${error.path[1]}`}
                                        </TableCell>
                                        <TableCell className="border-r p-3 text-danger-600">
                                            {error.message}
                                        </TableCell>
                                        <TableCell className="border-r p-3 text-success-600">
                                            {error.resolution}
                                        </TableCell>
                                        <TableCell className="p-3">
                                            {error.currentVal ||
                                                rowData[error.path[1]]?.toString() ||
                                                'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>

                <DialogFooter className="border-t px-6 py-4">
                    <MyButton
                        buttonType="primary"
                        scale="large"
                        layoutVariant="default"
                        onClick={onClose}
                    >
                        Close
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
