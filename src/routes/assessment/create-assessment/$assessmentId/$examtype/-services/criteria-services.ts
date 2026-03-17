import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

// API Endpoints
const CRITERIA_BASE_URL = `${'http://localhost:8074'}/assessment-service/assessment/evaluation-criteria`;
const GENERATE_AI_CRITERIA_URL = `${CRITERIA_BASE_URL}/generate-ai`;
const LIST_TEMPLATES_URL = `${CRITERIA_BASE_URL}/templates`;
const CREATE_TEMPLATE_URL = `${CRITERIA_BASE_URL}/template`;
const GET_TEMPLATE_URL = `${CRITERIA_BASE_URL}/template`;

// Type Definitions
export interface CriteriaItem {
    name: string;
    description: string;
    max_marks: number;
}

export interface CriteriaJson {
    max_marks: number;
    criteria: CriteriaItem[];
}

// Backend rubric format (what the API actually stores and returns)
export interface RubricItem {
    criteria_name: string;
    max_marks: number;
    keywords?: string[];
    evaluation_guidelines: string;
}

export interface RubricJson {
    max_marks: number;
    rubric: RubricItem[];
    partial_marking_enabled?: boolean;
    evaluation_instructions?: string;
}

// API response type for templates
interface ApiTemplateResponse {
    id?: string;
    name: string;
    subject: string;
    question_type: string;
    criteria: {
        max_marks: number;
        rubric: Array<{
            criteria_name: string;
            max_marks: number;
            keywords?: string[];
            evaluation_guidelines: string;
        }> | null;
        partial_marking_enabled?: boolean | null;
        evaluation_instructions?: string | null;
    };
    description: string;
    is_active?: boolean;
    created_by?: string;
    created_at?: string;
    updated_at?: string;
}

// Frontend type for templates
export interface EvaluationCriteriaTemplate {
    id?: string;
    name: string;
    subject: string;
    questionType: string;
    description: string;
    criteriaJson: CriteriaJson;
    createdBy?: string;
    createdAt?: string;
}

export interface GenerateAICriteriaRequest {
    question_text: string;
    question_type: string;
    subject: string;
    max_marks: number;
}

export interface GenerateAICriteriaResponse {
    name: string;
    subject: string;
    question_type: string;
    description: string;
    criteria_json: {
        max_marks: number;
        rubric: Array<{
            criteria_name: string;
            max_marks: number;
            keywords?: string[];
            evaluation_guidelines: string;
        }>;
        partial_marking_enabled?: boolean;
        evaluation_instructions?: string;
    };
}

export interface ListTemplatesFilters {
    subject?: string;
    question_type?: string;
}

export type CriteriaSource = 'ai' | 'manual' | 'template';

// Helper function to transform API rubric to frontend criteria format
const transformRubricToCriteria = (apiResponse: GenerateAICriteriaResponse): CriteriaJson => {
    return {
        max_marks: apiResponse.criteria_json.max_marks,
        criteria: apiResponse.criteria_json.rubric.map((item) => ({
            name: item.criteria_name,
            description: item.evaluation_guidelines,
            max_marks: item.max_marks,
        })),
    };
};

// Helper function to transform API template to frontend format
const transformApiTemplate = (apiTemplate: ApiTemplateResponse): EvaluationCriteriaTemplate => {
    // If rubric is null or empty, create empty criteria array
    const criteria = apiTemplate.criteria.rubric
        ? apiTemplate.criteria.rubric.map((item) => ({
              name: item.criteria_name,
              description: item.evaluation_guidelines,
              max_marks: item.max_marks,
          }))
        : [];

    return {
        id: apiTemplate.id,
        name: apiTemplate.name,
        subject: apiTemplate.subject,
        questionType: apiTemplate.question_type,
        description: apiTemplate.description,
        criteriaJson: {
            max_marks: apiTemplate.criteria.max_marks,
            criteria: criteria,
        },
        createdBy: apiTemplate.created_by,
        createdAt: apiTemplate.created_at,
    };
};

// Helper function to check if an object is in rubric format
const isRubricFormat = (obj: any): obj is RubricJson => {
    return obj && typeof obj === 'object' && 'rubric' in obj && Array.isArray(obj.rubric);
};

// Helper function to check if an object is in criteria format
const isCriteriaFormat = (obj: any): obj is CriteriaJson => {
    return obj && typeof obj === 'object' && 'criteria' in obj && Array.isArray(obj.criteria);
};

// Helper function to transform rubric format to criteria format
const rubricToCriteria = (rubricJson: RubricJson): CriteriaJson => {
    return {
        max_marks: rubricJson.max_marks,
        criteria: rubricJson.rubric.map((item) => ({
            name: item.criteria_name,
            description: item.evaluation_guidelines,
            max_marks: item.max_marks,
        })),
    };
};

// Helper function to transform criteria format to rubric format
export const criteriaToRubric = (criteriaJson: CriteriaJson): RubricJson => {
    return {
        max_marks: criteriaJson.max_marks,
        rubric: criteriaJson.criteria.map((item) => ({
            criteria_name: item.name,
            max_marks: item.max_marks,
            keywords: [],
            evaluation_guidelines: item.description,
        })),
        partial_marking_enabled: true,
        evaluation_instructions: `Evaluate based on the following ${criteriaJson.criteria.length} criteria.`,
    };
};

// API Functions

/**
 * Generate evaluation criteria using AI
 * @param request - The question details for AI generation
 * @param save - Whether to save the generated criteria as a template (default: false)
 * @returns Generated criteria
 */
