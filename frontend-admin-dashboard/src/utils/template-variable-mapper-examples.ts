/**
 * Template Variable Mapper Usage Examples
 *
 * This file demonstrates how to use the template variable mapper
 * in different contexts across the application.
 */

import { mapTemplateVariables, getAvailableVariables, validateTemplate } from './template-variable-mapper';

// Example 1: Student Management Context (Current Implementation)
export const studentManagementExample = () => {
    const template = `
        Subject: Welcome {{name}} to {{course_name}}!

        Body: Dear {{name}},
        Welcome to {{institute_name}}!
        Your course {{course_name}} starts on {{batch_start_date}}.
        Your student ID is {{student_id}}.
        Your attendance status: {{attendance_status}}
        Best regards,
        {{institute_name}} Team
    `;

    const student = {
        full_name: "John Doe",
        email: "john@example.com",
        user_id: "STU001",
        course_name: "Python Programming",
        institute_name: "Tech Academy",
        batch_start_date: "2024-02-01",
        attendance_status: "Present"
    };

    const result = mapTemplateVariables(template, {
        context: 'student-management',
        student: student
    });

    console.log('Student Management Result:', result);
    return result;
};

// Example 2: Course Page Context (No Attendance Data)
export const coursePageExample = () => {
    const template = `
        Subject: Course Update - {{course_name}}

        Body: Hello {{name}},
        This is an update about your course {{course_name}}.
        Course duration: {{course_duration}}
        Instructor: {{course_instructor}}
        Start date: {{course_start_date}}

        Best regards,
        {{institute_name}} Team
    `;

    const student = {
        full_name: "Jane Smith",
        email: "jane@example.com",
        user_id: "STU002"
    };

    const course = {
        name: "Web Development",
        duration: "3 months",
        instructor_name: "Dr. Smith",
        start_date: "2024-03-01"
    };

    const institute = {
        name: "Tech Academy",
        email: "info@techacademy.com"
    };

    const result = mapTemplateVariables(template, {
        context: 'course',
        student: student,
        course: course,
        institute: institute
    });

    console.log('Course Page Result:', result);
    return result;
};

// Example 3: General Context (Minimal Data)
export const generalContextExample = () => {
    const template = `
        Subject: General Announcement - {{current_date}}

        Body: Hello,
        This is a general announcement.
        Today's date: {{current_date}}
        Current time: {{current_time}}

        Thank you for your attention.
    `;

    const result = mapTemplateVariables(template, {
        context: 'general'
    });

    console.log('General Context Result:', result);
    return result;
};

// Example 4: Assessment Context
export const assessmentExample = () => {
    const template = `
        Subject: Assessment Results - {{assessment_name}}

        Body: Dear {{name}},
        Your assessment results for {{assessment_name}} are ready.
        Score: {{assessment_score}}/100
        Date: {{assessment_date}}
        Course: {{course_name}}

        Best regards,
        {{institute_name}} Team
    `;

    const student = {
        full_name: "Alice Johnson",
        email: "alice@example.com"
    };

    const course = {
        name: "Data Science"
    };

    const institute = {
        name: "Tech Academy"
    };

    const customVariables = {
        assessment_name: "Mid-term Exam",
        assessment_score: "85",
        assessment_date: "2024-02-15"
    };

    const result = mapTemplateVariables(template, {
        context: 'assessment',
        student: student,
        course: course,
        institute: institute,
        customVariables: customVariables
    });

    console.log('Assessment Result:', result);
    return result;
};

// Example 5: Handling Missing Data
export const missingDataExample = () => {
    const template = `
        Subject: Update for {{name}}

        Body: Hello {{name}},
        Your course {{course_name}} is going well.
        Attendance: {{attendance_status}}
        Batch: {{batch_name}}
        Custom field: {{custom_field_1}}

        Best regards,
        {{institute_name}} Team
    `;

    const student = {
        full_name: "Bob Wilson",
        email: "bob@example.com"
        // Missing: course_name, attendance_status, batch_name, custom_field_1
    };

    const result = mapTemplateVariables(template, {
        context: 'student-management',
        student: student
    });

    console.log('Missing Data Result:', result);
    // Variables that don't exist will be replaced with placeholders like [course_name]
    return result;
};

// Example 6: Validation
export const validationExample = () => {
    const template = `
        Subject: {{name}} - {{invalid_variable}} - {{course_name}}

        Body: Hello {{name}},
        This template has some invalid variables.
        Valid: {{current_date}}
        Invalid: {{attendance_status}} (not available in course context)
    `;

    const validation = validateTemplate(template, 'course');

    console.log('Validation Result:', validation);
    // {
    //   isValid: false,
    //   unmappedVariables: ['invalid_variable', 'attendance_status'],
    //   availableVariables: ['{{current_date}}', '{{name}}', '{{course_name}}', ...]
    // }

    return validation;
};

// Example 7: Getting Available Variables
export const availableVariablesExample = () => {
    const studentManagementVars = getAvailableVariables('student-management');
    const courseVars = getAvailableVariables('course');
    const generalVars = getAvailableVariables('general');

    console.log('Student Management Variables:', studentManagementVars);
    console.log('Course Variables:', courseVars);
    console.log('General Variables:', generalVars);

    return {
        studentManagement: studentManagementVars,
        course: courseVars,
        general: generalVars
    };
};

// Example 8: Real-world Usage in Different Components
export const realWorldUsageExamples = {
    // In a course page component
    coursePageEmail: (student: any, course: any, template: string) => {
        return mapTemplateVariables(template, {
            context: 'course',
            student: student,
            course: course
        });
    },

    // In an assessment component
    assessmentEmail: (student: any, assessmentData: any, template: string) => {
        return mapTemplateVariables(template, {
            context: 'assessment',
            student: student,
            customVariables: assessmentData
        });
    },

    // In an announcement component
    announcementEmail: (student: any, announcementData: any, template: string) => {
        return mapTemplateVariables(template, {
            context: 'announcement',
            student: student,
            customVariables: announcementData
        });
    },

    // In a general notification component
    generalNotification: (template: string, customData?: Record<string, string>) => {
        return mapTemplateVariables(template, {
            context: 'general',
            customVariables: customData || {}
        });
    }
};

// Export all examples for easy testing
export const runAllExamples = () => {
    console.log('=== Running All Template Variable Mapper Examples ===');

    studentManagementExample();
    coursePageExample();
    generalContextExample();
    assessmentExample();
    missingDataExample();
    validationExample();
    availableVariablesExample();

    console.log('=== All Examples Completed ===');
};
