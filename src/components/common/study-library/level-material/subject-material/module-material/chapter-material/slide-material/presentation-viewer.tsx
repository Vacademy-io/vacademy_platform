import type React from "react";
import { useEffect } from "react";
import { FileX } from "@phosphor-icons/react";
import { ExcalidrawViewer } from "./ExcalidrawViewer";
import { useAddDocumentActivity } from '../../../../../../../../services/study-library/tracking-api/add-document-activity';
import { Slide } from '@/hooks/study-library/use-slides';

interface PresentationViewerProps {
  slide: Slide;
}

const PresentationViewer: React.FC<PresentationViewerProps> = ({ slide }) => {
  const { mutate: addActivity } = useAddDocumentActivity();

  // Get fileId from slide.document_slide.published_data
  const fileId = slide.document_slide?.published_data;

  // Track activity when component mounts
  useEffect(() => {
    if (fileId) {
      // addActivity({ fileId }); // Uncomment when ready to track
    }
  }, [fileId, addActivity]);

  // If fileId is undefined, show error state
  if (!fileId) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center space-y-4 p-8 max-w-md mx-auto">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <FileX size={32} weight="duotone" className="text-gray-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900">
              Presentation Not Available
            </h3>
            <p className="text-sm text-gray-600">
              The presentation content could not be loaded at this time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ExcalidrawViewer fileId={fileId} />
    </div>
  );
};

export default PresentationViewer;
