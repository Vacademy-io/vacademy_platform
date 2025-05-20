// // "use client"

// // import type React from "react"

// // import { useState } from "react"
// // import { DashboardLoader } from "@/components/core/dashboard-loader"
// // import { Button } from "@/components/ui/button"
// // import { Upload, CheckCircle, XCircle } from "lucide-react"
// // // import { formatBytes } from "@/lib/utils"
// // import authenticatedAxiosInstance from "@/lib/auth/axiosInstance"
// // import { formatBytes } from "./utils"

// // interface AssignmentSlideProps {
// //   slide: {
// //     slide_id: string
// //     assignment_slide: {
// //       id: string
// //       parentRichText?: {
// //         id: string
// //         type: string
// //         content: string
// //       }
// //       textData: {
// //         id: string
// //         type: string
// //         content: string
// //       }
// //       liveDate: string
// //       endDate: string
// //       reAttemptCount: number
// //       commaSeparatedMediaIds: string
// //     }
// //   }
// //   userId: string
// //   uploadFile: (params: {
// //     file: File
// //     setIsUploading: React.Dispatch<React.SetStateAction<boolean>>
// //     userId: string
// //     source?: string
// //     sourceId?: string
// //     publicUrl?: boolean
// //   }) => Promise<string>
// //   getPublicUrl: (fileId: string) => Promise<string>
// // }

// // interface FileInfo {
// //   fileId: string
// //   fileName: string
// //   fileUrl: string
// //   size: number
// //   file: File
// // }

// // export const AssignmentSlide = ({ slide, userId, uploadFile, getPublicUrl }: AssignmentSlideProps) => {
// //   const [isUploading, setIsUploading] = useState(false)
// //   const [pdfFile, setPdfFile] = useState<FileInfo | null>(null)
// //   const [isSubmitted, setIsSubmitted] = useState(false)
// //   const [startTime] = useState(Date.now())

// //   // Check if assignment is active
// //   const now = new Date()
// //   const liveDate = new Date(slide.assignment_slide.liveDate)
// //   const endDate = new Date(slide.assignment_slide.endDate)
// //   const isActive = now >= liveDate && now <= endDate

// //   // Format dates for display
// //   const formatDate = (date: Date) => {
// //     return date.toLocaleDateString("en-US", {
// //       year: "numeric",
// //       month: "short",
// //       day: "numeric",
// //       hour: "2-digit",
// //       minute: "2-digit",
// //     })
// //   }

// //   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
// //     const file = e.target.files?.[0]
// //     if (!file) return

// //     try {
// //       setIsUploading(true)
// //       const fileId = await uploadFile({
// //         file,
// //         setIsUploading,
// //         userId: userId ?? "",
// //         source: "EVALUATIONS",
// //         sourceId: slide.slide_id,
// //       })

// //       if (fileId) {
// //         const publicUrl = await getPublicUrl(fileId)
// //         setPdfFile({
// //           fileId,
// //           fileName: file.name,
// //           fileUrl: publicUrl,
// //           size: file.size,
// //           file: file,
// //         })
// //       }
// //     } catch (error) {
// //       console.error("PDF Upload failed:", error)
// //     } finally {
// //       setIsUploading(false)
// //     }
// //   }

// //   const handleSubmit = async () => {
// //     if (!pdfFile) return

// //     try {
// //       setIsUploading(true)
// //       const endTime = Date.now()

// //       // Prepare tracking data
// //       const trackingData = {
// //         id: `log-${Date.now()}`,
// //         sourceId: slide.slide_id,
// //         sourceType: "ASSIGNMENT",
// //         userId: userId,
// //         slideId: slide.slide_id,
// //         startTimeInMillis: startTime,
// //         endTimeInMillis: endTime,
// //         percentageWatched: 100,
// //         assignment_slide_tracked: [
// //           {
// //             id: slide.assignment_slide.id,
// //             fileId: pdfFile.fileId,
// //             fileName: pdfFile.fileName,
// //             fileUrl: pdfFile.fileUrl,
// //             submittedAt: endTime,
// //           },
// //         ],
// //         concentrationScore: {
// //           score: 1.0,
// //           calculatedAtInMillis: endTime,
// //         },
// //       }

