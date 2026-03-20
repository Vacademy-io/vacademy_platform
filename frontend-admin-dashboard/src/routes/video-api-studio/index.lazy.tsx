import { useState, useEffect, useCallback } from 'react';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, Plus, Video, BookOpen, Loader2, KeyRound, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import {
    ApiKey,
    GenerateKeyResponse,
    generateApiKey,
    listApiKeys,
    revokeApiKey,
    storeFullApiKey,
    removeStoredApiKey,
} from './-services/api-keys';
import { ApiKeyCard } from './-components/ApiKeyCard';
import { CreateKeyDialog } from './-components/CreateKeyDialog';
import { ApiDocumentation } from './-components/ApiDocumentation';

export const Route = createLazyFileRoute('/video-api-studio/')({
    component: VideoApiStudio,
});

function VideoApiStudio() {
    const navigate = useNavigate();
    const instituteId = getInstituteId();

    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRevoking, setIsRevoking] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [activeTab, setActiveTab] = useState('keys');

    const fetchApiKeys = useCallback(async () => {
        if (!instituteId) return;
        setIsLoading(true);
        try {
            const keys = await listApiKeys(instituteId);
            setApiKeys(keys);
        } catch (error: any) {
            if (error.response?.status === 404) {
                setApiKeys([]);
            } else {
                console.error('Error fetching API keys:', error);
                toast.error('Failed to fetch API keys');
            }
        } finally {
            setIsLoading(false);
        }
    }, [instituteId]);

    useEffect(() => {
        fetchApiKeys();
    }, [fetchApiKeys]);

    const handleGenerateKey = async (name: string): Promise<GenerateKeyResponse | null> => {
        if (!instituteId) {
            toast.error('Institute ID not found');
            return null;
        }
        setIsGenerating(true);
        try {
            const result = await generateApiKey(instituteId, name);
            // Store the full key in localStorage for later use
            storeFullApiKey(result.id, result.key);
            toast.success('API key generated successfully');
            await fetchApiKeys();
            return result;
        } catch (error) {
            console.error('Error generating API key:', error);
            toast.error('Failed to generate API key');
            return null;
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRevokeKey = async (keyId: string) => {
        if (!instituteId) return;
        setIsRevoking(true);
        try {
            await revokeApiKey(instituteId, keyId);
            // Remove stored full key
            removeStoredApiKey(keyId);
            toast.success('API key revoked successfully');
            await fetchApiKeys();
        } catch (error) {
            console.error('Error revoking API key:', error);
            toast.error('Failed to revoke API key');
        } finally {
            setIsRevoking(false);
        }
    };

    const activeKeys = apiKeys.filter((k) => k.status === 'active');
    const hasKeys = activeKeys.length > 0;

    return (
        <LayoutContainer>
            <div className="flex flex-col gap-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                            AI Content API Studio
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage your API keys and access video generation APIs
                        </p>
                    </div>
                    <Button
                        onClick={() => navigate({ to: '/video-api-studio/console' })}
                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                    >
                        <Video className="h-4 w-4 mr-2" />
                        Content AI Console
                    </Button>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList>
                        <TabsTrigger value="keys" className="gap-2">
                            <Key className="h-4 w-4" />
                            API Keys
                        </TabsTrigger>
                        <TabsTrigger value="docs" className="gap-2">
                            <BookOpen className="h-4 w-4" />
                            Documentation
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="keys" className="mt-6">
                        {isLoading ? (
                            <Card>
                                <CardContent className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </CardContent>
                            </Card>
                        ) : !hasKeys ? (
                            <Card className="border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-16">
                                    <div className="rounded-full bg-muted p-4 mb-4">
                                        <KeyRound className="h-10 w-10 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-medium mb-2">No API Keys Found</h3>
                                    <p className="text-muted-foreground text-center max-w-md mb-6">
                                        Create your first API key to start using the Vacademy AI
                                        Video Generation API. Your key will allow you to generate
                                        AI-powered videos programmatically.
                                    </p>
                                    <Button onClick={() => setShowCreateDialog(true)}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create Your First Key
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-medium">Your API Keys</h2>
                                        <p className="text-sm text-muted-foreground">
                                            {activeKeys.length} active key
                                            {activeKeys.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <Button onClick={() => setShowCreateDialog(true)}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create New Key
                                    </Button>
                                </div>

                                <div className="grid gap-4">
                                    {apiKeys.map((key) => (
                                        <ApiKeyCard
                                            key={key.id}
                                            apiKey={key}
                                            onRevoke={handleRevokeKey}
                                            isRevoking={isRevoking}
                                        />
                                    ))}
                                </div>

                                <Card className="bg-blue-50 border-blue-200">
                                    <CardContent className="flex items-start gap-3 py-4">
                                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-medium text-blue-900">
                                                Security Tip
                                            </h4>
                                            <p className="text-sm text-blue-800">
                                                Keep your API keys secure and never expose them in
                                                client-side code. Use environment variables or
                                                secrets management for production applications.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="docs" className="mt-6">
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5" />
                                    Vacademy AI Content Generation API
                                </CardTitle>
                                <CardDescription>
                                    Generate high-quality AI videos from text prompts
                                    programmatically
                                </CardDescription>
                            </CardHeader>
                        </Card>
                        <ApiDocumentation />
                    </TabsContent>
                </Tabs>
            </div>

            <CreateKeyDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                onGenerate={handleGenerateKey}
                isGenerating={isGenerating}
            />
        </LayoutContainer>
    );
}
