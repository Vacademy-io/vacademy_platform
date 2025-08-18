import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Send, User, Clock, AlertCircle, Info } from 'lucide-react';
import { usePackageSessionMessages } from '@/hooks/usePackageSessionMessages';
import { formatDistanceToNow } from 'date-fns';
import { processHtmlString } from '@/lib/utils';
import type { UserMessage } from '@/types/announcement';

interface PackageSessionMessagesProps {
  packageSessionId: string;
  className?: string;
}

export const PackageSessionMessages: React.FC<PackageSessionMessagesProps> = ({
  packageSessionId,
  className = '',
}) => {
  const {
    stream,
    loading,
    isEnabled,
    isLoadingSettings,
    markAsRead,
    handleMessageVisibility,
    loadMoreStreamMessages,
    fetchReplies,
    postReply,
    refresh,
  } = usePackageSessionMessages({
    packageSessionId,
    enablePolling: true,
    pollingInterval: 15000,
    autoMarkAsRead: true,
    markAsReadDelay: 1000,
  });

  const [selectedMessage, setSelectedMessage] = useState<UserMessage | null>(null);
  const [showReplies, setShowReplies] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isPostingReply, setIsPostingReply] = useState(false);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Intersection observer for auto mark-as-read
  useEffect(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const messageId = entry.target.getAttribute('data-message-id');
            if (messageId) {
              handleMessageVisibility(messageId, 'STREAM', entry.isIntersecting);
            }
          });
        },
        { threshold: 0.5, rootMargin: '50px' }
      );
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleMessageVisibility]);

  // Observe message elements
  useEffect(() => {
    stream.items.forEach((message) => {
      const element = messageRefs.current.get(message.messageId);
      if (element && observerRef.current) {
        observerRef.current.observe(element);
      }
    });
  }, [stream.items]);

  const handleMessageClick = (message: UserMessage) => {
    setSelectedMessage(message);
    setShowReplies(true);
    markAsRead(message.messageId, 'STREAM');
  };

  const handlePostReply = async () => {
    if (!selectedMessage || !replyContent.trim()) return;

    setIsPostingReply(true);
    try {
      await postReply(selectedMessage.announcementId, replyContent.trim());
      setReplyContent('');
      // Refresh replies
      await fetchReplies(selectedMessage.announcementId, { page: 0, size: 20 });
    } catch (error) {
      console.error('Failed to post reply:', error);
    } finally {
      setIsPostingReply(false);
    }
  };

  const renderMessageContent = (message: UserMessage) => {
    if (message.content.type === 'html') {
      return (
        <div 
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: processHtmlString(message.content.content) }}
        />
      );
    }
    
    return <p className="text-sm text-gray-700">{message.content.content}</p>;
  };

  const renderMessageCard = (message: UserMessage, modeType: 'STREAM' | 'COMMUNITY') => (
    <Card 
      key={message.messageId}
      className={`mb-4 cursor-pointer transition-all hover:shadow-md ${
        !message.isRead ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''
      }`}
      ref={(el) => {
        if (el) {
          messageRefs.current.set(message.messageId, el);
        }
      }}
      data-message-id={message.messageId}
      data-mode-type={modeType}
      onClick={() => handleMessageClick(message)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {message.title && (
              <h4 className="font-medium text-gray-900">{message.title}</h4>
            )}
            {message.streamType && (
              <Badge variant="outline" className="text-xs">
                {message.streamType}
              </Badge>
            )}
            {message.communityType && (
              <Badge variant="outline" className="text-xs">
                {message.communityType}
              </Badge>
            )}
            {message.tag && (
              <Badge variant="secondary" className="text-xs">
                {message.tag}
              </Badge>
            )}
            {!message.isRead && (
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </div>
        </div>
        
        <div className="text-sm text-gray-600 mb-3">
          {renderMessageContent(message)}
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            {message.createdByName && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {message.createdByName}
              </span>
            )}
            {message.createdAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
              </span>
            )}
          </div>
          
          {message.repliesCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {message.repliesCount} {message.repliesCount === 1 ? 'reply' : 'replies'}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderRepliesSection = () => {
    if (!selectedMessage) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Discussion</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReplies(false)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="flex flex-col h-[calc(90vh-120px)]">
              {/* Original Message */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                {renderMessageCard(selectedMessage, selectedMessage.modeType as 'STREAM' | 'COMMUNITY')}
              </div>
              
              {/* Replies */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {/* Reply Composer */}
                  <div className="border rounded-lg p-3">
                    <Textarea
                      placeholder="Write a reply..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="min-h-[80px] resize-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Info className="h-3 w-3" />
                        <span>Your reply will be visible to all participants</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={handlePostReply}
                        disabled={!replyContent.trim() || isPostingReply}
                      >
                        {isPostingReply ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Posting...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Post Reply
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Replies List */}
                  <div className="space-y-3">
                    {/* TODO: Implement replies list */}
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p>Replies will appear here</p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Don't render if not enabled or still loading settings
  if (isLoadingSettings || !isEnabled) {
    return null;
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Course Discussion
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          
          {stream.error && (
            <div className="flex items-center gap-2 text-sm text-red-600 mb-4 p-3 bg-red-50 rounded-md">
              <AlertCircle className="h-4 w-4" />
              {stream.error}
            </div>
          )}
          
          {stream.loading && stream.items.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading stream messages...</span>
            </div>
          ) : stream.items.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No stream messages</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stream.items.map((message) => renderMessageCard(message, 'STREAM'))}
              
              {stream.hasMore && (
                <div className="text-center pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreStreamMessages}
                    disabled={stream.loading}
                  >
                    {stream.loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Replies Modal */}
      {showReplies && renderRepliesSection()}
    </div>
  );
};