// //       // Submit tracking data to API
// //       await authenticatedAxiosInstance.post("/api/study-tracking/submit", trackingData)
// //       setIsSubmitted(true)
// //     } catch (error) {
// //       console.error("Error submitting assignment:", error)
// //     } finally {
// //       setIsUploading(false)
// //     }
// //   }

// //   // Parse HTML content safely
// //   const createMarkup = (htmlContent: string) => {
// //     return { __html: htmlContent }
// //   }

// //   return (
// //     <div className="flex flex-col w-full max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-sm">
// //       {/* Assignment Title and Description */}
// //       <div
// //         className="text-lg font-medium mb-6"
// //         dangerouslySetInnerHTML={createMarkup(slide.assignment_slide.textData.content)}
// //       />

// //       {/* Assignment Status */}
// //       <div className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
// //         <div className="flex flex-col space-y-2">
// //           <div className="flex justify-between">
// //             <span className="text-sm text-gray-500">Start Date:</span>
// //             <span className="text-sm font-medium">{formatDate(liveDate)}</span>
// //           </div>
// //           <div className="flex justify-between">
// //             <span className="text-sm text-gray-500">Due Date:</span>
// //             <span className="text-sm font-medium">{formatDate(endDate)}</span>
// //           </div>
// //           <div className="flex justify-between">
// //             <span className="text-sm text-gray-500">Status:</span>
// //             <span className={`text-sm font-medium ${isActive ? "text-green-500" : "text-red-500"}`}>
// //               {isActive ? "Active" : now < liveDate ? "Not Started Yet" : "Expired"}
// //             </span>
// //           </div>
// //         </div>
// //       </div>

// //       {/* File Upload Section */}
// //       {isActive && !isSubmitted && (
// //         <div className="mt-4">
// //           <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center">
// //             {pdfFile ? (
// //               <div className="w-full">
// //                 <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
// //                   <div className="flex items-center space-x-3">
// //                     <div className="p-2 bg-primary-50 rounded-md">
// //                       <svg className="h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
// //                         <path
// //                           strokeLinecap="round"
// //                           strokeLinejoin="round"
// //                           strokeWidth={2}
// //                           d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
// //                         />
// //                       </svg>
// //                     </div>
// //                     <div>
// //                       <p className="text-sm font-medium">{pdfFile.fileName}</p>
// //                       <p className="text-xs text-gray-500">{formatBytes(pdfFile.size)}</p>
// //                     </div>
// //                   </div>
// //                   <Button variant="outline" size="sm" onClick={() => setPdfFile(null)}>
// //                     Replace
// //                   </Button>
// //                 </div>
// //               </div>
// //             ) : (
// //               <>
// //                 <Upload className="h-12 w-12 text-gray-400 mb-2" />
// //                 <p className="text-sm text-gray-500 mb-2">Upload your assignment file</p>
// //                 <p className="text-xs text-gray-400 mb-4">PDF, DOCX, or other document formats</p>
// //                 <label htmlFor="file-upload" className="cursor-pointer">
// //                   <div className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors">
// //                     Select File
// //                   </div>
// //                   <input
// //                     id="file-upload"
// //                     type="file"
// //                     className="hidden"
// //                     accept=".pdf,.doc,.docx,.ppt,.pptx"
// //                     onChange={handleFileUpload}
// //                     disabled={isUploading}
// //                   />
// //                 </label>
// //               </>
// //             )}
// //           </div>

// //           {/* Submit Button */}
// //           {pdfFile && (
// //             <div className="mt-6 flex justify-end">
// //               <Button onClick={handleSubmit} disabled={!pdfFile || isUploading} className="px-6">
// //                 {isUploading ? <DashboardLoader /> : "Submit Assignment"}
// //               </Button>
// //             </div>
// //           )}
// //         </div>
// //       )}

