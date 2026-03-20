import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useSuspenseQuery, useMutation } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MyDropdown } from '@/components/design-system/dropdown';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { handleFetchEnquiriesList } from '../../enquiries/-services/get-enquiries-list';
import {
    SubmitEnquiryRequest,
    submitEnquiryWithLead,
} from '../../enquiries/-services/submit-enquiry';
import { MyButton } from '@/components/design-system/button';
import { useUserAutosuggestDebounced, USER_ROLES } from '@/services/user-autosuggest';
import CustomEnquiryFieldsCard from '../-components/CustomEnquiryFieldsCard';

export const Route = createFileRoute('/admissions/new-enquiry/$audienceId/')({
    component: RouteComponent,
});

function NewEnquiryForm() {
    const { audienceId } = Route.useParams();
    const navigate = useNavigate();
    const { data: instituteData } = useSuspenseQuery(useInstituteQuery());
    const { instituteDetails } = useInstituteDetailsStore();

    // Fetch campaign details
    const { data: enquiriesData } = useSuspenseQuery(
        handleFetchEnquiriesList({
            institute_id: instituteData?.id || '',
            page: 0,
            size: 100,
        })
    );

    const campaign = enquiriesData?.content?.find((c) => c.id === audienceId);

    // Get package sessions for dropdown
    const packageSessionOptions =
        instituteDetails?.batches_for_sessions.map((batch) => ({
            id: batch.id,
            label: `${batch.package_dto.package_name} ${batch.level.level_name}`,
        })) || [];

    // Form state
    const [formData, setFormData] = useState({
        // Child (Student) info - only name, DOB, gender
        childFullName: '',
        childDOB: '',
        childGender: '',
        // Parent info - full details including address
        parentName: '',
        parentEmail: '',
        parentMobile: '',
        parentAddress: '',
        parentCity: '',
        parentRegion: '',
        parentPinCode: '',
        // Package session
        packageSessionId: '',
        // Enquiry details
        enquiryStatus: 'NEW',
        notes: '',
        sourceType: 'WEBSITE',
        referenceSource: '',
        feeExpectation: '',
        transportRequirement: '',
        mode: 'OFFLINE' as 'ONLINE' | 'OFFLINE',
        counsellorId: '',
        // Custom fields
        customFieldValues: {} as Record<string, string>,
    });

    // Counsellor autosuggest state
    const [counsellorSearchQuery, setCounsellorSearchQuery] = useState('');
    const [selectedCounsellor, setSelectedCounsellor] = useState<{
        id: string;
        full_name: string;
    } | null>(null);

    // Fetch counsellors with debounced search
    const { data: counsellors, isLoading: isLoadingCounsellors } = useUserAutosuggestDebounced(
        counsellorSearchQuery,
        [USER_ROLES.ADMIN],
        300
    );

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Submit mutation
    const submitMutation = useMutation({
        mutationFn: submitEnquiryWithLead,
        onSuccess: (data) => {
            toast.success('Enquiry submitted successfully!', {
                description: `Enquiry ID: ${data.enquiry_id}`,
            });
            setTimeout(() => {
                navigate({ to: '/admissions/enquiries' });
            }, 1500);
        },
        onError: (error: Error) => {
            toast.error('Failed to submit enquiry', {
                description: error.message,
            });
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.parentEmail) {
            toast.error('Parent email is required');
            return;
        }
        if (!formData.childFullName) {
            toast.error('Child name is required');
            return;
        }

        setIsSubmitting(true);

        const payload: SubmitEnquiryRequest = {
            audience_id: audienceId,
            source_type: formData.sourceType || 'WEBSITE',
            destination_package_session_id: formData.packageSessionId || undefined,
            // Auto-fill parent_name, parent_email, parent_mobile from parent details
            parent_name: formData.parentName || undefined,
            parent_email: formData.parentEmail || undefined,
            parent_mobile: formData.parentMobile || undefined,
            counsellor_id: formData.counsellorId || undefined,
            // Parent user DTO with full details
            parent_user_dto: {
                full_name: formData.parentName || undefined,
                email: formData.parentEmail || undefined,
                mobile_number: formData.parentMobile || undefined,
                address_line: formData.parentAddress || undefined,
                city: formData.parentCity || undefined,
                region: formData.parentRegion || undefined,
                pin_code: formData.parentPinCode || undefined,
                is_parent: true,
                root_user: true,
            },
            // Child user DTO - only name, DOB, gender, copy address from parent
            child_user_dto: {
                full_name: formData.childFullName || undefined,
                date_of_birth: formData.childDOB || undefined,
                gender: formData.childGender as 'MALE' | 'FEMALE' | 'OTHER' | undefined,
                // Copy address fields from parent
                address_line: formData.parentAddress || undefined,
                city: formData.parentCity || undefined,
                region: formData.parentRegion || undefined,
                pin_code: formData.parentPinCode || undefined,
                is_parent: false,
                root_user: false,
            },
            custom_field_values: formData.customFieldValues,
            enquiry: {
                enquiry_status: formData.enquiryStatus as any,
                notes: formData.notes || undefined,
                reference_source: formData.referenceSource || undefined,
                fee_range_expectation: formData.feeExpectation || undefined,
                transport_requirement: formData.transportRequirement || undefined,
                mode: formData.mode || undefined,
            },
        };

        try {
            await submitMutation.mutateAsync(payload);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCustomFieldChange = (fieldId: string, value: string) => {
        setFormData({
            ...formData,
            customFieldValues: {
                ...formData.customFieldValues,
                [fieldId]: value,
            },
        });
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Add New Enquiry</h1>
                    <p className="text-sm text-muted-foreground">
                        Session: {campaign?.campaign_name || 'Unknown'}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Student (Child) Information - Simplified */}
                <Card className="mb-4">
                    <CardHeader>
                        <CardTitle>Student Information</CardTitle>
                        <CardDescription>Enter the student's basic details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                                <Label htmlFor="childFullName">
                                    Full Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="childFullName"
                                    value={formData.childFullName}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            childFullName: e.target.value,
                                        })
                                    }
                                    placeholder="Enter student's full name"
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="childDOB">Date of Birth</Label>
                                <Input
                                    id="childDOB"
                                    type="date"
                                    value={formData.childDOB}
                                    onChange={(e) =>
                                        setFormData({ ...formData, childDOB: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <Label htmlFor="childGender">Gender</Label>
                                <Select
                                    value={formData.childGender}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, childGender: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MALE">Male</SelectItem>
                                        <SelectItem value="FEMALE">Female</SelectItem>
                                        <SelectItem value="OTHER">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Class/Package Selection */}
                {packageSessionOptions.length > 0 && (
                    <Card className="mb-4">
                        <CardHeader>
                            <CardTitle>Class</CardTitle>
                            <CardDescription>Select the class for this enquiry</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Label htmlFor="packageSession">Class</Label>
                            <MyDropdown
                                currentValue={
                                    packageSessionOptions.find(
                                        (opt) => opt.id === formData.packageSessionId
                                    )?.label || ''
                                }
                                handleChange={(value) => {
                                    const selected = packageSessionOptions.find(
                                        (opt) => opt.label === value
                                    );
                                    setFormData({
                                        ...formData,
                                        packageSessionId: selected?.id || '',
                                    });
                                }}
                                dropdownList={packageSessionOptions.map((opt) => opt.label)}
                                placeholder="Select class"
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Parent/Guardian Information - Full Details with Address */}
                <Card className="mb-4">
                    <CardHeader>
                        <CardTitle>Parent/Guardian Information</CardTitle>
                        <CardDescription>
                            Parent details (address will be used for student too)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                                <Label htmlFor="parentName">
                                    Parent Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="parentName"
                                    value={formData.parentName}
                                    onChange={(e) =>
                                        setFormData({ ...formData, parentName: e.target.value })
                                    }
                                    placeholder="Enter parent name"
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="parentEmail">
                                    Parent Email <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="parentEmail"
                                    type="email"
                                    value={formData.parentEmail}
                                    onChange={(e) =>
                                        setFormData({ ...formData, parentEmail: e.target.value })
                                    }
                                    placeholder="Enter parent email"
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="parentMobile">
                                    Parent Mobile <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="parentMobile"
                                    value={formData.parentMobile}
                                    onChange={(e) =>
                                        setFormData({ ...formData, parentMobile: e.target.value })
                                    }
                                    placeholder="Enter parent mobile"
                                    required
                                />
                            </div>
                        </div>

                        {/* Address Details */}
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <Label htmlFor="parentAddress">Address Line</Label>
                                <Input
                                    id="parentAddress"
                                    value={formData.parentAddress}
                                    onChange={(e) =>
                                        setFormData({ ...formData, parentAddress: e.target.value })
                                    }
                                    placeholder="Enter complete address"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                                <Label htmlFor="parentCity">City</Label>
                                <Input
                                    id="parentCity"
                                    value={formData.parentCity}
                                    onChange={(e) =>
                                        setFormData({ ...formData, parentCity: e.target.value })
                                    }
                                    placeholder="Enter city"
                                />
                            </div>
                            <div>
                                <Label htmlFor="parentRegion">State/Region</Label>
                                <Input
                                    id="parentRegion"
                                    value={formData.parentRegion}
                                    onChange={(e) =>
                                        setFormData({ ...formData, parentRegion: e.target.value })
                                    }
                                    placeholder="Enter state/region"
                                />
                            </div>
                            <div>
                                <Label htmlFor="parentPinCode">Pin Code</Label>
                                <Input
                                    id="parentPinCode"
                                    value={formData.parentPinCode}
                                    onChange={(e) =>
                                        setFormData({ ...formData, parentPinCode: e.target.value })
                                    }
                                    placeholder="Enter pin code"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Custom Fields - Filtered by Enquiry Location */}
                <CustomEnquiryFieldsCard
                    customFieldValues={formData.customFieldValues}
                    onFieldChange={handleCustomFieldChange}
                />

                {/* Enquiry Details - Enhanced with New Fields */}
                <Card className="mb-4">
                    <CardHeader>
                        <CardTitle>Enquiry Details</CardTitle>
                        <CardDescription>
                            Additional tracking and preference information
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <Label htmlFor="enquiryStatus">Enquiry Status</Label>
                                <Select
                                    value={formData.enquiryStatus}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, enquiryStatus: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NEW">New</SelectItem>
                                        <SelectItem value="CONTACTED">Contacted</SelectItem>
                                        <SelectItem value="QUALIFIED">Qualified</SelectItem>
                                        <SelectItem value="NOT_ELIGIBLE">Not Eligible</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="sourceType">Source Type</Label>
                                <Select
                                    value={formData.sourceType}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, sourceType: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="WEBSITE">Website</SelectItem>
                                        <SelectItem value="GOOGLE_ADS">Google Ads</SelectItem>
                                        <SelectItem value="FACEBOOK">Facebook</SelectItem>
                                        <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                                        <SelectItem value="REFERRAL">Referral</SelectItem>
                                        <SelectItem value="OTHER">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="referenceSource">Reference Source</Label>
                                <Input
                                    id="referenceSource"
                                    value={formData.referenceSource}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            referenceSource: e.target.value,
                                        })
                                    }
                                    placeholder="e.g., Friend's name, advertisement campaign"
                                />
                            </div>
                            <div>
                                <Label htmlFor="mode">Mode</Label>
                                <Select
                                    value={formData.mode}
                                    onValueChange={(value: 'ONLINE' | 'OFFLINE') =>
                                        setFormData({ ...formData, mode: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ONLINE">Online</SelectItem>
                                        <SelectItem value="OFFLINE">Offline</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="feeExpectation">Fee Range Expectation</Label>
                                <Input
                                    id="feeExpectation"
                                    value={formData.feeExpectation}
                                    onChange={(e) =>
                                        setFormData({ ...formData, feeExpectation: e.target.value })
                                    }
                                    placeholder="e.g., 50000-100000"
                                />
                            </div>
                            <div>
                                <Label htmlFor="transportRequirement">Transport Requirement</Label>
                                <Select
                                    value={formData.transportRequirement}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, transportRequirement: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select transport need" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="YES">Yes - Required</SelectItem>
                                        <SelectItem value="NO">No - Not Required</SelectItem>
                                        <SelectItem value="OPTIONAL">Optional</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {!selectedCounsellor ? (
                                <div>
                                    <Label htmlFor="counsellorSearch">Search Counsellor</Label>
                                    <Input
                                        id="counsellorSearch"
                                        value={counsellorSearchQuery}
                                        onChange={(e) => setCounsellorSearchQuery(e.target.value)}
                                        placeholder="Type to search by name..."
                                    />
                                    {isLoadingCounsellors && (
                                        <p className="mt-2 text-sm text-gray-500">Searching...</p>
                                    )}
                                    {counsellors && counsellors.length > 0 && (
                                        <div className="mt-2 max-h-48 overflow-y-auto rounded-md border">
                                            {counsellors.map((counsellor) => (
                                                <button
                                                    key={counsellor.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCounsellor({
                                                            id: counsellor.id,
                                                            full_name: counsellor.full_name,
                                                        });
                                                        setFormData({
                                                            ...formData,
                                                            counsellorId: counsellor.id,
                                                        });
                                                        setCounsellorSearchQuery('');
                                                    }}
                                                    className="w-full border-b p-3 text-left transition-colors last:border-0 hover:bg-gray-50"
                                                >
                                                    <div className="font-medium">
                                                        {counsellor.full_name}
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        {counsellor.email}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {counsellors &&
                                        counsellors.length === 0 &&
                                        counsellorSearchQuery &&
                                        !isLoadingCounsellors && (
                                            <p className="mt-2 text-sm text-gray-500">
                                                No counsellors found matching "
                                                {counsellorSearchQuery}"
                                            </p>
                                        )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between rounded-md border p-2">
                                    <div>
                                        <div className="font-medium ">
                                            {selectedCounsellor?.full_name}
                                        </div>
                                        <div className="text-sm ">Assigned Counsellor</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedCounsellor(null);
                                            setFormData({ ...formData, counsellorId: '' });
                                        }}
                                        className="rounded-full p-1  transition-colors hover:bg-gray-100"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) =>
                                    setFormData({ ...formData, notes: e.target.value })
                                }
                                placeholder="Enter any additional notes or comments"
                                rows={4}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        onClick={() => navigate({ to: '/admissions/enquiries' })}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </MyButton>
                    <MyButton type="submit" disabled={isSubmitting}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSubmitting ? 'Saving...' : 'Save'}
                    </MyButton>
                </div>
            </form>
        </div>
    );
}

function RouteComponent() {
    return (
        <LayoutContainer>
            <NewEnquiryForm />
        </LayoutContainer>
    );
}
