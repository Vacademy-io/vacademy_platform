import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useSystemAlerts } from '@/hooks/useSystemAlerts';
import { formatDistanceToNow } from 'date-fns';
import { processHtmlString } from '@/lib/utils';
import type { UserMessage } from '@/types/announcement';

interface SystemAlertsBarProps {
  className?: string;
}

export const SystemAlertsBar: React.FC<SystemAlertsBarProps> = ({ className = '' }) => {
  const {
    alerts,
    unreadCount,
    loading,
    error,
    hasMore,
    isEnabled,
    isLoadingSettings,
    markAsRead,
    dismiss,
    loadMore,
    refresh,
    handleAlertVisibility,
  } = useSystemAlerts({
    enablePolling: true,
    pollingInterval: 15000,
    autoMarkAsRead: true,
    markAsReadDelay: 1000,
  });

  const [isOpen, setIsOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<UserMessage | null>(null);
  const [showFullContent, setShowFullContent] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const alertRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Intersection observer for auto mark-as-read
  useEffect(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const messageId = entry.target.getAttribute('data-message-id');
            if (messageId) {
              handleAlertVisibility(messageId, entry.isIntersecting);
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
  }, [handleAlertVisibility]);

  // Observe alert elements
  useEffect(() => {
    alertRefs.current.forEach((element) => {
      if (observerRef.current) {
        observerRef.current.observe(element);
      }
    });
  }, [alerts]);

  const handleAlertClick = (alert: UserMessage) => {
    setSelectedAlert(alert);
    setShowFullContent(true);
    markAsRead(alert.messageId);
  };

  const handleDismiss = async (messageId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    await dismiss(messageId);
  };

  const handleLoadMore = () => {
    loadMore();
  };

  const handleRefresh = () => {
    refresh();
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      case 'LOW':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPriorityText = (priority?: string) => {
    switch (priority) {
      case 'HIGH':
        return 'High Priority';
      case 'MEDIUM':
        return 'Medium Priority';
      case 'LOW':
        return 'Low Priority';
      default:
        return 'Normal Priority';
    }
  };

  const renderAlertContent = (alert: UserMessage) => {
    if (alert.content.type === 'html') {
      return (
        <div 
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: processHtmlString(alert.content.content) }}
        />
      );
    }
    
    return <p className="text-sm text-gray-700">{alert.content.content}</p>;
  };

  const renderAlertCard = (alert: UserMessage) => (
    <Card 
      key={alert.messageId}
      className={`mb-3 cursor-pointer transition-all hover:shadow-md ${
        !alert.isRead ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''
      }`}
      ref={(el) => {
        if (el) {
          alertRefs.current.set(alert.messageId, el);
        }
      }}
      data-message-id={alert.messageId}
      onClick={() => handleAlertClick(alert)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {alert.title && (
                <h4 className="font-medium text-gray-900 truncate">{alert.title}</h4>
              )}
              {alert.priority && (
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${getPriorityColor(alert.priority)} text-white`}
                >
                  {getPriorityText(alert.priority)}
                </Badge>
              )}
              {!alert.isRead && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </div>
            
            <div className="text-sm text-gray-600 mb-2">
              {renderAlertContent(alert)}
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {alert.createdByName && `By ${alert.createdByName}`}
                {alert.createdByName && alert.createdAt && ' • '}
                {alert.createdAt && formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-6 w-6 p-0 hover:bg-gray-100"
            onClick={(e) => handleDismiss(alert.messageId, e)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Don't render if not enabled or still loading settings
  if (isLoadingSettings || !isEnabled) {
    return null;
  }

  return (
    <div className={className}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
            {isOpen ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent 
          align="end" 
          className="w-96 max-h-96 p-0"
          sideOffset={8}
        >
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">System Alerts</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                </Button>
              </div>
            </div>
          </div>
          
          <ScrollArea className="h-80">
            <div className="p-4">
              {error && (
                <div className="text-sm text-red-600 mb-4 p-3 bg-red-50 rounded-md">
                  {error}
                </div>
              )}
              
              {loading && alerts.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading alerts...</span>
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No system alerts</p>
                </div>
              ) : (
                <>
                  {alerts.map(renderAlertCard)}
                  
                  {hasMore && (
                    <div className="text-center pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        disabled={loading}
                      >
                        {loading ? (
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
                </>
              )}
            </div>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Full Content Modal */}
      {selectedAlert && showFullContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {selectedAlert.title && (
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                      {selectedAlert.title}
                    </h2>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {selectedAlert.priority && (
                      <Badge variant="secondary" className={getPriorityColor(selectedAlert.priority)}>
                        {getPriorityText(selectedAlert.priority)}
                      </Badge>
                    )}
                    {selectedAlert.createdByName && <span>By {selectedAlert.createdByName}</span>}
                    {selectedAlert.createdAt && (
                      <span>{formatDistanceToNow(new Date(selectedAlert.createdAt), { addSuffix: true })}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullContent(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <Separator className="mb-4" />
              
              <div className="prose prose-sm max-w-none">
                {renderAlertContent(selectedAlert)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
