import React, { useState } from 'react';
import { Pin, Clock, User, X, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useDashboardPins } from '@/hooks/useDashboardPins';
import { formatDistanceToNow } from 'date-fns';
import { processHtmlString } from '@/lib/utils';
import type { UserMessage } from '@/types/announcement';
import { announcementApi } from '@/services/announcementApi';

interface DashboardPinsPanelProps {
  className?: string;
  maxPins?: number;
}

export const DashboardPinsPanel: React.FC<DashboardPinsPanelProps> = ({ 
  className = '',
  maxPins = 3 
}) => {
  const {
    pins,
    loading,
    error,
    isEnabled,
    isLoadingSettings,
    markAsRead,
    refresh,
  } = useDashboardPins({
    enablePolling: true,
    pollingInterval: 15000,
    autoMarkAsRead: true,
  });

  const [selectedPin, setSelectedPin] = useState<UserMessage | null>(null);
  const [showFullContent, setShowFullContent] = useState(false);

  const handlePinClick = (pin: UserMessage) => {
    setSelectedPin(pin);
    setShowFullContent(true);
    markAsRead(pin.messageId);
    // Track click interaction
    announcementApi.recordInteraction(pin.messageId, 'CLICKED', { source: 'DashboardPinsPanel' }).catch(() => undefined);
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
        return 'High';
      case 'MEDIUM':
        return 'Medium';
      case 'LOW':
        return 'Low';
      default:
        return 'Normal';
    }
  };

  const renderPinContent = (pin: UserMessage) => {
    if (pin.content.type === 'html') {
      return (
        <div 
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: processHtmlString(pin.content.content) }}
        />
      );
    }
    
    return <p className="text-sm text-gray-700">{pin.content.content}</p>;
  };

  const getTimeRemaining = (endTime?: string) => {
    if (!endTime) return null;
    
    const now = new Date();
    const end = new Date(endTime);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} left`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} left`;
    } else {
      return 'Less than 1 hour left';
    }
  };

  // Don't render if not enabled or still loading settings
  if (isLoadingSettings || !isEnabled) {
    return null;
  }

  // Don't render if no pins
  if (!loading && pins.length === 0) {
    return null;
  }

  const displayPins = pins.slice(0, maxPins);

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pin className="h-5 w-5 text-blue-600" />
              Important Updates
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
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 mb-4 p-3 bg-red-50 rounded-md">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading pins...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {displayPins.map((pin) => (
                <div
                  key={pin.messageId}
                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    !pin.isRead ? 'border-l-4 border-l-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                  onClick={() => handlePinClick(pin)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {pin.title && (
                        <h4 className="font-medium text-gray-900">{pin.title}</h4>
                      )}
                      {pin.priority && (
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getPriorityColor(pin.priority)} text-white`}
                        >
                          {getPriorityText(pin.priority)}
                        </Badge>
                      )}
                      {!pin.isRead && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {renderPinContent(pin)}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      {pin.createdByName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {pin.createdByName}
                        </span>
                      )}
                      {pin.createdAt && (
                        <span>{formatDistanceToNow(new Date(pin.createdAt), { addSuffix: true })}</span>
                      )}
                    </div>
                    
                    {pin.pinEndTime && (
                      <span className="flex items-center gap-1 text-orange-600">
                        <Clock className="h-3 w-3" />
                        {getTimeRemaining(pin.pinEndTime)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              
              {pins.length > maxPins && (
                <div className="text-center pt-2">
                  <Button variant="outline" size="sm">
                    View All ({pins.length} total)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Full Content Modal */}
      {selectedPin && showFullContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {selectedPin.title && (
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                      {selectedPin.title}
                    </h2>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {selectedPin.priority && (
                      <Badge variant="secondary" className={getPriorityColor(selectedPin.priority)}>
                        {getPriorityText(selectedPin.priority)}
                      </Badge>
                    )}
                    {selectedPin.createdByName && <span>By {selectedPin.createdByName}</span>}
                    {selectedPin.createdAt && (
                      <span>{formatDistanceToNow(new Date(selectedPin.createdAt), { addSuffix: true })}</span>
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
                {renderPinContent(selectedPin)}
              </div>
              
              {selectedPin.pinEndTime && (
                <div className="mt-4 p-3 bg-orange-50 rounded-md">
                  <div className="flex items-center gap-2 text-sm text-orange-700">
                    <Clock className="h-4 w-4" />
                    <span>This pin expires {getTimeRemaining(selectedPin.pinEndTime)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
