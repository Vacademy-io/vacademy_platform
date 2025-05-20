import { Step } from "@/hooks/use-intro";

const dashboardSteps: Step[] = [
    {
        element: "#dashboard",
        title: "Welcome to Your Dashboard!",
        intro: "Your dashboard provides quick access to institute info and key actions.",
        position: "right",
    },
    {
        element: "#student-mangement",
        title: "Student Management",
        intro: "Enroll, view details, update info, and assign batches. Manage all students here.",
        position: "right",
    },
    {
        element: "#study-library",
        title: "Study Library",
        intro: "Create and manage courses by defining levels and subjects, and organizing the course structure for better progression.",
        position: "right",
    },
    {
        element: "#assessment-centre",
        title: "Assessment Centre",
        intro: "Build assessments, assign them to batches, and monitor student performance—all in one place.",
        position: "right",
    },
    {
        element: "#quick-enrollment",
        title: "Quick Enrollment",
        intro: "New students? Enroll them easily from here.",
        position: "top",
    },
    {
        element: "#first-course",
        title: "Create Your First Course",
        intro: "Begin managing your courses by setting up your first one. It is quick and simple",
    },
    {
        element: "#first-assessment",
        title: "Create your first assessment",
        intro: "Quickly create your first assessment to evaluate and track student progress.",
    },
];

const createAssesmentSteps: Step[] = [
    {
        element: "#basic-info",
        title: "Complete Basic Info",
        intro: "Provide the basic details of the assessment and move forward.",
        position: "right",
        subStep: [
            {
                element: "#assessment-details",
                title: "Assessment Details",
                intro: "Provide assessment details such as the assessment name and its associated subject.",
                position: "right",
            },
            {
                element: "#assessment-instructions",
                title: "Assessment Instructions",
                intro: "Specify any assessment instructions you want participants to follow. These instructions will be displayed to them before the assessment begins.",
                position: "right",
            },
            {
                element: "#date-range",
                title: "Live Date Range",
                intro: "Set the start and end date and time during which participants will be allowed to take the assessment.",
                position: "right",
            },
            {
                element: "#evaluation-type",
                title: "Evaluation Type",
                intro: "Choose the evaluation type: either automatic or manual evaluation.",
                position: "right",
            },
            {
                element: "#attempt-settings",
                title: "Attempt settings",
                intro: "Configure attempt settings, including assessment preview access, section switching, reattempt requests, and time extension requests for participants.",
                position: "right",
            },
        ],
    },
    {
        element: "#add-question",
        title: "Add Questions",
        intro: "Add questions for each section and configure the marking scheme accordingly.",
        position: "right",
        subStep: [
            {
                element: "#duration-settings",
                title: "Duration Settings",
                intro: "Configure the assessment duration for the entire test, individual sections, or specific questions.",
                position: "right",
            },
            {
                element: "#section-details",
                title: "Section Details",
                intro: "Add section details such as the upload question paper and marking scheme.",
                position: "right",
            },
            {
                element: "#upload-question-paper",
                title: "Upload Question Paper",
                intro: "Upload the question paper by directly uploading a DOC or HTML file from your device, creating it manually from scratch, or selecting from your saved papers.",
                position: "right",
            },
            {
                element: "#section-instructions",
                title: "Section Instructions",
                intro: "Provide any instructions for the section, which will be shown to participants before they begin.",
                position: "right",
            },
            {
                element: "#marking-scheme",
                title: "Marking Scheme",
                intro: "Define the marking scheme for the section by setting marks per question, negative marking, partial marking, cutoff marks, and problem randomization.",
                position: "right",
            },
            {
                element: "#add-section",
                title: "Add Section",
                intro: `Add new sections easily by clicking the "Add New Section" button.`,
                position: "right",
            },
        ],
    },
    {
        element: "#add-participants",
        title: "Add Participants",
        intro: "Assign participants by selecting batches or adding them individually to the assessment.",
        position: "right",
        subStep: [
            {
                element: "#open-assessment",
                title: "Closed/Open Assessment",
                intro: "Choose whether to create a closed assessment (restricted to institute students) or an open assessment (accessible to participants outside the institute).",
                position: "right",
            },
            // {
            //     element: "#select-participants",
            //     title: "Select Participants",
            //     intro: "Choose participants for the assessment by selecting entire batches or individual students.",
            //     position: "right",
            // },
            {
                element: "#join-link-qr-code",
                title: "Join Link and QR code",
                intro: "Share the join link and QR code with participants, allowing them to access the assessment by clicking the link or scanning the QR code.",
                position: "right",
            },
            // {
            //     element: "#report-scheduling",
            //     title: "Assessment Report Scheduling",
            //     intro: "Determine the appropriate time to make assessment reports available to students based on your preferred schedule.",
            //     position: "right",
            // },
            {
                element: "#notify-via-email",
                title: "Notify via Email",
                intro: `Configure and personalize notification settings to keep participants  and parents informed about important assessment updates and reminders.`,
                position: "right",
            },
        ],
    },
    {
        element: "#access-control",
        title: "Access Control",
        intro: "Control who can access the assessment by configuring the access settings.",
        position: "right",
        subStep: [
            {
                element: "#access-users",
                title: "Access Control",
                intro: "Grant users in the institute appropriate access by assigning them to specific access control groups.",
                position: "right",
            },
        ],
    },
];

