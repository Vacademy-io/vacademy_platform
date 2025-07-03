import { useState, useEffect } from "react";
import { ExternalLink, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

interface JupyterNotebookData {
  contentUrl: string;
  projectName: string;
  contentBranch: string;
  notebookLocation: string;
  activeTab: string;
  editorType: "jupyterEditor";
  timestamp: number;
}

interface JupyterNotebookSlideProps {
  published_data: string;
}

export const JupyterNotebookSlide: React.FC<JupyterNotebookSlideProps> = ({
  published_data,
}) => {
  const [notebookData, setNotebookData] = useState<JupyterNotebookData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const data = JSON.parse(published_data) as JupyterNotebookData;
      setNotebookData(data);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to parse Jupyter notebook data:", err);
      setError("Failed to load notebook configuration");
      setIsLoading(false);
    }
  }, [published_data]);

  const handleOpenInNewTab = () => {
    if (notebookData?.contentUrl) {
      window.open(notebookData.contentUrl, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
          <div className="text-neutral-500">Loading Jupyter Notebook...</div>
        </div>
      </div>
    );
  }

  if (error || !notebookData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-red-50 rounded-full p-4">
            <BookOpen size={32} className="text-red-500" />
          </div>
          <div className="text-red-500">
            {error || "Failed to load notebook"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-1">
      <Card className="h-screen flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 rounded-lg p-2">
                <BookOpen size={20} className="text-orange-600" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-neutral-900">
                  {notebookData.projectName}
                </h3>
                <p className="text-xs text-neutral-500">
                  Branch: {notebookData.contentBranch} • Location:{" "}
                  {notebookData.notebookLocation}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
                className="flex items-center gap-1.5"
              >
                <ExternalLink size={14} />
                Open in New Tab
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 relative">
          <iframe
            src={notebookData.contentUrl}
            title={notebookData.projectName}
            className="w-full h-full border-none rounded-b-lg"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            loading="lazy"
            onLoad={() => setIsLoading(false)}
            onError={() => setError("Failed to load notebook")}
          />

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-b-lg">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
                <div className="text-neutral-500">
                  Loading notebook interface...
                </div>
              </div>
            </div>
          )}

          {/* Footer overlay */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-neutral-200 bg-white/95 backdrop-blur-sm px-4 py-2 flex items-center justify-between text-xs text-neutral-500">
            <div className="flex items-center gap-4">
              <span>Type: Jupyter Notebook</span>
              <span>Active Tab: {notebookData.activeTab}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                Interactive
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