// //       {/* Submitted State */}
// //       {isSubmitted && (
// //         <div className="mt-4 p-4 bg-green-50 rounded-md border border-green-200">
// //           <div className="flex items-center">
// //             <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
// //             <p className="text-green-700 font-medium">Assignment submitted successfully!</p>
// //           </div>
// //           <p className="text-sm text-green-600 mt-2">
// //             Your assignment has been submitted. You can view your submission below.
// //           </p>
// //           {pdfFile && (
// //             <div className="mt-4 p-3 bg-white rounded-md border border-gray-200">
// //               <div className="flex items-center justify-between">
// //                 <div className="flex items-center space-x-3">
// //                   <div className="p-2 bg-primary-50 rounded-md">
// //                     <svg className="h-5 w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
// //                       <path
// //                         strokeLinecap="round"
// //                         strokeLinejoin="round"
// //                         strokeWidth={2}
// //                         d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
// //                       />
// //                     </svg>
// //                   </div>
// //                   <div>
// //                     <p className="text-sm font-medium">{pdfFile.fileName}</p>
// //                     <p className="text-xs text-gray-500">{formatBytes(pdfFile.size)}</p>
// //                   </div>
// //                 </div>
// //                 <a
// //                   href={pdfFile.fileUrl}
// //                   target="_blank"
// //                   rel="noopener noreferrer"
// //                   className="text-primary-500 text-sm hover:underline"
// //                 >
// //                   View
// //                 </a>
// //               </div>
// //             </div>
// //           )}
// //         </div>
// //       )}

// //       {/* Expired State */}
// //       {!isActive && now > endDate && !isSubmitted && (
// //         <div className="mt-4 p-4 bg-red-50 rounded-md border border-red-200">
// //           <div className="flex items-center">
// //             <XCircle className="h-5 w-5 text-red-500 mr-2" />
// //             <p className="text-red-700 font-medium">Assignment deadline has passed</p>
// //           </div>
// //           <p className="text-sm text-red-600 mt-2">
// //             The deadline for this assignment was {formatDate(endDate)}. You can no longer submit your work.
// //           </p>
// //         </div>
// //       )}

// //       {/* Not Started Yet State */}
// //       {!isActive && now < liveDate && (
// //         <div className="mt-4 p-4 bg-yellow-50 rounded-md border border-yellow-200">
// //           <p className="text-yellow-700 font-medium">Assignment not active yet</p>
// //           <p className="text-sm text-yellow-600 mt-2">
// //             This assignment will be available starting {formatDate(liveDate)}.
// //           </p>
// //         </div>
// //       )}
// //     </div>
// //   )
// // }

// "use client";

// import type React from "react";

// import { useState, useRef } from "react";
// import { DashboardLoader } from "@/components/core/dashboard-loader";
// import { Button } from "@/components/ui/button";
// import { Upload, FileText, Check, AlertCircle } from "lucide-react";
// // import { formatBytes } from "@/lib/utils";
// import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
// import { Alert, AlertDescription } from "@/components/ui/alert";
// import { formatBytes } from "./utils";

// interface AssignmentSlideProps {
//   slide: {
//     slide_id: string;
//     slide_title?: string;
//     assignment_slide: {
//       id: string;
//       parentRichText?: {
//         id: string;
//         type: string;
//         content: string;
//       };
//       textData: {
//         id: string;
//         type: string;
//         content: string;
//       };
//       liveDate: string;
//       endDate: string;
//       reAttemptCount: number;
//       commaSeparatedMediaIds: string;
//     };
//   };
//   userId: string;
//   uploadFile: (params: {
//     file: File;
//     setIsUploading: React.Dispatch<React.SetStateAction<boolean>>;
//     userId: string;
//     source?: string;
//     sourceId?: string;
//     publicUrl?: boolean;
//   }) => Promise<string>;
//   getPublicUrl: (fileId: string) => Promise<string>;
// }

// interface FileInfo {
//   fileId: string;
//   fileName: string;
//   fileUrl: string;
//   size: number;
//   file: File;
// }

// export const AssignmentSlide = ({
//   slide,
//   userId,
//   uploadFile,
//   getPublicUrl,
// }: AssignmentSlideProps) => {
//   const [isUploading, setIsUploading] = useState(false);
//   const [pdfFile, setPdfFile] = useState<FileInfo | null>(null);
//   const [isSubmitted, setIsSubmitted] = useState(false);
//   const [startTime] = useState(Date.now());
//   const [showPdfPreview, setShowPdfPreview] = useState(false);
//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const [error, setError] = useState<string | null>(null);

