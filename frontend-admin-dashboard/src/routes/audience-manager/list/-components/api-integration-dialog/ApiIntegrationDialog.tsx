import { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Copy, Code, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { CampaignItem } from '../../-services/get-campaigns-list';
import {
    generateCurlCommand,
    SUBMIT_AUDIENCE_LEAD_URL,
} from '../../-services/submit-audience-lead';

interface ApiIntegrationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    campaign: CampaignItem;
}

export const ApiIntegrationDialog = ({ isOpen, onClose, campaign }: ApiIntegrationDialogProps) => {
    const [copiedSection, setCopiedSection] = useState<string | null>(null);

    const campaignId = campaign.id || campaign.campaign_id || campaign.audience_id || '';

    // Extract custom fields from campaign
    const customFields = useMemo(() => {
        if (!campaign.institute_custom_fields) return [];
        return campaign.institute_custom_fields.map((field: any) => ({
            id: field.custom_field?.id || field.id,
            fieldName: field.custom_field?.fieldName || field.custom_field?.field_name || '',
            fieldKey: field.custom_field?.fieldKey || field.custom_field?.field_key || '',
            fieldType: field.custom_field?.fieldType || field.custom_field?.field_type || 'TEXT',
            isMandatory: field.custom_field?.isMandatory ?? true,
        }));
    }, [campaign.institute_custom_fields]);

    const curlCommand = useMemo(() => {
        return generateCurlCommand(campaignId, customFields);
    }, [campaignId, customFields]);

    const handleCopy = async (text: string, section: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedSection(section);
            toast.success('Copied to clipboard!');
            setTimeout(() => setCopiedSection(null), 2000);
        } catch (error) {
            toast.error('Failed to copy');
        }
    };

    const documentationMarkdown = `
## API Integration Guide

### Endpoint
\`\`\`
POST ${SUBMIT_AUDIENCE_LEAD_URL}
\`\`\`

### Headers
| Header | Value |
|--------|-------|
| Content-Type | application/json |
| Accept | application/json |

### Request Body Structure

\`\`\`json
{
  "audience_id": "${campaignId}",
  "source_type": "AUDIENCE_CAMPAIGN",
  "source_id": "${campaignId}",
  "custom_field_values": {
    // Key-value pairs where key is field ID
${customFields.map((f) => `    "${f.id}": "<value>" // ${f.fieldName}${f.isMandatory ? ' (Required)' : ''}`).join('\n')}
  },
  "user_dto": {
    "username": "<email>",
    "email": "<email>",
    "full_name": "<full_name>",
    "mobile_number": "<phone_with_country_code>"
  }
}
\`\`\`

### Custom Fields Reference

| Field ID | Field Name | Type | Required |
|----------|------------|------|----------|
${customFields.map((f) => `| \`${f.id}\` | ${f.fieldName} | ${f.fieldType} | ${f.isMandatory ? 'Yes' : 'No'} |`).join('\n')}

### Response

**Success (200 OK)**
\`\`\`json
{
  "success": true,
  "response_id": "<generated_response_id>"
}
\`\`\`

**Error (4xx/5xx)**
\`\`\`json
{
  "error": "<error_message>"
}
\`\`\`

### Integration Examples

#### Zapier Integration
1. Create a new Zap
2. Choose your trigger app (e.g., Google Forms, Typeform)
3. Add Webhooks by Zapier as action
4. Select "POST" method
5. Paste the endpoint URL
6. Set Content-Type to application/json
7. Map your trigger fields to the request body

#### Make (Integromat)
1. Create a new scenario
2. Add your trigger module
3. Add HTTP > Make a request module
4. Configure with the endpoint and payload structure above
`;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl overflow-hidden sm:w-[90vw]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Code className="size-5" />
                        API Integration - {campaign.campaign_name}
                    </DialogTitle>
                    <DialogDescription>
                        Use these details to integrate with automation tools like Zapier, Make, or
                        custom applications.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="curl" className="mt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="curl" className="flex items-center gap-2">
                            <Code className="size-4" />
                            cURL Command
                        </TabsTrigger>
                        <TabsTrigger value="docs" className="flex items-center gap-2">
                            <FileText className="size-4" />
                            Documentation
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="curl" className="mt-4">
                        <div className="relative">
                            <Button
                                variant="outline"
                                size="sm"
                                className="absolute right-2 top-2 z-10"
                                onClick={() => handleCopy(curlCommand, 'curl')}
                            >
                                {copiedSection === 'curl' ? (
                                    <>
                                        <Check className="mr-2 size-4" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="mr-2 size-4" />
                                        Copy
                                    </>
                                )}
                            </Button>
                            <pre className="max-h-[400px] overflow-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-100">
                                <code>{curlCommand}</code>
                            </pre>
                        </div>
                        <p className="mt-3 text-sm text-neutral-600">
                            Replace the placeholder values (e.g.,{' '}
                            <code className="rounded bg-neutral-100 px-1">&lt;email&gt;</code>) with
                            actual data before making the request.
                        </p>
                    </TabsContent>

                    <TabsContent value="docs" className="mt-4">
                        <div className="relative">
                            <Button
                                variant="outline"
                                size="sm"
                                className="absolute right-2 top-2 z-10"
                                onClick={() => handleCopy(documentationMarkdown, 'docs')}
                            >
                                {copiedSection === 'docs' ? (
                                    <>
                                        <Check className="mr-2 size-4" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="mr-2 size-4" />
                                        Copy Markdown
                                    </>
                                )}
                            </Button>
                            <div className="prose prose-sm max-h-[400px] max-w-none overflow-auto rounded-lg border bg-white p-4">
                                <h2 className="text-lg font-semibold">API Integration Guide</h2>

                                <h3 className="mt-4 text-base font-medium">Endpoint</h3>
                                <code className="block rounded bg-neutral-100 p-2 text-sm">
                                    POST {SUBMIT_AUDIENCE_LEAD_URL}
                                </code>

                                <h3 className="mt-4 text-base font-medium">Headers</h3>
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="py-2 text-left">Header</th>
                                            <th className="py-2 text-left">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="py-1">Content-Type</td>
                                            <td className="py-1">application/json</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1">Accept</td>
                                            <td className="py-1">application/json</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <h3 className="mt-4 text-base font-medium">Custom Fields</h3>
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="py-2 text-left">Field ID</th>
                                            <th className="py-2 text-left">Name</th>
                                            <th className="py-2 text-left">Type</th>
                                            <th className="py-2 text-left">Required</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customFields.map((field) => (
                                            <tr key={field.id} className="border-b">
                                                <td className="py-1">
                                                    <code className="text-xs">{field.id}</code>
                                                </td>
                                                <td className="py-1">{field.fieldName}</td>
                                                <td className="py-1">{field.fieldType}</td>
                                                <td className="py-1">
                                                    {field.isMandatory ? 'Yes' : 'No'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <h3 className="mt-4 text-base font-medium">Integration Examples</h3>
                                <div className="rounded-lg bg-blue-50 p-3">
                                    <p className="font-medium text-blue-800">Zapier Integration</p>
                                    <ol className="mt-2 list-decimal pl-4 text-blue-700">
                                        <li>Create a new Zap</li>
                                        <li>Choose your trigger app</li>
                                        <li>Add Webhooks by Zapier as action</li>
                                        <li>Select &quot;POST&quot; method</li>
                                        <li>Paste the endpoint URL</li>
                                        <li>Map your fields to the request body</li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
