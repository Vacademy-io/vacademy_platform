// import { useEffect, useRef } from 'react';
// import { useAssessmentStore } from '@/stores/assessment-store';

// export const useTimeTracking = () => {
//   const {
//     currentQuestion,
//     currentSection,
//     updateTimeTaken,
//     updateSectionTimeTaken,
//     setLastVisitedQuestion,
//     lastVisitedQuestions,
//     assessment,
//   } = useAssessmentStore();

//   // References to store start times
//   const questionStartTimeRef = useRef<number>(Date.now());
//   const sectionStartTimeRef = useRef<number>(Date.now());

//   // Track time spent on each question
//   useEffect(() => {
//     if (!currentQuestion) return;

//     // Update start time when question changes
//     questionStartTimeRef.current = Date.now();
    
//     return () => {
//       const timeSpent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
//       if (timeSpent > 0 && currentQuestion.question_id) {
//         updateTimeTaken(currentQuestion.question_id, timeSpent);
//       }
//     };
//   }, [currentQuestion?.question_id, updateTimeTaken]);

//   // Track time spent on each section
//   useEffect(() => {
//     if (currentSection === undefined) return;

//     // Update start time when section changes
//     sectionStartTimeRef.current = Date.now();

//     return () => {
//       const timeSpent = Math.floor((Date.now() - sectionStartTimeRef.current) / 1000);
//       if (timeSpent > 0) {
//         updateSectionTimeTaken(currentSection, timeSpent);
//       }
//     };
//   }, [currentSection, updateSectionTimeTaken]);

//   // Update last visited question when changing questions
//   useEffect(() => {
//     if (!currentQuestion || currentSection === undefined) return;
//     setLastVisitedQuestion(currentSection, currentQuestion.question_id);
//   }, [currentQuestion?.question_id, currentSection, setLastVisitedQuestion]);

//   // Utility function to get the last visited question for a section
//   const getLastVisitedQuestionForSection = (sectionIndex: number) => {
//     if (!assessment?.section_dtos) return null;
    
//     const lastVisitedId = lastVisitedQuestions[sectionIndex];
//     if (!lastVisitedId) {
//       // If no last visited question, return first question of the section
//       return assessment.section_dtos[sectionIndex]?.question_preview_dto_list[0] || null;
//     }

//     // Find the last visited question in the section
//     return assessment.section_dtos[sectionIndex]?.question_preview_dto_list.find(
//       q => q.question_id === lastVisitedId
//     ) || assessment.section_dtos[sectionIndex]?.question_preview_dto_list[0];
//   };

//   return {
//     getLastVisitedQuestionForSection,
//   };
// };