import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import type { PlanningLog } from '../-types/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Save, X, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { formatIntervalTypeId } from '../-utils/intervalTypeIdFormatter';
import { wrapContentInHTML, unwrapContentFromHTML } from '../-utils/templateLoader';
import TipTapEditor from '@/components/tiptap/TipTapEditor';
import { useState, useEffect } from 'react';
import { MyInput } from '@/components/design-system/input';
import { MyLabel } from '@/components/design-system/my-label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdatePlanningLog } from '../-services/updatePlanningLog';
import { getPublicUrl } from '@/services/upload_file';
import { usePlanningLogStore } from '../-stores/planning-log-store';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

export const Route = createLazyFileRoute('/planning/activity-logs/$logId')({
  component: ActivityLogDetailPage,
});

function ActivityLogDetailPage() {
  const navigate = useNavigate();
  const { setNavHeading } = useNavHeadingStore();
  const selectedLog = usePlanningLogStore((state) => state.selectedLog);
  const setSelectedLog = usePlanningLogStore((state) => state.setSelectedLog);
  const { instituteDetails } = useInstituteDetailsStore();

  const packageSessionOptions =
    instituteDetails?.batches_for_sessions?.map((batch) => ({
      label: `${batch.package_dto.package_name} - ${batch.level.level_name} - ${batch.session.session_name}`,
      value: batch.id,
    })) || [];

  const [log, setLog] = useState<PlanningLog | null>(selectedLog);
  const [courseName, setCourseName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedContent, setEditedContent] = useState('');

  useEffect(() => {
    setNavHeading(`Activity Log Details`);
  }, [setNavHeading]);

  const updateMutation = useUpdatePlanningLog();

  // Initialize edit state when log loads
  useEffect(() => {
    if (log) {
      setEditedTitle(log.title);
      setEditedDescription(log.description || '');
      setEditedContent(unwrapContentFromHTML(log.content_html));
      const courseName = packageSessionOptions.find(
        (option) => option.value === log.entity_id
      )?.label;
      setCourseName(courseName || '');
    }
  }, [log]);

  // If no log data, redirect back to list
  useEffect(() => {
    if (!log) {
      navigate({ to: '/planning/activity-logs', search: { packageSessionId: '' } });
    }
  }, [log, navigate]);

  const handleEdit = () => {
    if (log) {
      setEditedTitle(log.title);
      setEditedDescription(log.description || '');
      setEditedContent(unwrapContentFromHTML(log.content_html));
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!log) return;

    try {
      const wrappedContent = wrapContentInHTML(editedContent);
      await updateMutation.mutateAsync({
        logId: log.id,
        data: {
          title: editedTitle,
          description: editedDescription,
          content_html: wrappedContent,
        },
      });

      // Update local state with new values
      setLog({
        ...log,
        title: editedTitle,
        description: editedDescription,
        content_html: wrappedContent,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update activity log:', error);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const handleDownload = async (fileId: string) => {
    try {
      const url = await getPublicUrl(fileId);
      if (url) {
        // Open in new tab to download
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  if (!log) {
    return null; // Will redirect via useEffect
  }

  return (
    <LayoutContainer>
      <div className="space-y-2 p-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                navigate({
                  to: '/planning/activity-logs',
                  search: { packageSessionId: log.entity_id },
                })
              }
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {isEditing ? 'Edit Details' : 'View Details'}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline">
                  {formatIntervalTypeId(log.interval_type_id)}
                </Badge>
                <Badge
                  variant={log.status === 'ACTIVE' ? 'default' : 'destructive'}
                >
                  {log.status}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <MyButton
                  buttonType="secondary"
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </MyButton>
                <MyButton onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </MyButton>
              </>
            ) : (
              <MyButton onClick={handleEdit}>
                <Edit className="mr-2 h-4 w-4" />
                <span className="ml-2">Edit</span>
              </MyButton>
            )}
          </div>
        </div>
        <Separator />

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Created By:</span>{' '}
            <span className="text-muted-foreground">{log.created_by}</span>
          </div>
          <div>
            <span className="font-medium">
              {getTerminology(ContentTerms.Course, SystemTerms.Course)}:
            </span>{' '}
            <span className="capitalize text-muted-foreground">
              {courseName ?? 'Loading...'}
            </span>
          </div>
          <div>
            <span className="font-medium">Created:</span>{' '}
            <span className="text-muted-foreground">{formatDate(log.created_at)}</span>
          </div>
          <div>
            <span className="font-medium">Updated:</span>{' '}
            <span className="text-muted-foreground">{formatDate(log.updated_at)}</span>
          </div>
        </div>

        <Separator />

        {/* Content */}
        <div className="grid gap-6">
          {/* Title */}
          <div>
            {isEditing ? (
              <MyInput
                label="Title"
                required
                inputType="text"
                inputPlaceholder="Enter title"
                input={editedTitle}
                onChangeFunction={(e) => setEditedTitle(e.target.value)}
                className="w-full"
              />
            ) : (
              <>
                <MyLabel>Title</MyLabel>
                <p className="mt-1 text-lg font-medium">{log.title}</p>
              </>
            )}
          </div>

          {/* Description */}
          <div>
            {isEditing ? (
              <>
                <MyLabel>Description</MyLabel>
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Enter description (optional)"
                  rows={3}
                  className="mt-1"
                />
              </>
            ) : log.description ? (
              <>
                <MyLabel>Description</MyLabel>
                <p className="mt-1 text-muted-foreground">{log.description}</p>
              </>
            ) : null}
          </div>

          <Separator />

          {/* Content */}
          <div>
            <MyLabel required>Content</MyLabel>
            {isEditing ? (
              <div className="mt-2">
                <TipTapEditor
                  value={editedContent}
                  onChange={(html) => setEditedContent(html)}
                  placeholder="Enter content..."
                />
              </div>
            ) : (
              <div className="mt-2">
                <TipTapEditor
                  value={unwrapContentFromHTML(log.content_html)}
                  editable={false}
                  onChange={() => { }}
                />
              </div>
            )}
          </div>

          {/* Files */}
          {log.comma_separated_file_ids && (
            <>
              <Separator />
              <div>
                <MyLabel>Files</MyLabel>
                <div className="mt-2 space-y-2">
                  {log.comma_separated_file_ids
                    .split(',')
                    .filter(Boolean)
                    .map((fileId: string) => (
                      <div
                        key={fileId}
                        className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50"
                      >
                        <span className="text-sm font-medium">
                          {fileId}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(fileId)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </LayoutContainer>
  );
}
