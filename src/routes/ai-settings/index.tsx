import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useGetUserApiKeys,
  useSaveUserApiKeys,
  useDeleteUserApiKeys,
  useGetTokenUsage,
} from "@/services/ai-settings-api";
import {
  Eye,
  EyeOff,
  Key,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { AI_SERVICE_BASE_URL } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import axios from "axios";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

export const Route = createFileRoute("/ai-settings/")({
  component: AISettings,
});

interface Model {
  id: string;
  name: string;
  provider: string;
}

function APIKeyManagement() {
  const { data: apiKeyData, isLoading } = useGetUserApiKeys();
  const saveApiKeys = useSaveUserApiKeys();
  const deleteApiKeys = useDeleteUserApiKeys();
  const [models, setModels] = useState<Model[]>([]);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [formData, setFormData] = useState({
    openai_key: "",
    gemini_key: "",
    default_model: apiKeyData?.default_model || "System Default",
  });

  // Fetch models list
  const fetchModels = useCallback(async () => {
    try {
      const token = await getTokenFromStorage(TokenKey.accessToken);
      const response = await axios({
        method: "GET",
        url: `${AI_SERVICE_BASE_URL}/models/v1/list`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      setModels(response.data.models || []);
    } catch (error) {
      console.error("Error fetching models:", error);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([fetchModels()]);
    };
    initialize();
  }, [fetchModels]);

  const handleSave = async () => {
    try {
      const payload: any = {};

      if (
        formData.default_model &&
        formData.default_model !== "System Default"
      ) {
        payload.default_model = formData.default_model;
      }

      // Only include keys if they're not empty
      if (formData.openai_key) {
        payload.openai_key = formData.openai_key;
      }
      if (formData.gemini_key) {
        payload.gemini_key = formData.gemini_key;
      }

      // If no keys provided and no existing keys, show error
      if (
        !formData.openai_key &&
        !formData.gemini_key &&
        !apiKeyData?.has_openai_key &&
        !apiKeyData?.has_gemini_key
      ) {
        toast.error("Please provide at least one API key");
        return;
      }

      await saveApiKeys.mutateAsync(payload);
      toast.success("API keys saved successfully");

      // Clear the input fields after successful save
      setFormData({
        ...formData,
        openai_key: "",
        gemini_key: "",
      });
    } catch (error) {
      toast.error("Failed to save API keys");
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to permanently delete your API keys? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await deleteApiKeys.mutateAsync();
      toast.success("API keys deleted successfully");
      setFormData({
        openai_key: "",
        gemini_key: "",
        default_model: "System Default",
      });
    } catch (error) {
      toast.error("Failed to delete API keys");
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Key Management
        </CardTitle>
        <CardDescription>
          Manage your OpenRouter and Gemini API keys for personalized AI
          interactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Alert */}
        {apiKeyData &&
          (apiKeyData.has_openai_key || apiKeyData.has_gemini_key) && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Active keys: {apiKeyData.has_openai_key && "OpenRouter"}{" "}
                {apiKeyData.has_openai_key && apiKeyData.has_gemini_key && "& "}{" "}
                {apiKeyData.has_gemini_key && "Gemini"}
              </AlertDescription>
            </Alert>
          )}

        {/* OpenAI Key */}
        <div className="space-y-2">
          <Label htmlFor="openai-key">OpenRouter API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="openai-key"
                type={showOpenAIKey ? "text" : "password"}
                placeholder={
                  apiKeyData?.has_openai_key
                    ? "••••••••••••••••••••"
                    : "Enter your OpenRouter API key"
                }
                value={formData.openai_key}
                onChange={(e) =>
                  setFormData({ ...formData, openai_key: e.target.value })
                }
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowOpenAIKey(!showOpenAIKey)}
              >
                {showOpenAIKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          {apiKeyData?.has_openai_key && (
            <p className="text-xs text-muted-foreground">
              You have an OpenRouter key configured. Enter a new key to replace
              it.
            </p>
          )}
        </div>

        {/* Gemini Key */}
        <div className="space-y-2">
          <Label htmlFor="gemini-key">Gemini API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="gemini-key"
                type={showGeminiKey ? "text" : "password"}
                placeholder={
                  apiKeyData?.has_gemini_key
                    ? "••••••••••••••••••••"
                    : "Enter your Gemini API key"
                }
                value={formData.gemini_key}
                onChange={(e) =>
                  setFormData({ ...formData, gemini_key: e.target.value })
                }
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
              >
                {showGeminiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          {apiKeyData?.has_gemini_key && (
            <p className="text-xs text-muted-foreground">
              You have a Gemini key configured. Enter a new key to replace it.
            </p>
          )}
        </div>

        {/* Default Model */}
        <div className="space-y-2">
          <Label htmlFor="default-model">Default AI Model</Label>
          <Select
            value={models[0].id}
            onValueChange={(value) =>
              setFormData({ ...formData, default_model: value })
            }
          >
            <SelectTrigger id="default-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The default model used when "Auto" is selected during generation
          </p>
        </div>

        {/* Security Warning */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your API keys are securely encrypted and stored. They are never
            visible after saving and cannot be retrieved - only replaced or
            deleted.
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saveApiKeys.isPending}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveApiKeys.isPending ? "Saving..." : "Save Keys"}
          </Button>
          {apiKeyData &&
            (apiKeyData.has_openai_key || apiKeyData.has_gemini_key) && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteApiKeys.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Keys
              </Button>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

function TokenUsage() {
  const [dateRange, setDateRange] = useState({
    start_date: format(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd"
    ),
    end_date: format(new Date(), "yyyy-MM-dd"),
  });

  const { data: tokenUsage, isLoading } = useGetTokenUsage(dateRange);

  const totalCost =
    tokenUsage?.records.reduce((sum, record) => sum + record.total_price, 0) ||
    0;
  const totalTokens =
    tokenUsage?.records.reduce((sum, record) => sum + record.total_tokens, 0) ||
    0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Token Usage & Costs
        </CardTitle>
        <CardDescription>
          View your AI token usage and associated costs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Range Filter */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={dateRange.start_date}
              onChange={(e) =>
                setDateRange({ ...dateRange, start_date: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={dateRange.end_date}
              onChange={(e) =>
                setDateRange({ ...dateRange, end_date: e.target.value })
              }
            />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tokenUsage?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Tokens</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalTokens.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Cost</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Usage Records */}
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : tokenUsage && tokenUsage.records.length > 0 ? (
          <div className="space-y-3">
            <Label>Recent Activity</Label>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Provider</th>
                      <th className="text-left p-3 font-medium">Model</th>
                      <th className="text-right p-3 font-medium">Tokens</th>
                      <th className="text-right p-3 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tokenUsage.records.map((record) => (
                      <tr key={record.id} className="hover:bg-muted/50">
                        <td className="p-3">
                          {format(
                            new Date(record.created_at),
                            "MMM d, yyyy HH:mm"
                          )}
                        </td>
                        <td className="p-3 capitalize">
                          {record.api_provider}
                        </td>
                        <td className="p-3">{record.model}</td>
                        <td className="p-3 text-right">
                          {record.total_tokens.toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          ${record.total_price.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No usage records found for the selected date range.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function AISettings() {
  return (
    <LayoutContainer>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">AI Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your AI API keys and monitor token usage
          </p>
        </div>

        <Tabs defaultValue="api-keys" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="usage">Token Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys">
            <APIKeyManagement />
          </TabsContent>

          <TabsContent value="usage">
            <TokenUsage />
          </TabsContent>
        </Tabs>
      </div>
    </LayoutContainer>
  );
}
