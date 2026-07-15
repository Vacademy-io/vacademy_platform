import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';
import { CodeSimple } from '@phosphor-icons/react';

interface InviteViaEmailCardProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

const CustomHTMLCard = ({ form }: InviteViaEmailCardProps) => {
    return (
        <Card className="mb-4">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <CodeSimple size={22} />
                            <CardTitle className="text-2xl font-bold">Custom HTML</CardTitle>
                        </div>
                        <span className="text-sm text-gray-600">
                            Add custom HTML content to the invite page
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Textarea
                    value={form.watch('customHtml') ?? ''}
                    onChange={(e) => form.setValue('customHtml', e.target.value)}
                    placeholder="Enter custom HTML code here..."
                    rows={5}
                    className="font-mono text-sm"
                />
            </CardContent>
        </Card>
    );
};

export default CustomHTMLCard;