const createAssesmentButtonStep: Step[] = [
    {
        element: "#create-assessment",
        title: "Create Assessment",
        intro: "Set up your first assessment with ease.",
        position: "right",
    },
];

const createCourseStep: Step[] = [
    {
        element: "#create-new-course",
        title: "Create a New Course",
        intro: "Start by setting up a new course in the Study Library. Define its name, description, and other details to structure your learning material efficiently.",
    },
];

const assignYearStep: Step[] = [
    {
        element: "#assign-year",
        title: "Assign Year/Class/Level",
        intro: "Categorize the course by selecting the appropriate year, class, or level to ensure proper organization and accessibility for students.",
    },
];

const addSubjectStep: Step[] = [
    {
        element: "#add-subject",
        title: "Add Subject",
        intro: "Select and assign subjects under the chosen Year/Class/Level to structure the study library efficiently.",
    },
];

const addModulesStep: Step[] = [
    {
        element: "#add-modules",
        title: "Add Modules",
        intro: "Create and organize modules within the selected subject to streamline study materials and enhance course structure.",
    },
];

const addChaptersStep: Step[] = [
    {
        element: "#add-chapters",
        title: "Add Chapters",
        intro: "Break down modules into chapters to structure the study material effectively and provide a clear learning path for students.",
    },
];

const addSlidesStep: Step[] = [
    {
        element: "#add-slides",
        title: "Add Slides",
        intro: "Enhance chapters by adding slides in various formats like videos, PDFs, or documents to create a comprehensive learning experience.",
        position: "right",
    },
];

const publishSlideStep: Step[] = [
    {
        element: "#publish-slide",
        title: "Publish Slide",
        intro: "Make the slide accessible to assigned batches by clicking `Publish` Once published, students can view the content.",
        position: "right",
    },
];

const studyLibrarySteps = {
    createCourseStep,
    assignYearStep,
    addSubjectStep,
    addModulesStep,
    addChaptersStep,
    addSlidesStep,
    publishSlideStep,
};

const studentManagementSteps: Step[] = [
    {
        element: "#enroll-students",
        title: "Enroll Students",
        intro: "Enroll students manually or upload a CSV to bulk enroll. Select the course and session to get them started.",
        position: "left",
    },
    {
        element: "#organize",
        title: "Organize with Filters",
        intro: "Apply filters to quickly find and manage student data improving your workflow.",
        position: "right",
    },
    {
        element: "#export-data",
        title: "Export Data",
        intro: "Quickly export student details in a structured CSV file, making it easy to store or share records.",
        position: "bottom",
    },
];

const addCourseStep: Step[] = [
    {
        element: "#course-name",
        title: "Enter Course Name",
        intro: "Specify the course name offered by your institute.",
        position: "bottom",
    },
    {
        element: "#course-thumbnail",
        title: "Upload Image",
        intro: "Add a cover image to your course for easy identification.",
        position: "right",
    },
    {
        element: "#course-level",
        title: "Level",
        intro: "Specify whether your course includes multiple levels, such as 9th or 10th standard, or if it has no levels.",
        position: "right",
    },
    {
        element: "#add-course-level",
        title: "Add Level",
        intro: "Create levels linked to your course, structured by difficulty tiers such as the 10th standard.",
        position: "right",
    },
    {
        element: "#add-course-session",
        title: "Add Session",
        intro: "Create sessions linked to the course, specifying a time period such as 2024-2025.",
        position: "right",
    },
    {
        element: "#add-course-button",
        title: "Add Course",
        intro: `Click the "Add" button to include a course in your institute.`,
        position: "right",
    },
];
const inviteSteps: Step[] = [
    {
        element: "#invite-link-name",
        title: "Invite link Name",
        intro: "Enter a name that clearly identifies the batch you're inviting students to. For example, 'Batch A - July 2025'",
        position: "right",
    },
    {
        element: "#activate-link",
        title: "Activate Invite link",
        intro: "Turn the link on or off depending on when you want students to enroll.",
        position: "right",
    },
    {
        element: "#custom-fields",
        title: "Add Custom Fields",
        intro: "Add any additional fields you'd like students to fill out as part of the enrollment form.",
        position: "right",
    },
    {
        element: "#select-batch",
        title: "Select Batch Enrollment Preference",
        intro: "You can pre-select the batches you're inviting students to, or allow them to choose from the list of open batches during enrollment.",
        position: "right",
    },
    {
        element: "#student-access-duration",
        title: "Set Student Access Duration",
        intro: "Enter the number of days students will have access to the course after enrolling using this invite.",
        position: "right",
    },
    {
        element: "#invitee-email",
        title: "Invitee Email",
        intro: "Optionally, enter the email addresses of users you want to send the invite to, and an email will be sent to them.",
        position: "right",
    },
];

export {
    dashboardSteps,
    createAssesmentSteps,
    studyLibrarySteps,
    studentManagementSteps,
    createAssesmentButtonStep,
    addCourseStep,
    inviteSteps,
};
