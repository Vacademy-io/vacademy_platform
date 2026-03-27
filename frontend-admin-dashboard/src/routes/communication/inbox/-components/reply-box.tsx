import { useState, useCallback } from 'react';
import { PaperPlaneRight } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { sendReply } from '../-services/inbox-api';
import { useInboxStore } from '../-stores/inbox-store';
import { getInstituteId } from '@/constants/helper';

interface Props {
    phone: string;
}

export function ReplyBox({ phone }: Props) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const appendMessage = useInboxStore((s) => s.appendMessage);
    const updateConversationLastMessage = useInboxStore((s) => s.updateConversationLastMessage);

    const handleSend = useCallback(async () => {
        if (!text.trim() || sending) return;

        const instituteId = getInstituteId() || '';
        setSending(true);
        try {
            const sent = await sendReply(phone, text.trim(), instituteId);
            appendMessage(sent);
            updateConversationLastMessage(phone, text.trim(), 'OUTGOING');
            setText('');
        } catch (err) {
            console.error(err);
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    }, [text, phone, sending, appendMessage, updateConversationLastMessage]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="px-4 py-3 bg-white border-t flex items-end gap-2 shrink-0">
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-green-400 max-h-24"
                style={{ minHeight: '40px' }}
            />
            <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                className="p-2.5 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
                <PaperPlaneRight size={18} weight="fill" />
            </button>
        </div>
    );
}
