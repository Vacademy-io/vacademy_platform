import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { EnrollManuallyButton } from '@/components/common/students/enroll-manually/enroll-manually-button';
import { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';
import { ContentType } from '../-types/enroll-request-types';
import { useEffect, useState } from 'react';
import { StudentTable } from '@/types/student-table-types';
import { InviteLink } from '@/routes/manage-students/-components/InviteLink';

export const RequestCard = ({
    obj,
    batchDetails,
}: {
    obj: ContentType;
    batchDetails?: BatchForSessionType;
}) => {
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [studentData, setStudentData] = useState<StudentTable | undefined>();

    useEffect(() => {
        const data: StudentTable = {
            id: obj.learner_invitation_response_dto.id,
            username: '',
            user_id: '',
            email: obj.learner_invitation_response_dto.email,
            full_name: obj.learner_invitation_response_dto.full_name,
            address_line:
                obj.learner_invitation_response_dto.custom_fields_response.find(
                    (field) => field.field_name == 'Address'
                )?.value || '',
            region:
                obj.learner_invitation_response_dto.custom_fields_response.find(
                    (field) => field.field_name == 'State'
                )?.value || '',
            city:
                obj.learner_invitation_response_dto.custom_fields_response.find(
                    (field) => field.field_name == 'City'
                )?.value || '',
            pin_code:
                obj.learner_invitation_response_dto.custom_fields_response.find(
                    (field) => field.field_name == 'Pincode'
                )?.value || '',
            mobile_number: obj.learner_invitation_response_dto.contact_number,
            date_of_birth: '',
            gender:
                obj.learner_invitation_response_dto.custom_fields_response.find(
                    (field) => field.field_name == 'Gender'
                )?.value || '',
            father_name:
                obj.learner_invitation_response_dto.custom_fields_response.find(
                    (field) => field.field_name == 'Father Name'
                )?.value || '',
            mother_name:
                obj.learner_invitation_response_dto.custom_fields_response.find(
                    (field) => field.field_name == 'Mother Name'
                )?.value || '',
            parents_mobile_number:
                obj.learner_invitation_response_dto.custom_fields_response.find(
                    (field) => field.field_name == 'Parent Phone Number'
                )?.value || '',
            parents_email:
                obj.learner_invitation_response_dto.custom_fields_response.find(
                    (field) => field.field_name == 'Parent Email'
                )?.value || '',
            linked_institute_name:
                obj.learner_invitation_response_dto.custom_fields_response.find(
                    (field) => field.field_name == 'School/College'
                )?.value || '',
            parents_to_mother_email: '',
            parents_to_mother_mobile_number: '',
            package_session_id: batchDetails?.id || '',
            institute_enrollment_id: '',
            status: 'INACTIVE',
            session_expiry_days: 0,
            institute_id: '',
            expiry_date: 0,
            face_file_id: '',
            attempt_id: '',
            created_at: '',
            updated_at: '',
        };

        setStudentData(data);
    }, [obj]);

    return (
        <>
            <div className="flex w-full flex-col gap-6 rounded-lg border border-neutral-300 p-6">
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between">
                        <div className="flex flex-col">
                            <div className="text-subtitle font-semibold">
                                {obj.learner_invitation_response_dto.full_name}
                            </div>
                            <div className="flex items-center gap-10">
                                <div className="text-body">
                                    <span className="font-semibold">Invite Link name</span>:{' '}
                                    {obj.learner_invitation.name}
                                </div>
                                <div className="flex items-center gap-2 text-body">
                                    <p className="text-body font-semibold">Invite Link: </p>
                                    <InviteLink
                                        inviteCode={obj.learner_invitation.invite_code || ''}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="text-neutral-500">
                            {obj.learner_invitation_response_dto.recorded_on}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-x-20 gap-y-4">
                        <p>
                            Batch: {batchDetails ? batchDetails.level.level_name : 'N/A'}{' '}
                            {batchDetails?.package_dto.package_name}
                        </p>
                        <p>Session: {batchDetails ? batchDetails.session.session_name : 'N/A'}</p>
                        <p>Email: {obj.learner_invitation_response_dto.email}</p>
                        <p>Mobile Number: {obj.learner_invitation_response_dto.contact_number}</p>
                        <p>
                            Gender:{' '}
                            {
                                obj.learner_invitation_response_dto.custom_fields_response.find(
                                    (field) => field.field_name == 'Gender'
                                )?.value
                            }
                        </p>
                        <p>
                            School:{' '}
                            {
                                obj.learner_invitation_response_dto.custom_fields_response.find(
                                    (field) => field.field_name == 'School/College'
                                )?.value
                            }
                        </p>
                        <p>
                            Address Line:{' '}
                            {
                                obj.learner_invitation_response_dto.custom_fields_response.find(
                                    (field) => field.field_name == 'Address'
                                )?.value
                            }
                        </p>
                        <p>
                            City/Village:{' '}
                            {
                                obj.learner_invitation_response_dto.custom_fields_response.find(
                                    (field) => field.field_name == 'City'
                                )?.value
                            }
                        </p>
                        <p>
                            State:{' '}
                            {
                                obj.learner_invitation_response_dto.custom_fields_response.find(
                                    (field) => field.field_name == 'State'
                                )?.value
                            }
                        </p>
                    </div>
                </div>
                <div className="flex w-full items-center justify-end">
                    <div className="flex items-center gap-6">
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setOpenDeleteDialog(true)}
                        >
                            Delete
                        </MyButton>
                        <EnrollManuallyButton
                            triggerButton={
                                <MyButton buttonType="primary" scale="medium">
                                    Accept
                                </MyButton>
                            }
                            initialValues={studentData}
                        />
                    </div>
                </div>
            </div>
            <MyDialog
                heading="Delete Enroll Request"
                open={openDeleteDialog}
                onOpenChange={() => setOpenDeleteDialog(!openDeleteDialog)}
                footer={
                    <div className="flex w-full items-center justify-between py-2">
                        <MyButton buttonType="secondary" onClick={() => setOpenDeleteDialog(false)}>
                            Cancel
                        </MyButton>
                        <MyButton buttonType="primary">Yes, I am sure!</MyButton>
                    </div>
                }
            >
                Are you are you want to delete the enroll request of{' '}
                {obj.learner_invitation_response_dto.full_name}?
            </MyDialog>
        </>
    );
};