//   // Check if assignment is active
//   const now = new Date();
//   const liveDate = new Date(slide.assignment_slide.liveDate);
//   const endDate = new Date(slide.assignment_slide.endDate);
//   const isActive = now >= liveDate && now <= endDate;

//   // Format dates for display
//   const formatDate = (date: Date) => {
//     return date.toLocaleDateString("en-US", {
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//       hour: "2-digit",
//       minute: "2-digit",
//     });
//   };

//   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     // Check if file is PDF
//     if (file.type !== "application/pdf") {
//       setError("Please upload a PDF file");
//       return;
//     }

//     // Check file size (max 10MB)
//     if (file.size > 10 * 1024 * 1024) {
//       setError("File size should be less than 10MB");
//       return;
//     }

//     setError(null);

//     try {
//       setIsUploading(true);
//       const fileId = await uploadFile({
//         file,
//         setIsUploading,
//         userId: userId ?? "",
//         source: "EVALUATIONS",
//         sourceId: slide.slide_id,
//       });

//       if (fileId) {
//         const publicUrl = await getPublicUrl(fileId);
//         setPdfFile({
//           fileId,
//           fileName: file.name,
//           fileUrl: publicUrl,
//           size: file.size,
//           file: file,
//         });
//       }
//     } catch (error) {
//       console.error("PDF Upload failed:", error);
//       setError("Failed to upload PDF. Please try again.");
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   const handleSubmit = async () => {
//     if (!pdfFile) return;

//     try {
//       setIsUploading(true);
//       const endTime = Date.now();

//       // Prepare tracking data
//       const trackingData = {
//         id: `log-${Date.now()}`,
//         sourceId: slide.slide_id,
//         sourceType: "ASSIGNMENT",
//         userId: userId,
//         slideId: slide.slide_id,
//         startTimeInMillis: startTime,
//         endTimeInMillis: endTime,
//         percentageWatched: 100,
//         assignment_slide_tracked: [
//           {
//             id: slide.assignment_slide.id,
//             fileId: pdfFile.fileId,
//             fileName: pdfFile.fileName,
//             fileUrl: pdfFile.fileUrl,
//             submittedAt: endTime,
//           },
//         ],
//         concentrationScore: {
//           score: 1.0,
//           calculatedAtInMillis: endTime,
//         },
//       };

//       // Submit tracking data to API
//       await authenticatedAxiosInstance.post(
//         "/api/study-tracking/submit",
//         trackingData
//       );
//       setIsSubmitted(true);
//     } catch (error) {
//       console.error("Error submitting assignment:", error);
//       setError("Failed to submit assignment. Please try again.");
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   // Parse HTML content safely
//   const createMarkup = (htmlContent: string) => {
//     return { __html: htmlContent };
//   };

//   return (
//     <div className="flex flex-col w-full max-w-3xl mx-auto bg-white">
//       {/* Assignment Title */}
//       <div className="border-b border-gray-200 pb-3 mb-4">
//         <h2 className="text-lg font-medium text-gray-800">
//           {slide.slide_title || "Assignment"}
//         </h2>
//       </div>

//       {/* Assignment Description */}
//       <div className="mb-6">
//         <div
//           className="text-gray-800"
//           dangerouslySetInnerHTML={createMarkup(
//             slide.assignment_slide.textData.content
//           )}
//         />
//       </div>

//       {/* Assignment Status */}
//       <div className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
//         <div className="flex flex-col space-y-2">
//           <div className="flex justify-between">
//             <span className="text-sm text-gray-500">Start Date:</span>
//             <span className="text-sm font-medium">{formatDate(liveDate)}</span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-sm text-gray-500">Due Date:</span>
//             <span className="text-sm font-medium">{formatDate(endDate)}</span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-sm text-gray-500">Status:</span>
//             <span
//               className={`text-sm font-medium ${isActive ? "text-green-500" : "text-red-500"}`}
//             >
//               {isActive
//                 ? "Active"
//                 : now < liveDate
//                   ? "Not Started Yet"
//                   : "Expired"}
//             </span>
//           </div>
//         </div>
//       </div>

//       {/* Error Alert */}
//       {error && (
//         <Alert variant="destructive" className="mb-4">
//           <AlertCircle className="h-4 w-4" />
//           <AlertDescription>{error}</AlertDescription>
//         </Alert>
//       )}

//       {/* File Upload Section */}
//       {isActive && !isSubmitted && (
//         <div className="mt-4">
//           <input
//             type="file"
//             ref={fileInputRef}
//             accept="application/pdf"
//             onChange={handleFileUpload}
//             className="hidden"
//           />

//           {pdfFile ? (
//             <div className="w-full mb-6">
//               <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md border border-gray-200">
//                 <div className="flex items-center space-x-3">
//                   <div className="p-2 bg-primary-50 rounded-md">
//                     <FileText className="h-5 w-5 text-primary-500" />
//                   </div>
//                   <div>
//                     <p className="text-sm font-medium">{pdfFile.fileName}</p>
//                     <p className="text-xs text-gray-500">
//                       {formatBytes(pdfFile.size)}
//                     </p>
//                   </div>
//                 </div>
//                 <div className="flex gap-2">
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => setShowPdfPreview(true)}
//                     className="text-primary-500"
//                   >
//                     Preview
//                   </Button>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => setPdfFile(null)}
//                   >
//                     Replace
//                   </Button>
//                 </div>
//               </div>
//             </div>
//           ) : (
//             <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center mb-6">
//               <Upload className="h-12 w-12 text-gray-400 mb-2" />
//               <p className="text-sm text-gray-500 mb-2">
//                 Upload your assignment file
//               </p>
//               <p className="text-xs text-gray-400 mb-4">
//                 PDF files only, max 10MB
//               </p>
//               <Button
//                 onClick={() => fileInputRef.current?.click()}
//                 disabled={isUploading}
//                 className="bg-primary-500 hover:bg-primary-600"
//               >
//                 {isUploading ? <DashboardLoader /> : "Select File"}
//               </Button>
//             </div>
//           )}

