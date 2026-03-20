import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, MessageCircle, Eye, Smartphone, Tablet, Monitor } from 'lucide-react';
import { MessageTemplate } from '@/types/message-template-types';

interface TemplatePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  template: MessageTemplate | null;
  onUseTemplate?: (template: MessageTemplate) => void;
  isSending?: boolean;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  isOpen,
  onClose,
  template,
  onUseTemplate,
  isSending = false,
}) => {
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'laptop'>('laptop');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [previewWidth, setPreviewWidth] = useState(1024);

  const DEVICE_PRESETS: Record<typeof previewDevice, { label: string; width: number }> = {
    mobile: { label: 'Mobile', width: 390 },
    tablet: { label: 'Tablet', width: 768 },
    laptop: { label: 'Laptop', width: 1024 },
  };

  // Update window width on resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update preview width when device or window width changes
  useEffect(() => {
    const deviceWidth = DEVICE_PRESETS[previewDevice].width;
    const availableWidth = windowWidth - 120; // Account for padding and margins
    setPreviewWidth(Math.min(deviceWidth, availableWidth));
  }, [previewDevice, windowWidth]);

  if (!template) return null;


  const getIcon = () => {
    return template.type === 'EMAIL' ? (
      <FileText className="size-5" />
    ) : (
      <MessageCircle className="size-5" />
    );
  };

  const getTemplateTypeLabel = () => {
    return template.type === 'EMAIL' ? 'Email' : 'WhatsApp';
  };

  const handleUseTemplate = () => {
    if (onUseTemplate) {
      onUseTemplate(template);
    }
  };

  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '');
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-6xl min-w-[320px] h-[90vh] p-0 flex flex-col sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] 2xl:max-w-6xl">
        <DialogHeader className="shrink-0 px-4 py-4 sm:px-6 border-b border-gray-200">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Eye className="size-4 sm:size-5" />
            {getTemplateTypeLabel()} Preview
          </DialogTitle>
          <div className="mt-3 flex flex-wrap items-center gap-1 sm:gap-2 md:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewDevice('mobile')}
              className={`flex items-center gap-1 sm:gap-2 transition-all rounded-none border-0 border-b-2 text-xs sm:text-sm ${
                previewDevice === 'mobile'
                  ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                  : 'border-transparent hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Smartphone className="size-3 sm:size-4" />
              <span className="hidden xs:inline">Mobile</span>
              <span className="xs:hidden">M</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewDevice('tablet')}
              className={`flex items-center gap-1 sm:gap-2 transition-all rounded-none border-0 border-b-2 text-xs sm:text-sm ${
                previewDevice === 'tablet'
                  ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                  : 'border-transparent hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Tablet className="size-3 sm:size-4" />
              <span className="hidden xs:inline">Tablet</span>
              <span className="xs:hidden">T</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewDevice('laptop')}
              className={`flex items-center gap-1 sm:gap-2 transition-all rounded-none border-0 border-b-2 text-xs sm:text-sm ${
                previewDevice === 'laptop'
                  ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                  : 'border-transparent hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Monitor className="size-3 sm:size-4" />
              <span className="hidden xs:inline">Laptop</span>
              <span className="xs:hidden">L</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 preview-modal-content scrollbar-hide">
          <div className="flex justify-center">
            <div
              className="border border-gray-300 bg-white rounded-lg overflow-hidden preview-device-frame"
              style={{
                width: `${previewWidth}px`,
                maxWidth: '100%',
              }}
            >
              <div className="border-b bg-gray-50 px-3 py-2 sm:px-4 sm:py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-red-500"></div>
                      <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-yellow-500"></div>
                      <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-gray-700">
                      {DEVICE_PRESETS[previewDevice].label} Preview
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 hidden sm:block">
                    {previewWidth}px
                  </div>
                </div>
              </div>
              <div className="p-3 sm:p-4 md:p-6 min-h-[150px] sm:min-h-[200px]">
                {template.subject && (
                  <div className="mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-gray-200">
                    <div className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Subject:</div>
                    <div className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 break-words">
                      {template.subject}
                    </div>
                  </div>
                )}
                {template.content ? (
                  template.type === 'EMAIL' ? (
                    <div
                      className="prose prose-xs sm:prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: template.content }}
                    />
                  ) : (
                    <div className="text-xs sm:text-sm text-gray-900 whitespace-pre-wrap break-words">
                      {stripHtml(template.content)}
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-24 sm:h-32 text-gray-500 text-xs sm:text-sm">
                    No content to preview
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isSending}
                className="text-xs sm:text-sm px-3 sm:px-4 py-2"
              >
                Cancel
              </Button>
              {onUseTemplate && (
                <Button
                  onClick={handleUseTemplate}
                  disabled={isSending}
                  className="bg-primary-500 hover:bg-primary-600 text-white text-xs sm:text-sm px-3 sm:px-4 py-2"
                >
                  {isSending ? 'Sending...' : 'Use Template'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplatePreview;
