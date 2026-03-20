import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, Key } from 'lucide-react';
import { GenerateKeyResponse } from '../-services/api-keys';

interface CreateKeyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onGenerate: (name: string) => Promise<GenerateKeyResponse | null>;
    isGenerating: boolean;
}

export function CreateKeyDialog({
    open,
    onOpenChange,
    onGenerate,
    isGenerating,
}: CreateKeyDialogProps) {
    const [keyName, setKeyName] = useState('');
    const [generatedKey, setGeneratedKey] = useState<GenerateKeyResponse | null>(null);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        if (!keyName.trim()) return;
        const result = await onGenerate(keyName.trim());
        if (result) {
            setGeneratedKey(result);
        }
    };

    const copyToClipboard = async () => {
        if (generatedKey) {
            await navigator.clipboard.writeText(generatedKey.key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClose = () => {
        setKeyName('');
        setGeneratedKey(null);
        setCopied(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        {generatedKey ? 'API Key Generated' : 'Create New API Key'}
                    </DialogTitle>
                    <DialogDescription>
                        {generatedKey
                            ? 'Copy your API key now. You won\'t be able to see it again!'
                            : 'Give your API key a name to help you identify it later.'}
                    </DialogDescription>
                </DialogHeader>

                {!generatedKey ? (
                    <>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="keyName">Key Name</Label>
                                <Input
                                    id="keyName"
                                    placeholder="e.g., Production Key, Dev Key"
                                    value={keyName}
                                    onChange={(e) => setKeyName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && keyName.trim()) {
                                            handleGenerate();
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={!keyName.trim() || isGenerating}
                            >
                                {isGenerating ? 'Generating...' : 'Generate Key'}
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <div className="space-y-4 py-4">
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-sm text-amber-800 font-medium mb-2">
                                    ⚠️ Save this key now!
                                </p>
                                <p className="text-xs text-amber-700">
                                    This is the only time you&apos;ll see the full key. Store it
                                    securely.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Your API Key</Label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-sm bg-muted px-3 py-2 rounded font-mono break-all">
                                        {generatedKey.key}
                                    </code>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={copyToClipboard}
                                    >
                                        {copied ? (
                                            <Check className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleClose}>Done</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