//           {/* Submit Button */}
//           {pdfFile && (
//             <div className="mt-4 flex justify-center">
//               <Button
//                 onClick={handleSubmit}
//                 disabled={!pdfFile || isUploading}
//                 className="px-8 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-md w-full max-w-xs"
//               >
//                 {isUploading ? <DashboardLoader /> : "Submit Assignment"}
//               </Button>
//             </div>
//           )}
//         </div>
//       )}

//       {/* Submitted State */}
//       {isSubmitted && (
//         <div className="mt-4 p-4 bg-green-50 rounded-md border border-green-200 mb-6">
//           <div className="flex items-center">
//             <Check className="h-5 w-5 text-green-500 mr-2" />
//             <p className="text-green-700 font-medium">
//               Assignment submitted successfully!
//             </p>
//           </div>
//           <p className="text-sm text-green-600 mt-2">
//             Your assignment has been submitted. You can view your submission
//             below.
//           </p>
//           {pdfFile && (
//             <div className="mt-4 p-3 bg-white rounded-md border border-gray-200">
//               <div className="flex items-center justify-between">
//                 <div className="flex items-center space-x-3">
//                   <div className="p-2 bg-primary-50 rounded-md">
//                     <FileText className="h-5 w-5 text-primary-500" />
//                   </div>
//                   <div>
//                     <p className="text-sm font-medium">{pdfFile.fileName}</p>
//                     <p className="text-xs text-gray-500">
//                       {formatBytes(pdfFile.size)}
//                     </p>
//                   </div>
//                 </div>
//                 <a
//                   href={pdfFile.fileUrl}
//                   target="_blank"
//                   rel="noopener noreferrer"
//                   className="text-primary-500 text-sm hover:underline"
//                 >
//                   View
//                 </a>
//               </div>
//             </div>
//           )}
//         </div>
//       )}

