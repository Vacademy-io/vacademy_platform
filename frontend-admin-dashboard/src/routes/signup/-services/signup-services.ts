import { GET_SIGNED_URL_PUBLIC, SIGNUP_URL } from '@/constants/urls';
import { isNullOrEmptyOrUndefined } from '@/lib/utils';
import axios from 'axios';
import { convertedSignupData } from '../-utils/helper';
import {
    FormValuesStep1Signup,
    organizationDetailsSignupStep1,
} from '../onboarding/-components/Step3AddOrgDetails';
import { z } from 'zod';

export const UploadFileInS3Public = async (
    file: File,
    setIsUploadingFile: React.Dispatch<React.SetStateAction<boolean>> = () => false,
    source?: string,
    sourceId?: string
) => {
    setIsUploadingFile(true);
    const effectiveSource = source || 'FLOOR_DOCUMENTS';
    const effectiveSourceId = sourceId || 'STUDENTS';

    try {
        if (isNullOrEmptyOrUndefined(file)) {
            throw new Error('Invalid File');
        }

        if (file) {
            const signedURLData = await getSignedURLPublic(
                file.name.toLowerCase().replace(/\s+/g, '_'),
                file.type,
                effectiveSource,
                effectiveSourceId
            );

            await axios({
                method: 'PUT',
                url: signedURLData.url,
                data: file,
            });

            setIsUploadingFile(false);
            return signedURLData.id;
        }
    } catch (error) {
        console.error(error);
        setIsUploadingFile(false);
        throw error;
    }
};

const getSignedURLPublic = async (
    file_name: string,
    file_type: string,
    source: string,
    source_id: string
) => {
    const requestBody = {
        file_name: file_name,
        file_type: file_type,
        source: source,
        source_id: source_id,
    };
    const response = await axios.post(GET_SIGNED_URL_PUBLIC, requestBody);
    return response.data;
};

export const handleSignupInstitute = async ({
    searchParams,
    formData,
    formDataOrg,
}: {
    searchParams: Record<string, boolean>;
    formData: FormValuesStep1Signup;
    formDataOrg: z.infer<typeof organizationDetailsSignupStep1>;
}) => {
    const convertedData = convertedSignupData({ searchParams, formData, formDataOrg });
    const response = await axios({
        method: 'POST',
        url: SIGNUP_URL,
        data: convertedData,
    });
    return response.data;
};
