import axios from "axios";
import { GET_CUSTOM_FIELDS, INSTITUTE_ID } from "@/constants/urls";

export interface CustomField {
    custom_field_id: string;
    field_key: string;
    field_name: string;
    field_type: string;
    form_order: number | null;
    is_hidden: boolean | null;
    group_name: string | null;
    type: string;
    type_id: string | null;
    status: string;
}

/**
 * Fetches all custom fields for the given institute
 */
export const getCustomFields = async (instituteId?: string): Promise<CustomField[]> => {
    const effectiveInstituteId = instituteId || INSTITUTE_ID;

    try {
        const response = await axios.get(GET_CUSTOM_FIELDS, {
            params: { instituteId: effectiveInstituteId },
            headers: { accept: "*/*" }
        });

        return response.data as CustomField[];
    } catch (error) {
        console.error("[CustomFieldsService] Error fetching custom fields:", error);
        throw error;
    }
};

/**
 * Finds the "Books Preference" custom field ID from the list of custom fields
 * The field_name to search for is "Books Preference " (with trailing space) or similar variations
 */
export const getBooksPreferenceFieldId = async (instituteId?: string): Promise<string | null> => {
    try {
        const customFields = await getCustomFields(instituteId);

        // Look for "Books Preference" field - handle variations with/without trailing spaces
        const booksPreferenceField = customFields.find(
            (field) =>
                field.field_name.toLowerCase().trim() === "books preference" ||
                field.field_key.toLowerCase().includes("books_preference")
        );

        if (booksPreferenceField) {
            console.log("[CustomFieldsService] Found Books Preference field:", booksPreferenceField);
            return booksPreferenceField.custom_field_id;
        }

        console.warn("[CustomFieldsService] Books Preference custom field not found");
        return null;
    } catch (error) {
        console.error("[CustomFieldsService] Error getting Books Preference field ID:", error);
        return null;
    }
};