//       {/* PDF Preview Modal */}
//       {showPdfPreview && pdfFile && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
//           <div className="bg-white rounded-lg w-full max-w-5xl h-[90vh] flex flex-col">
//             <div className="flex justify-between items-center p-4 border-b">
//               <h2 className="text-lg font-semibold">{pdfFile.fileName}</h2>
//               <Button variant="ghost" onClick={() => setShowPdfPreview(false)}>
//                 Close
//               </Button>
//             </div>
//             <div className="flex-1 overflow-auto">
//               <iframe
//                 src={`${pdfFile.fileUrl}#toolbar=0`}
//                 className="w-full h-full"
//                 title="PDF Preview"
//               />
//             </div>
//             <div className="flex justify-end p-4 border-t">
//               <Button
//                 variant="outline"
//                 onClick={() => setShowPdfPreview(false)}
//                 className="mr-2"
//               >
//                 Close
//               </Button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

"use client";

import type React from "react";

import { useState, useRef } from "react";
import { Upload, File, Check, X } from "lucide-react";

interface AssignmentSlideProps {
  assignmentData: {
    parent_rich_text: {
      content: string;
    };
    text_data: {
      content: string;
    };
    live_date: string;
    end_date: string;
    re_attempt_count: number;
  };
  onUpload: (file: File) => Promise<any>;
  isUploading: boolean;
}

const AssignmentSlide = ({
  assignmentData,
  onUpload,
  isUploading,
}: AssignmentSlideProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format dates for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return dateString;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadState("idle");
      setErrorMessage("");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      const result = await onUpload(selectedFile);

      if (result.success) {
        setUploadState("success");
        setUploadedFileId(result.fileId);
      } else {
        setUploadState("error");
        setErrorMessage(result.error || "Upload failed. Please try again.");
      }
    } catch (error) {
      setUploadState("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
      console.error("Upload error:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadState("idle");
      setErrorMessage("");
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Check if assignment is active
  const now = new Date();
  const startDate = new Date(assignmentData?.live_date || "");
  const endDate = new Date(assignmentData?.end_date || "");
  const isActive = now >= startDate && now <= endDate;

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-neutral-800 mb-2">
        {assignmentData?.text_data?.content || "Assignment"}
      </h2>

      <div className="flex items-center gap-4 text-sm text-neutral-500 mb-6">
        <div>
          <span className="font-medium">Start Date:</span>{" "}
          {formatDate(assignmentData?.live_date || "")}
        </div>
        <div>
          <span className="font-medium">Due Date:</span>{" "}
          {formatDate(assignmentData?.end_date || "")}
        </div>
        <div
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {isActive ? "Active" : "Inactive"}
        </div>
      </div>

      <div className="mt-4 prose max-w-none">
        <p className="text-neutral-700">
          {assignmentData?.parent_rich_text?.content ||
            "Please complete the assignment and upload your work."}
        </p>
      </div>

      {isActive ? (
        <>
          <div
            className="mt-8 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={triggerFileInput}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-col items-center">
              {selectedFile ? (
                <>
                  <File className="h-12 w-12 text-blue-500 mb-2" />
                  <p className="text-lg font-medium text-neutral-800">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-neutral-500 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-gray-400 mb-2" />
                  {/* <p className="text-lg font-medium text-neutral-700">
                    Drag and drop your file here
                  </p>
                  <p className="text-sm text-neutral-500 mt-1">
                    or click to browse files
                  </p> */}
                </>
              )}
            </div>
          </div>

          {uploadState === "success" && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
              <Check className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-green-700">
                Assignment uploaded successfully! File ID: {uploadedFileId}
              </span>
            </div>
          )}

          {uploadState === "error" && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <X className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700">{errorMessage}</span>
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <button
              onClick={handleUpload}
              disabled={
                !selectedFile || isUploading || uploadState === "success"
              }
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                !selectedFile || isUploading || uploadState === "success"
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              {isUploading
                ? "Uploading..."
                : uploadState === "success"
                  ? "Uploaded"
                  : "Upload Assignment"}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-700">
            This assignment is not currently active. Please check back during
            the active period.
          </p>
        </div>
      )}
    </div>
  );
};

export default AssignmentSlide;
