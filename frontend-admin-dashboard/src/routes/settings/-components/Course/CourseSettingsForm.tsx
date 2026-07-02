import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
    CopiedSlideStatus,
    CourseSettingsData,
    DripConditionsSettings,
    EnrollmentNotificationsSettings,
    OfferPricingSettings,
} from '@/types/course-settings';
import { BookOpen, Eye, Users, Save, Image, Play, List, Layers, RotateCcw } from 'lucide-react';
import { Bell } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Separator } from '@/components/ui/separator';
import { DripConditionsCard } from './DripConditionsCard';
import { OfferPricingCard } from './OfferPricingCard';

interface CourseSettingsFormProps {
    settings: CourseSettingsData;
    onSave: (settings: CourseSettingsData) => void;
    isSaving: boolean;
}

export const CourseSettingsForm: React.FC<CourseSettingsFormProps> = ({
    settings,
    onSave,
    isSaving,
}) => {
    const [formData, setFormData] = useState<CourseSettingsData>(settings);
    const [hasChanges, setHasChanges] = useState(false);

    // Update form data when settings prop changes
    useEffect(() => {
        setFormData(settings);
        setHasChanges(false);
    }, [settings]);

    // Check for changes when form data updates
    useEffect(() => {
        const changed = JSON.stringify(formData) !== JSON.stringify(settings);
        setHasChanges(changed);
    }, [formData, settings]);

    const handleSave = () => {
        onSave(formData);
        setHasChanges(false);
    };

    const resetAllToDefault = () => {
        setFormData(settings);
        setHasChanges(false);
    };

    const updateCourseInformation = (
        key: keyof typeof formData.courseInformation,
        value: boolean
    ) => {
        setFormData((prev) => ({
            ...prev,
            courseInformation: {
                ...prev.courseInformation,
                [key]: value,
            },
        }));
    };

    const updateCourseStructure = (
        key: keyof typeof formData.courseStructure,
        value: boolean | number
    ) => {
        setFormData((prev) => ({
            ...prev,
            courseStructure: {
                ...prev.courseStructure,
                [key]: value,
            },
        }));
    };

    const updateCatalogueSettings = (
        key: keyof typeof formData.catalogueSettings,
        value: boolean | string
    ) => {
        setFormData((prev) => ({
            ...prev,
            catalogueSettings: {
                ...prev.catalogueSettings,
                [key]: value,
            },
        }));
    };

    const updateCourseViewSettings = (
        key: keyof typeof formData.courseViewSettings,
        value: 'outline' | 'structure'
    ) => {
        setFormData((prev) => ({
            ...prev,
            courseViewSettings: {
                ...prev.courseViewSettings,
                [key]: value,
            },
        }));
    };

    const updateOutlineSettings = (
        key: keyof typeof formData.outlineSettings,
        value: 'expanded' | 'collapsed'
    ) => {
        setFormData((prev) => ({
            ...prev,
            outlineSettings: {
                ...prev.outlineSettings,
                [key]: value,
            },
        }));
    };

    const updateCopiedSlideStatus = (value: CopiedSlideStatus) => {
        setFormData((prev) => ({
            ...prev,
            copiedSlideStatus: value,
        }));
    };

    const updatePermissions = (
        key: keyof typeof formData.permissions,
        value: boolean | 'PARENTS_ONLY' | 'CHILDREN_ONLY' | null
    ) => {
        setFormData((prev) => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [key]: value,
            },
        }));
    };

    const updateDripConditions = (dripConditions: DripConditionsSettings) => {
        setFormData((prev) => ({
            ...prev,
            dripConditions,
        }));
    };

    const updateOfferPricing = (offerPricing: OfferPricingSettings) => {
        setFormData((prev) => ({
            ...prev,
            offerPricing,
        }));
    };

    const updateEnrollmentNotifications = (
        key: keyof EnrollmentNotificationsSettings,
        value: boolean
    ) => {
        setFormData((prev) => ({
            ...prev,
            enrollmentNotifications: {
                showNotifyLearners:
                    prev.enrollmentNotifications?.showNotifyLearners ?? true,
                showSendCredentials:
                    prev.enrollmentNotifications?.showSendCredentials ?? true,
                [key]: value,
            },
        }));
    };

    return (
        <div className="space-y-6 p-2">
            {/* Header with Save Button */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    {/* Empty div to maintain layout - title already shown in parent */}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={resetAllToDefault} disabled={isSaving}>
                        <RotateCcw className="mr-2 size-4" />
                        Reset All
                    </Button>
                    <MyButton
                        onClick={handleSave}
                        disabled={isSaving || !hasChanges}
                        className="bg-primary-500"
                    >
                        <Save className="mr-2 size-4" />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </MyButton>
                </div>
            </div>

            {/* Unsaved Changes Warning */}
            {hasChanges && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm text-amber-800">
                        You have unsaved changes. Don&apos;t forget to save your updates.
                    </p>
                </div>
            )}

            <div className="grid gap-6">
                {/* Course Information Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="size-5 text-blue-600" />
                            Course Information Requirements
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="description-required"
                                    className="flex items-center gap-2"
                                >
                                    <span>Description Required</span>
                                </Label>
                                <Switch
                                    id="description-required"
                                    checked={formData.courseInformation.descriptionRequired}
                                    onCheckedChange={(value) =>
                                        updateCourseInformation('descriptionRequired', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="popular-topics" className="flex items-center gap-2">
                                    <span>Enable Popular Topics</span>
                                </Label>
                                <Switch
                                    id="popular-topics"
                                    checked={formData.courseInformation.popularTopicsEnabled}
                                    onCheckedChange={(value) =>
                                        updateCourseInformation('popularTopicsEnabled', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="learner-outcomes"
                                    className="flex items-center gap-2"
                                >
                                    <span>Learner Outcomes Required</span>
                                </Label>
                                <Switch
                                    id="learner-outcomes"
                                    checked={formData.courseInformation.learnerOutcomesRequired}
                                    onCheckedChange={(value) =>
                                        updateCourseInformation('learnerOutcomesRequired', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="about-course" className="flex items-center gap-2">
                                    <span>About Course Required</span>
                                </Label>
                                <Switch
                                    id="about-course"
                                    checked={formData.courseInformation.aboutCourseRequired}
                                    onCheckedChange={(value) =>
                                        updateCourseInformation('aboutCourseRequired', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="target-audience"
                                    className="flex items-center gap-2"
                                >
                                    <span>Target Audience Required</span>
                                </Label>
                                <Switch
                                    id="target-audience"
                                    checked={formData.courseInformation.targetAudienceRequired}
                                    onCheckedChange={(value) =>
                                        updateCourseInformation('targetAudienceRequired', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="preview-image" className="flex items-center gap-2">
                                    <Image className="size-4" />
                                    <span>Preview Image Required</span>
                                </Label>
                                <Switch
                                    id="preview-image"
                                    checked={formData.courseInformation.previewImageRequired}
                                    onCheckedChange={(value) =>
                                        updateCourseInformation('previewImageRequired', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="banner-enabled" className="flex items-center gap-2">
                                    <Image className="size-4" />
                                    <span>Enable Banner Image</span>
                                </Label>
                                <Switch
                                    id="banner-enabled"
                                    checked={formData.courseInformation.bannerImageEnabled}
                                    onCheckedChange={(value) =>
                                        updateCourseInformation('bannerImageEnabled', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="banner-required"
                                    className="flex items-center gap-2"
                                >
                                    <Image className="size-4" />
                                    <span>Banner Image Required</span>
                                </Label>
                                <Switch
                                    id="banner-required"
                                    checked={formData.courseInformation.bannerImageRequired}
                                    onCheckedChange={(value) =>
                                        updateCourseInformation('bannerImageRequired', value)
                                    }
                                    disabled={!formData.courseInformation.bannerImageEnabled}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="course-media" className="flex items-center gap-2">
                                    <Play className="size-4" />
                                    <span>Enable Course Media</span>
                                </Label>
                                <Switch
                                    id="course-media"
                                    checked={formData.courseInformation.courseMediaEnabled}
                                    onCheckedChange={(value) =>
                                        updateCourseInformation('courseMediaEnabled', value)
                                    }
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Course Structure Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Layers className="size-5 text-green-600" />
                            Course Structure Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="default-depth">Default Course Depth</Label>
                                <Select
                                    value={formData.courseStructure.defaultDepth.toString()}
                                    onValueChange={(value) =>
                                        updateCourseStructure('defaultDepth', parseInt(value))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2">2 Levels</SelectItem>
                                        <SelectItem value="3">3 Levels</SelectItem>
                                        <SelectItem value="4">4 Levels</SelectItem>
                                        <SelectItem value="5">5 Levels</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="fix-depth" className="flex items-center gap-2">
                                    <span>Fix Course Depth</span>
                                </Label>
                                <Switch
                                    id="fix-depth"
                                    checked={formData.courseStructure.fixCourseDepth}
                                    onCheckedChange={(value) =>
                                        updateCourseStructure('fixCourseDepth', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="enable-sessions"
                                    className="flex items-center gap-2"
                                >
                                    <span>Enable Sessions</span>
                                </Label>
                                <Switch
                                    id="enable-sessions"
                                    checked={formData.courseStructure.enableSessions}
                                    onCheckedChange={(value) =>
                                        updateCourseStructure('enableSessions', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="enable-levels" className="flex items-center gap-2">
                                    <span>Enable Levels</span>
                                </Label>
                                <Switch
                                    id="enable-levels"
                                    checked={formData.courseStructure.enableLevels}
                                    onCheckedChange={(value) =>
                                        updateCourseStructure('enableLevels', value)
                                    }
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Catalogue Settings Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <List className="size-5 text-purple-600" />
                            Catalogue & Publishing Settings
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="catalogue-mode">Catalogue Mode</Label>
                                <Select
                                    value={formData.catalogueSettings.catalogueMode}
                                    onValueChange={(value) =>
                                        updateCatalogueSettings('catalogueMode', value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ask">Ask Before Publishing</SelectItem>
                                        <SelectItem value="auto">Auto Publish</SelectItem>
                                        <SelectItem value="manual">Manual Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="auto-publish" className="flex items-center gap-2">
                                    <span>Auto Publish to Catalogue</span>
                                </Label>
                                <Switch
                                    id="auto-publish"
                                    checked={formData.catalogueSettings.autoPublishToCatalogue}
                                    onCheckedChange={(value) =>
                                        updateCatalogueSettings('autoPublishToCatalogue', value)
                                    }
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* View Settings Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Eye className="size-5 text-orange-600" />
                            Course View & Display Settings
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="default-view">Default View Mode</Label>
                                <Select
                                    value={formData.courseViewSettings.defaultViewMode}
                                    onValueChange={(value) =>
                                        updateCourseViewSettings(
                                            'defaultViewMode',
                                            value as 'outline' | 'structure'
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="outline">Outline Mode</SelectItem>
                                        <SelectItem value="structure">
                                            Course Structure Mode
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="outline-state">Default Outline State</Label>
                                <Select
                                    value={formData.outlineSettings.defaultState}
                                    onValueChange={(value) =>
                                        updateOutlineSettings(
                                            'defaultState',
                                            value as 'expanded' | 'collapsed'
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="expanded">Expanded</SelectItem>
                                        <SelectItem value="collapsed">Collapsed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="copied-slide-status">
                                    Publish Status for Copied Slides
                                </Label>
                                <Select
                                    value={formData.copiedSlideStatus ?? 'KEEP_DRAFT'}
                                    onValueChange={(value) =>
                                        updateCopiedSlideStatus(value as CopiedSlideStatus)
                                    }
                                >
                                    <SelectTrigger id="copied-slide-status">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="KEEP_DRAFT">
                                            Keep as Draft (default)
                                        </SelectItem>
                                        <SelectItem value="INHERIT_SOURCE">
                                            Match the original slide
                                        </SelectItem>
                                        <SelectItem value="ALWAYS_PUBLISHED">
                                            Always publish
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-caption text-neutral-500">
                                    When a slide is copied to another course, choose whether the
                                    copy stays a draft, matches the original&apos;s published state,
                                    or is always published. Draft copies are not visible to learners.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Permissions Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="size-5 text-red-600" />
                            User Permissions & Access Control
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="learners-create"
                                    className="flex items-center gap-2"
                                >
                                    <span>Allow Learners to Create Courses</span>
                                </Label>
                                <Switch
                                    id="learners-create"
                                    checked={formData.permissions.allowLearnersToCreateCourses}
                                    onCheckedChange={(value) =>
                                        updatePermissions('allowLearnersToCreateCourses', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="payment-change" className="flex items-center gap-2">
                                    <span>Allow Payment Option Changes</span>
                                </Label>
                                <Switch
                                    id="payment-change"
                                    checked={formData.permissions.allowPaymentOptionChange}
                                    onCheckedChange={(value) =>
                                        updatePermissions('allowPaymentOptionChange', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="discount-change"
                                    className="flex items-center gap-2"
                                >
                                    <span>Allow Discount Option Changes</span>
                                </Label>
                                <Switch
                                    id="discount-change"
                                    checked={formData.permissions.allowDiscountOptionChange}
                                    onCheckedChange={(value) =>
                                        updatePermissions('allowDiscountOptionChange', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="referral-change"
                                    className="flex items-center gap-2"
                                >
                                    <span>Allow Referral Option Changes</span>
                                </Label>
                                <Switch
                                    id="referral-change"
                                    checked={formData.permissions.allowReferralOptionChange}
                                    onCheckedChange={(value) =>
                                        updatePermissions('allowReferralOptionChange', value)
                                    }
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label
                                    htmlFor="course-filter-type"
                                    className="flex items-center gap-2"
                                >
                                    <span>Default Course Filter (Explore Courses)</span>
                                </Label>
                                <Select
                                    value={
                                        formData.permissions.courseFilterType === 'PARENTS_ONLY' ||
                                        formData.permissions.courseFilterType === 'CHILDREN_ONLY'
                                            ? formData.permissions.courseFilterType
                                            : 'ALL'
                                    }
                                    onValueChange={(value) => {
                                        if (value === 'ALL') {
                                            updatePermissions('courseFilterType', null);
                                        } else {
                                            updatePermissions(
                                                'courseFilterType',
                                                value as 'PARENTS_ONLY' | 'CHILDREN_ONLY'
                                            );
                                        }
                                    }}
                                >
                                    <SelectTrigger id="course-filter-type" className="w-full max-w-xs">
                                        <SelectValue placeholder="Select default filter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Show all (no default filter)</SelectItem>
                                        <SelectItem value="PARENTS_ONLY">
                                            Only parent batches (PARENTS_ONLY)
                                        </SelectItem>
                                        <SelectItem value="CHILDREN_ONLY">
                                            Only child batches (CHILDREN_ONLY)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Controls whether Explore Courses shows only parent batches, only child
                                    batches, or all batches by default.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Drip Conditions Section */}
                <DripConditionsCard
                    settings={formData.dripConditions}
                    onUpdate={updateDripConditions}
                />

                {/* Offer Pricing Section */}
                <OfferPricingCard
                    settings={formData.offerPricing ?? { enabled: false }}
                    onUpdate={updateOfferPricing}
                />

                {/* Enrollment Notifications Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell size={20} weight="duotone" className="text-primary-500" />
                            Enrollment Notifications
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Controls which notification toggles admins see in the bulk enrollment
                            dialog. When a toggle is turned off here, the corresponding option is
                            hidden in the dialog AND forced to off in the API request — so no
                            emails go out by accident.
                        </p>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="show-notify-learners"
                                    className="flex items-center gap-2"
                                >
                                    <span>Show &ldquo;Notify Learners&rdquo; in bulk enroll</span>
                                </Label>
                                <Switch
                                    id="show-notify-learners"
                                    checked={
                                        formData.enrollmentNotifications?.showNotifyLearners ??
                                        true
                                    }
                                    onCheckedChange={(value) =>
                                        updateEnrollmentNotifications('showNotifyLearners', value)
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="show-send-credentials"
                                    className="flex items-center gap-2"
                                >
                                    <span>Show &ldquo;Send Credentials&rdquo; in bulk enroll</span>
                                </Label>
                                <Switch
                                    id="show-send-credentials"
                                    checked={
                                        formData.enrollmentNotifications?.showSendCredentials ??
                                        true
                                    }
                                    onCheckedChange={(value) =>
                                        updateEnrollmentNotifications(
                                            'showSendCredentials',
                                            value
                                        )
                                    }
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Separator />

            <div className="text-sm text-muted-foreground">
                <p>
                    <strong>Note:</strong> Changes will be applied across your entire institute once
                    saved. All course creation flows will use these updated settings.
                </p>
            </div>
        </div>
    );
};
