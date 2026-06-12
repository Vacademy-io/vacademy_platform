import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChatsCircle } from '@phosphor-icons/react';
import { useDoubtTable } from '../../-hooks/useDoubtTable';
import { InboxList } from './inbox-list';
import { ConversationPane } from './conversation-pane';

/**
 * Split-pane "support inbox" for doubts/queries: list on the left, the selected doubt's full
 * conversation + inline reply on the right. Replaces the old table+dialog flow. On mobile it shows
 * the list, then swaps to the conversation (with a back button) when a doubt is selected.
 */
export const DoubtInbox = () => {
    const { doubts, currentPage, setCurrentPage, isLoading, error, refetch, userDetailsRecord } =
        useDoubtTable();
    const list = doubts?.content ?? [];
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Keep a valid selection: default to the first doubt; repoint/clear when the current selection
    // disappears after a refetch, filter change, or page change.
    useEffect(() => {
        if (list.length === 0) {
            if (selectedId !== null) setSelectedId(null);
            return;
        }
        if (!selectedId || !list.some((d) => d.id === selectedId)) {
            setSelectedId(list[0]!.id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doubts]);

    const selected = list.find((d) => d.id === selectedId) ?? null;

    return (
        <div className="flex h-[calc(100dvh-13rem)] min-h-0 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"> {/* design-lint-ignore: viewport-relative inbox height has no spacing token */}
            <div
                className={cn(
                    'flex w-full flex-col border-r border-neutral-200 sm:w-80 sm:shrink-0',
                    selected && 'hidden sm:flex'
                )}
            >
                <InboxList
                    list={list}
                    isLoading={isLoading}
                    error={error}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    userDetailsRecord={userDetailsRecord}
                    page={doubts}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                />
            </div>
            <div className={cn('min-w-0 flex-1 flex-col', selected ? 'flex' : 'hidden sm:flex')}>
                {selected ? (
                    <ConversationPane
                        doubt={selected}
                        refetch={refetch}
                        learnerName={userDetailsRecord[selected.user_id]?.name}
                        onBack={() => setSelectedId(null)}
                    />
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-neutral-400">
                        <ChatsCircle size={40} weight="duotone" className="text-neutral-300" />
                        <p className="text-sm">Select a doubt to view the conversation</p>
                    </div>
                )}
            </div>
        </div>
    );
};