export const generateAICriteria = async (
    request: GenerateAICriteriaRequest,
    save: boolean = false
): Promise<CriteriaJson> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GENERATE_AI_CRITERIA_URL,
        params: { save },
        data: request,
    });

    // Transform the API response to our frontend format
    const apiResponse = response?.data as GenerateAICriteriaResponse;
    return transformRubricToCriteria(apiResponse);
};

/**
 * List all evaluation criteria templates with optional filters
 * @param filters - Optional filters for subject and question_type
 * @returns Array of templates
 */
export const listCriteriaTemplates = async (
    filters?: ListTemplatesFilters
): Promise<EvaluationCriteriaTemplate[]> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: LIST_TEMPLATES_URL,
        params: filters,
    });

    const apiTemplates = response?.data || [];
    // Transform API templates to frontend format
    return apiTemplates.map(transformApiTemplate);
};

/**
 * Create a new evaluation criteria template
 * @param template - The template data to create
 * @returns Created template with ID
 */
export const createCriteriaTemplate = async (
    template: Omit<EvaluationCriteriaTemplate, 'id' | 'createdBy' | 'createdAt'>
): Promise<EvaluationCriteriaTemplate> => {
    // Build request payload matching API documentation with rubric format
    const requestData = {
        name: template.name,
        subject: template.subject,
        question_type: template.questionType,
        description: template.description,
        criteria_json: {
            max_marks: template.criteriaJson.max_marks,
            rubric: template.criteriaJson.criteria.map((item) => ({
                criteria_name: item.name,
                max_marks: item.max_marks,
                keywords: [],
                evaluation_guidelines: item.description,
            })),
            partial_marking_enabled: true,
            evaluation_instructions: `Evaluation instructions for ${template.questionType}`,
        },
    };

    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: CREATE_TEMPLATE_URL,
        data: requestData,
    });

    // Transform response to frontend format if needed
    const apiResponse = response?.data;
    return {
        id: apiResponse.id,
        name: apiResponse.name,
        subject: apiResponse.subject,
        questionType: apiResponse.question_type || apiResponse.questionType,
        description: apiResponse.description,
        criteriaJson: apiResponse.criteria_json || apiResponse.criteriaJson,
        createdBy: apiResponse.created_by || apiResponse.createdBy,
        createdAt: apiResponse.created_at || apiResponse.createdAt,
    };
};

/**
 * Get a single template by ID
 * @param templateId - The template ID
 * @returns Template details
 */
export const getCriteriaTemplateById = async (
    templateId: string
): Promise<EvaluationCriteriaTemplate> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${GET_TEMPLATE_URL}/${templateId}`,
    });
    return response?.data;
};

/**
 * React Query hook for listing templates
 * @param filters - Optional filters
 * @returns Query configuration object
 */
export const useListCriteriaTemplates = (filters?: ListTemplatesFilters) => {
    return {
        queryKey: ['LIST_CRITERIA_TEMPLATES', filters],
        queryFn: () => listCriteriaTemplates(filters),
        staleTime: 5 * 60 * 1000, // 5 minutes
    };
};

/**
 * React Query hook for getting a template by ID
 * @param templateId - The template ID
 * @returns Query configuration object
 */
export const useGetCriteriaTemplate = (templateId: string) => {
    return {
        queryKey: ['GET_CRITERIA_TEMPLATE', templateId],
        queryFn: () => getCriteriaTemplateById(templateId),
        enabled: !!templateId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    };
};

/**
 * Helper function to convert criteria to stringified JSON for API submission
 * @param criteria - The criteria object
 * @returns Stringified criteria JSON in rubric format
 */
export const stringifyCriteria = (criteria: CriteriaJson): string => {
    // Convert to rubric format before stringifying
    const rubricFormat = criteriaToRubric(criteria);
    return JSON.stringify(rubricFormat);
};

/**
 * Helper function to parse stringified criteria JSON
 * Intelligently handles both rubric format (backend) and criteria format (frontend)
 * @param criteriaString - The stringified criteria
 * @returns Parsed criteria object in frontend format, or null if invalid
 */
export const parseCriteria = (criteriaString: string): CriteriaJson | null => {
    try {
        const parsed = JSON.parse(criteriaString);

        // Check if it's in rubric format (backend format)
        if (isRubricFormat(parsed)) {
            return rubricToCriteria(parsed);
        }

        // Check if it's already in criteria format (frontend format)
        if (isCriteriaFormat(parsed)) {
            return parsed;
        }

        // Invalid format
        console.error('Parsed criteria is not in a recognized format:', parsed);
        return null;
    } catch (error) {
        console.error('Error parsing criteria JSON:', error);
        return null;
    }
};

/**
 * Validate that criteria max_marks matches question max_marks
 * @param criteriaMaxMarks - Total marks from criteria
 * @param questionMaxMarks - Total marks for the question
 * @returns Validation result
 */
export const validateCriteriaMarks = (
    criteriaMaxMarks: number,
    questionMaxMarks: number
): { isValid: boolean; message?: string } => {
    if (criteriaMaxMarks !== questionMaxMarks) {
        return {
            isValid: false,
            message: `Criteria total marks (${criteriaMaxMarks}) must match question marks (${questionMaxMarks})`,
        };
    }
    return { isValid: true };
};

/**
 * Calculate total marks from criteria items
 * @param criteria - Array of criteria items
 * @returns Total marks
 */
export const calculateTotalMarks = (criteria: CriteriaItem[]): number => {
    return criteria.reduce((total, item) => total + item.max_marks, 0);
};
