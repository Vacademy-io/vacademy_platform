import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { AdminMappings, InstituteCustomField, AddMemberRequest, addMember } from '@/services/sub-organization-learner-management';

interface BulkUploadModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  adminMappings: AdminMappings[];
  selectedPackageSession: string;
  instituteCustomFields: InstituteCustomField[];
  onUploadComplete: () => void;
}

interface UploadResult {
  rowNumber: number;
  email: string;
  fullName: string;
  status: 'success' | 'error' | 'pending';
  message: string;
}

export function BulkUploadModal({
  isOpen,
  onOpenChange,
  adminMappings,
  selectedPackageSession,
  instituteCustomFields,
  onUploadComplete,
}: BulkUploadModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [processedRows, setProcessedRows] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSelectedMapping = () => {
    return adminMappings.find(m => m.package_session_id === selectedPackageSession);
  };

  // Generate sample Excel file based on custom fields
  const downloadSampleSheet = () => {
    const headers: string[] = [];
    const sampleRow: string[] = [];

    // Build headers from custom fields (excluding Practice Name which is auto-filled)
    const fieldsToInclude = instituteCustomFields.filter(
      field => field.custom_field.fieldName !== 'Practice Name'
    );

    // Add standard fields first if they exist in custom fields
    const fieldOrder = ['First Name', 'Last Name', 'Email', 'Phone'];
    const orderedFields: InstituteCustomField[] = [];
    const remainingFields: InstituteCustomField[] = [];

    fieldsToInclude.forEach(field => {
      const index = fieldOrder.indexOf(field.custom_field.fieldName);
      if (index !== -1) {
        orderedFields[index] = field;
      } else {
        remainingFields.push(field);
      }
    });

    const finalFields = [...orderedFields.filter(Boolean), ...remainingFields];

    finalFields.forEach(field => {
      const { fieldName, fieldType, isMandatory, config } = field.custom_field;
      const headerText = isMandatory ? `${fieldName}*` : fieldName;
      headers.push(headerText);

      // Add sample data based on field type
      switch (fieldName) {
        case 'First Name':
          sampleRow.push('John');
          break;
        case 'Last Name':
          sampleRow.push('Doe');
          break;
        case 'Email':
          sampleRow.push('john.doe@example.com');
          break;
        case 'Phone':
          sampleRow.push('+61412345678');
          break;
        default:
          if (fieldType === 'dropdown' && config) {
            try {
              const options = JSON.parse(config);
              sampleRow.push(options[0]?.value || '');
            } catch {
              sampleRow.push('');
            }
          } else if (fieldType === 'number') {
            sampleRow.push('123');
          } else {
            sampleRow.push('Sample Value');
          }
      }
    });

    // Add Organization Roles column
    headers.push('Organization Roles*');
    sampleRow.push('LEARNER');

    // Create workbook and worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);

    // Set column widths
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Learners');

    // Download the file
    XLSX.writeFile(wb, 'learner_bulk_upload_template.xlsx');
    toast.success('Sample template downloaded successfully');
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhoneNumber = (phone: string): boolean => {
    if (!phone) return true; // Phone is optional
    const cleanPhone = phone.replace(/[\s\-\.\(\)]/g, '');
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    return phoneRegex.test(cleanPhone);
  };

  const parseFile = async (file: File): Promise<Record<string, string>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Convert to JSON with header row
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
            raw: false,
            defval: '',
          });

          resolve(jsonData);
        } catch (error) {
          reject(new Error('Failed to parse file. Please ensure it is a valid Excel or CSV file.'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const mapRowToMemberData = (row: Record<string, string>): AddMemberRequest | null => {
    const selectedMapping = getSelectedMapping();
    if (!selectedMapping) return null;

    // Map custom field values from the row
    const customFieldValues: Array<{ custom_field_id: string; value: string }> = [];
    let firstName = '';
    let lastName = '';
    let email = '';
    let phone = '';
    let orgRoles = '';

    // Find fields by their header names (which might have * suffix for mandatory)
    const fieldsToInclude = instituteCustomFields.filter(
      field => field.custom_field.fieldName !== 'Practice Name'
    );

    fieldsToInclude.forEach(field => {
      const { fieldKey, fieldName, id } = field.custom_field;
      
      // Try to find the value in the row (with or without * suffix)
      let value = row[fieldName] || row[`${fieldName}*`] || '';
      value = String(value).trim();

      // Map to standard fields
      if (fieldName === 'First Name') {
        firstName = value;
      } else if (fieldName === 'Last Name') {
        lastName = value;
      } else if (fieldName === 'Email') {
        email = value;
      } else if (fieldName === 'Phone') {
        phone = value;
        // Ensure phone starts with +
        if (phone && !phone.startsWith('+')) {
          phone = `+${phone}`;
        }
      }

      // Add to custom field values if we have a value
      if (value) {
        customFieldValues.push({
          custom_field_id: id,
          value: value,
        });
      }
    });

    // Get organization roles
    orgRoles = (row['Organization Roles'] || row['Organization Roles*'] || 'LEARNER').trim();

    // Also add Practice Name to custom fields
    const practiceNameField = instituteCustomFields.find(
      f => f.custom_field.fieldName === 'Practice Name'
    );
    if (practiceNameField && selectedMapping.sub_org_details?.institute_name) {
      customFieldValues.push({
        custom_field_id: practiceNameField.custom_field.id,
        value: selectedMapping.sub_org_details.institute_name,
      });
    }

    const fullName = `${firstName} ${lastName}`.trim();

    // Validation
    if (!email || !fullName) {
      return null;
    }

    if (!validateEmail(email)) {
      return null;
    }

    if (phone && !validatePhoneNumber(phone)) {
      return null;
    }

    return {
      user: {
        email,
        mobile_number: phone || undefined,
        full_name: fullName,
        username: undefined,
      },
      package_session_id: selectedPackageSession,
      sub_org_id: selectedMapping.sub_org_id,
      institute_id: selectedMapping.institute_id,
      status: 'ACTIVE',
      comma_separated_org_roles: orgRoles || 'LEARNER',
      custom_field_values: customFieldValues.length > 0 ? customFieldValues : undefined,
    };
  };

  const processUpload = async (rows: Record<string, string>[]) => {
    setIsUploading(true);
    setTotalRows(rows.length);
    setProcessedRows(0);
    setUploadResults([]);

    const results: UploadResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed

      // Extract email and name for result tracking
      const email = row['Email'] || row['Email*'] || 'Unknown';
      const firstName = row['First Name'] || row['First Name*'] || '';
      const lastName = row['Last Name'] || row['Last Name*'] || '';
      const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';

      try {
        const memberData = mapRowToMemberData(row);

        if (!memberData) {
          results.push({
            rowNumber,
            email,
            fullName,
            status: 'error',
            message: 'Invalid data: Email and Name are required. Please check the format.',
          });
          continue;
        }

        // Call the API
        await addMember(memberData);

        results.push({
          rowNumber,
          email,
          fullName,
          status: 'success',
          message: 'Successfully added',
        });
      } catch (error: unknown) {
        const errorMessage = 
          (error as { response?: { data?: { ex?: string; message?: string } } })?.response?.data?.ex || 
          (error as { response?: { data?: { ex?: string; message?: string } } })?.response?.data?.message || 
          'Failed to add learner';
        
        results.push({
          rowNumber,
          email,
          fullName,
          status: 'error',
          message: errorMessage,
        });
      }

      setProcessedRows(i + 1);
      setUploadProgress(((i + 1) / rows.length) * 100);
      setUploadResults([...results]);

      // Small delay between API calls to avoid overwhelming the server
      if (i < rows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    setIsUploading(false);
    
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    if (successCount > 0) {
      toast.success(`Successfully added ${successCount} learner(s)`);
      onUploadComplete();
    }
    
    if (errorCount > 0) {
      toast.error(`Failed to add ${errorCount} learner(s). Check the results below.`);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(file.type) && !['xlsx', 'xls', 'csv'].includes(fileExtension || '')) {
      toast.error('Please upload a valid Excel (.xlsx, .xls) or CSV file');
      return;
    }

    try {
      const rows = await parseFile(file);
      
      if (rows.length === 0) {
        toast.error('The file appears to be empty');
        return;
      }

      await processUpload(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process file');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setUploadResults([]);
      setUploadProgress(0);
      setProcessedRows(0);
      setTotalRows(0);
      onOpenChange(false);
    }
  };

  const successCount = uploadResults.filter(r => r.status === 'success').length;
  const errorCount = uploadResults.filter(r => r.status === 'error').length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[80vh] overflow-hidden flex flex-col top-[50%] translate-y-[-50%]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Bulk Upload Learners
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pt-2">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="font-medium text-blue-900 mb-1 text-sm">Instructions</h4>
            <ol className="text-xs text-blue-800 list-decimal list-inside space-y-0.5">
              <li>Download the sample template to see the required format</li>
              <li>Fill in learner details (fields marked with * are mandatory)</li>
              <li>Save your file and upload it below</li>
              <li>Each row will be processed individually</li>
            </ol>
          </div>

          {/* Download Template Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Button variant="outline" size="sm" onClick={downloadSampleSheet} className="w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              Download Sample Template
            </Button>
            <p className="text-xs text-gray-500">
              Excel template with all required fields
            </p>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            
            {isUploading ? (
              <div className="space-y-3">
                <Loader2 className="w-8 h-8 text-primary-500 mx-auto animate-spin" />
                <p className="text-gray-600 text-sm">
                  Processing {processedRows} of {totalRows} learners...
                </p>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 text-sm mb-2">
                  Drag and drop your file here, or
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse Files
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Supports .xlsx, .xls, and .csv files
                </p>
              </>
            )}
          </div>

          {/* Upload Results */}
          {uploadResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 text-sm">Upload Results</h4>
                <div className="flex gap-2">
                  {successCount > 0 && (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {successCount} Success
                    </Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge variant="destructive" className="bg-red-100 text-red-800">
                      <XCircle className="w-3 h-3 mr-1" />
                      {errorCount} Failed
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[160px] border rounded-lg">
                <div className="p-2 space-y-1.5">
                  {uploadResults.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-2 p-2 rounded-lg ${
                        result.status === 'success'
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      {result.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">
                          Row {result.rowNumber}: {result.fullName}
                        </p>
                        <p className="text-xs text-gray-600 truncate">{result.email}</p>
                        <p
                          className={`text-xs ${
                            result.status === 'success' ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {result.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            {uploadResults.length > 0 ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

