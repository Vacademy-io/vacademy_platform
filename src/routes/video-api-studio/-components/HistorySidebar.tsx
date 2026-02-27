import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Video,
    Trash2,
    Clock,
    CheckCircle2,
    Loader2,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    History as HistoryIcon,
} from 'lucide-react';
import { HistoryItem } from '../-services/video-generation';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface HistorySidebarProps {
    history: HistoryItem[];
    selectedId: string | null;
    onSelect: (item: HistoryItem) => void;
    onDelete: (videoId: string) => void;
    onNewVideo: () => void;
}

export function HistorySidebar({
    history,
    selectedId,
    onSelect,
    onDelete,
    onNewVideo,
}: HistorySidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(true);

    const getStatusIcon = (status: HistoryItem['status']) => {
        switch (status) {
            case 'pending':
                return <Clock className="size-4 text-muted-foreground" />;
            case 'generating':
                return <Loader2 className="size-4 animate-spin text-blue-500" />;
            case 'completed':
                return <CheckCircle2 className="size-4 text-green-500" />;
            case 'failed':
                return <AlertCircle className="size-4 text-red-500" />;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    if (isCollapsed) {
        return (
            <div className="flex w-12 flex-col items-center gap-2 border-r bg-card py-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCollapsed(false)}
                    className="mb-4"
                >
                    <ChevronRight className="size-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNewVideo}
                    className="text-primary"
                    title="New Video"
                >
                    <Video className="size-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="flex h-full w-96 flex-col border-r bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b bg-card/50 p-4">
                <div className="flex items-center gap-2">
                    <HistoryIcon className="size-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground">History</h2>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCollapsed(true)}
                    className="size-7 text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="size-4" />
                </Button>
            </div>

            <div className="p-3">
                <Button
                    onClick={onNewVideo}
                    className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10 transition-all duration-300 hover:scale-[1.02] hover:from-violet-700 hover:to-indigo-700"
                    size="sm"
                >
                    <Video className="size-4" />
                    New Video
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="space-y-1 p-2">
                    {history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted/50">
                                <Video className="size-5 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm font-medium text-foreground">No videos yet</p>
                            <p className="mt-1 max-w-[150px] text-xs text-muted-foreground">
                                Your generated videos will appear here
                            </p>
                        </div>
                    ) : (
                        history.map((item) => (
                            <div
                                key={item.video_id}
                                className={`group relative cursor-pointer rounded-lg border p-3 transition-all duration-200 ${
                                    selectedId === item.video_id
                                        ? 'border-violet-200 bg-violet-50 shadow-sm dark:border-violet-800/30 dark:bg-violet-950/20'
                                        : 'border-transparent bg-transparent hover:border-border/50 hover:bg-muted/50'
                                }`}
                                onClick={() => onSelect(item)}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 shrink-0">
                                        {getStatusIcon(item.status)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className={`line-clamp-2 pr-7 text-sm font-medium leading-tight ${
                                                selectedId === item.video_id
                                                    ? 'text-violet-900 dark:text-violet-100'
                                                    : 'text-foreground'
                                            }`}
                                        >
                                            {item.prompt}
                                        </p>
                                        <div className="mt-1.5 flex items-center gap-2">
                                            <span className="flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                                <Clock className="size-3" />
                                                {formatDate(item.created_at)}
                                            </span>
                                            {item.options?.model && (
                                                <span className="rounded-sm border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                                    {item.options.model.split('-')[0]}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-2 top-2 size-6 opacity-0 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete video?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently remove &quot;
                                                {item.prompt.length > 30
                                                    ? item.prompt.substring(0, 30) + '...'
                                                    : item.prompt}
                                                &quot; from your history.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => {
                                                    onDelete(item.video_id);
                                                }}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
