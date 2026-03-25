import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { TagInput } from '@/components/ui/tag-input';
import { Image as ImageIcon } from 'lucide-react';

interface CourseMetadata {
    courseName?: string;
    courseDescription?: string;
    mediaImageUrl?: string;
    tags?: string[];
    [key: string]: any;
}

interface MetadataDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    metadata: CourseMetadata | null;
    onSave: (metadata: CourseMetadata) => void;
}

export const MetadataDialog: React.FC<MetadataDialogProps> = ({
    open,
    onOpenChange,
    metadata,
    onSave,
}) => {
    const [courseName, setCourseName] = useState('');
    const [courseDescription, setCourseDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);

    useEffect(() => {
        if (metadata) {
            setCourseName(metadata.courseName || '');
            setCourseDescription(metadata.courseDescription || '');
            setTags(metadata.tags || []);
        }
    }, [metadata, open]);

    const handleSave = () => {
        onSave({
            ...metadata,
            courseName,
            courseDescription,
            tags,
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-lg max-h-[90vh] flex flex-col p-0 sm:p-6">
                <DialogHeader>
                    <DialogTitle>Course Details</DialogTitle>
                    <DialogDescription>
                        Edit your course metadata
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-4">
                    {/* Course Thumbnail Preview */}
                    {metadata?.mediaImageUrl && (
                        <div>
                            <Label className="mb-2 block">Course Thumbnail</Label>
                            <div className="relative aspect-video rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200">
                                <img
                                    src={metadata.mediaImageUrl}
                                    alt="Course thumbnail"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>
                    )}

                    {/* Course Name */}
                    <div>
                        <Label htmlFor="courseName" className="mb-2 block">
                            Course Name
                        </Label>
                        <Input
                            id="courseName"
                            value={courseName}
                            onChange={(e) => setCourseName(e.target.value)}
                            placeholder="Enter course name"
                        />
                    </div>

                    {/* Course Description */}
                    <div>
                        <Label htmlFor="courseDescription" className="mb-2 block">
                            Course Description
                        </Label>
                        <Textarea
                            id="courseDescription"
                            value={courseDescription}
                            onChange={(e) => setCourseDescription(e.target.value)}
                            placeholder="Enter course description"
                            className="min-h-[100px]"
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <Label className="mb-2 block">Tags</Label>
                        <TagInput
                            tags={tags}
                            onChange={setTags}
                            placeholder="Add tags..."
                        />
                    </div>
                </div>

                <DialogFooter>
                    <MyButton buttonType="secondary" onClick={() => onOpenChange(false)}>
                        Cancel
                    </MyButton>
                    <MyButton buttonType="primary" onClick={handleSave}>
                        Save Changes
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
