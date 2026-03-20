// export interface Option {
//   optionId: string;
//   optionName: string;
// }

// // export interface Question {
// //   questionType: string;
// //   questionId: string;
// //   questionName: string;
// //   questionMark: string;
// //   imageDetails: any[];
// //   options: Array<{
// //     optionId: string;
// //     optionName: string;
// //   }>;
// // }

// export interface MarkingRule {
//   checked: boolean;
//   value: string;
// }

// export interface Section {
//   assesmentDuration: string;
//   subject: string;
//   sectionDesc: string;
//   sectionDuration: string;
//   negativeMarking: MarkingRule;
//   partialMarking: boolean;
//   cutoffMarking: MarkingRule;
//   totalMark: string;
//   questions: Question[];
// }

// export interface Assessment {
//   assessmentId: string;
//   title: string;
//   mode: string;
//   status: string;
//   startDate: string;
//   endDate: string;
//   assessmentDuration: string;
//   subject: string;
//   assessmentInstruction: string;
//   assessmentPreview: string;
//   canSwitchSections: boolean;
//   sections: Section[];
// }

// export interface AssessmentPreviewProps {
//   assessment?: {
//     assessmentDuration: string;
//     assessmentPreview: string;
//     canSwitchSections: boolean;
//     sections: {
//       subject: string;
//       sectionDesc: string;
//       sectionDuration: string;
//       negativeMarking: {
//         checked: boolean;
//         value: string;
//       };
//       partialMarking: boolean;
//       cutoffMarking: {
//         checked: boolean;
//         value: string;
//       };
//       totalMark: string;
//     }[];
//   };
// }
// export interface InstructionsProps {
//   instructions: string;
//   duration: string;
//   preview: string;
//   canSwitchSections: boolean;
// }
// // export interface SectionProps {
// //   section: {
// //     assesmentDuration: string;
// //     subject: string;
// //     sectionDesc: string;
// //     sectionDuration: string;
// //     negativeMarking: { checked: boolean; value: string };
// //     partialMarking: boolean;
// //     cutoffMarking: { checked: boolean; value: string };
// //     totalMark: string;
// //   };
// // }
// export interface AssessmentCardProps {
//   assessment: Assessment;
//   index: number;
// }

