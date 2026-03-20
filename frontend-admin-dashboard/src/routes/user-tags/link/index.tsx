import { createFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useEffect, useState } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    downloadCsvTemplate,
    addUsersToTagByName,
    uploadCsvForTagName,
    buildFailedCasesCsv,
    type BulkResult,
} from '@/services/tag-management';
import { toast } from 'sonner';

export const Route = createFileRoute('/user-tags/link/')({
    component: () => (
        <LayoutContainer>
            <RouteComponent />
        </LayoutContainer>
    ),
});

function parseTokens(input: string): string[] {
    return input
        .split(/\r?\n|,|\s+/g)
        .map((s) => s.trim())
        .filter(Boolean);
}

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();
    const [userIds, setUserIds] = useState<string[]>([]);
    const [userInput, setUserInput] = useState('');
    const [tagNames, setTagNames] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [csvTagName, setCsvTagName] = useState('');
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [lastResult, setLastResult] = useState<BulkResult | null>(null);

    useEffect(() => {
        setNavHeading('Manage User Tags • Link Tag');
    }, [setNavHeading]);

    const addUserTokensFromString = (value: string) => {
        const tokens = parseTokens(value);
        if (tokens.length === 0) return;
        setUserIds((prev) => Array.from(new Set([...prev, ...tokens])));
    };
    const addTagTokensFromString = (value: string) => {
        const tokens = parseTokens(value);
        if (tokens.length === 0) return;
        setTagNames((prev) => Array.from(new Set([...prev, ...tokens])));
    };

    const onUserKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addUserTokensFromString(userInput);
            setUserInput('');
        }
    };
    const onTagKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTagTokensFromString(tagInput);
            setTagInput('');
        }
    };
    const onUserPaste: React.ClipboardEventHandler<HTMLInputElement> = (e) => {
        const text = e.clipboardData.getData('text');
        if (text) {
            e.preventDefault();
            addUserTokensFromString(text);
        }
    };
    const onTagPaste: React.ClipboardEventHandler<HTMLInputElement> = (e) => {
        const text = e.clipboardData.getData('text');
        if (text) {
            e.preventDefault();
            addTagTokensFromString(text);
        }
    };
    const removeUserAt = (idx: number) => {
        setUserIds((prev) => prev.filter((_, i) => i !== idx));
    };
    const removeTagAt = (idx: number) => {
        setTagNames((prev) => prev.filter((_, i) => i !== idx));
    };

    const onSubmit = async () => {
        if (userIds.length === 0 || tagNames.length === 0) {
            toast.error('Please provide at least one user id and one tag name');
            return;
        }
        setIsSubmitting(true);
        try {
            const aggregate: BulkResult = {
                totalProcessed: 0,
                successCount: 0,
                skipCount: 0,
                errorCount: 0,
                errors: [],
                userErrors: {},
                autoCreatedTags: [],
            };
            for (const tagName of tagNames) {
                const res = await addUsersToTagByName(tagName, userIds);
                aggregate.totalProcessed += res.totalProcessed;
                aggregate.successCount += res.successCount;
                aggregate.skipCount += res.skipCount;
                aggregate.errorCount += res.errorCount;
                if (res.errors?.length) aggregate.errors!.push(...res.errors);
                if (res.userErrors) {
                    aggregate.userErrors = { ...(aggregate.userErrors || {}), ...res.userErrors };
                }
                if (res.autoCreatedTags?.length) {
                    aggregate.autoCreatedTags!.push(...res.autoCreatedTags);
                }
            }
            setLastResult(aggregate);
            if (aggregate.errorCount === 0) {
                toast.success(
                    `Tags linked. Success: ${aggregate.successCount}, Skipped: ${aggregate.skipCount}`
                );
            } else {
                toast.warning(
                    `Completed with errors. Success: ${aggregate.successCount}, Errors: ${aggregate.errorCount}`
                );
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to add tags';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const onDownloadTemplate = async () => {
        try {
            const blob = await downloadCsvTemplate();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'user_tags_template.csv';
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to download template';
            toast.error(msg);
        }
    };

    const onUploadCsv = async () => {
        if (!csvTagName || !csvFile) {
            toast.error('Please provide a tag name and select a CSV file');
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await uploadCsvForTagName(csvTagName, csvFile);
            setLastResult(res);
            if (res.errorCount === 0)
                toast.success(`Processed ${res.totalProcessed}. Success ${res.successCount}.`);
            else
                toast.warning(
                    `Processed with errors. Success ${res.successCount}, Errors ${res.errorCount}.`
                );
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'CSV upload failed';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const downloadFailedCases = () => {
        const blob = buildFailedCasesCsv(lastResult?.userErrors);
        if (!blob) {
            toast.info('No failed cases to download');
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'failed_user_tags.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 p-2">
            <Card>
                <CardHeader>
                    <CardTitle>Link Tag to Users</CardTitle>
                    <CardDescription>
                        Add one or more tags to multiple users. Multi-select inputs are supported.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <Label>User IDs</Label>
                            <Input
                                placeholder="Type and press Enter to add multiple..."
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={onUserKeyDown}
                                onPaste={onUserPaste}
                            />
                            {userIds.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {userIds.map((u, idx) => (
                                        <div
                                            key={`${u}-${idx}`}
                                            className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs"
                                        >
                                            <span>{u}</span>
                                            <button
                                                type="button"
                                                className="text-neutral-500 hover:text-neutral-700"
                                                onClick={() => removeUserAt(idx)}
                                                aria-label="Remove"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="mt-1 text-xs text-muted-foreground">
                                Paste list or comma-separated. We&apos;ll deduplicate automatically.
                            </div>
                            <div className="mt-2 text-xs">Count: {userIds.length}</div>
                        </div>
                        <div>
                            <Label>Tag Names</Label>
                            <Input
                                placeholder="Type and press Enter to add multiple tags..."
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={onTagKeyDown}
                                onPaste={onTagPaste}
                            />
                            {tagNames.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {tagNames.map((t, idx) => (
                                        <div
                                            key={`${t}-${idx}`}
                                            className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs"
                                        >
                                            <span>{t}</span>
                                            <button
                                                type="button"
                                                className="text-neutral-500 hover:text-neutral-700"
                                                onClick={() => removeTagAt(idx)}
                                                aria-label="Remove"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="mt-1 text-xs text-muted-foreground">
                                Multiple tags supported. Auto-create enabled.
                            </div>
                            <div className="mt-2 text-xs">Count: {tagNames.length}</div>
                        </div>
                    </div>
                    <div>
                        <Button disabled={isSubmitting} onClick={onSubmit}>
                            {isSubmitting ? 'Linking...' : 'Link Tags'}
                        </Button>
                        <Button
                            variant="outline"
                            className="ml-2"
                            onClick={() => {
                                setUserIds([]);
                                setUserInput('');
                                setTagNames([]);
                                setTagInput('');
                                setLastResult(null);
                            }}
                        >
                            Clear
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>CSV Upload</CardTitle>
                    <CardDescription>
                        Upload a CSV containing user_id to add a single tag to all listed users.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="w-64">
                            <Label>Tag Name</Label>
                            <Input
                                value={csvTagName}
                                onChange={(e) => setCsvTagName(e.target.value)}
                            />
                        </div>
                        <div className="w-72">
                            <Label>CSV File</Label>
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                            />
                        </div>
                        <Button variant="secondary" onClick={onDownloadTemplate}>
                            Download Template
                        </Button>
                        <Button disabled={isSubmitting} onClick={onUploadCsv}>
                            {isSubmitting ? 'Uploading...' : 'Upload CSV'}
                        </Button>
                        <Button variant="outline" onClick={downloadFailedCases}>
                            Download Failed Cases
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {lastResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Operation Status</CardTitle>
                        <CardDescription>Summary of the last operation</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded border p-3 text-sm">
                            Total Processed: {lastResult.totalProcessed}
                        </div>
                        <div className="rounded border p-3 text-sm">
                            Success: {lastResult.successCount}
                        </div>
                        <div className="rounded border p-3 text-sm">
                            Skipped: {lastResult.skipCount}
                        </div>
                        <div className="rounded border p-3 text-sm">
                            Errors: {lastResult.errorCount}
                        </div>
                        {lastResult.autoCreatedTags && lastResult.autoCreatedTags.length > 0 && (
                            <div className="col-span-2 rounded border p-3 text-sm md:col-span-4">
                                Auto-created tags:{' '}
                                {lastResult.autoCreatedTags.map((t) => t.tagName).join(', ')}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
