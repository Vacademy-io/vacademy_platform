import { getInstituteId } from '@/constants/helper';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useEffect, useRef, useState } from 'react';
import {
    handleGenerateAssessmentImage,
    handleStartProcessUploadedFile,
} from '@/routes/ai-center/-services/ai-center-service';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GenerateCard } from '@/routes/ai-center/-components/GenerateCard';
import { useAICenter } from '@/routes/ai-center/-contexts/useAICenterContext';
import AITasksList from '@/routes/ai-center/-components/AITasksList';
import { jsPDF } from 'jspdf';
import { UseFormReturn } from 'react-hook-form';
import { SectionFormType } from '@/types/assessments/assessment-steps';

interface ConvertImageToPDFResult {
    pdfFile: File;
    pdfBlob: Blob;
}

const convertImageToPDF = async (file: File): Promise<ConvertImageToPDFResult> => {
    return new Promise<ConvertImageToPDFResult>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const img = new Image();
                img.onload = () => {
                    const pdf = new jsPDF({
                        orientation: img.width > img.height ? 'landscape' : 'portrait',
                        unit: 'mm',
                        format: 'a4',
                    });

                    // Calculate dimensions to fit the page while maintaining aspect ratio
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    const imgRatio = img.width / img.height;
                    let imgWidth = pageWidth;
                    let imgHeight = pageWidth / imgRatio;

                    if (imgHeight > pageHeight) {
                        imgHeight = pageHeight;
                        imgWidth = pageHeight * imgRatio;
                    }

                    // Center the image on the page
                    const x = (pageWidth - imgWidth) / 2;
                    const y = (pageHeight - imgHeight) / 2;

                    pdf.addImage(img, 'JPEG', x, y, imgWidth, imgHeight);

                    // Convert PDF to blob and then to File
                    const pdfBlob = pdf.output('blob');
                    const pdfFile = new File(
                        [pdfBlob],
                        `${file.name.replace(/\.[^/.]+$/, '')}.pdf`,
                        {
                            type: 'application/pdf',
                        }
                    );

                    resolve({ pdfFile, pdfBlob });
                };
                img.onerror = reject;
                img.src = e.target?.result as string;
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const GenerateAiQuestionFromImageComponent = ({
    form,
    currentSectionIndex,
}: {
    form?: UseFormReturn<SectionFormType>;
    currentSectionIndex?: number;
}) => {
    const queryClient = useQueryClient();
    const [taskName, setTaskName] = useState('');
    const instituteId = getInstituteId();
    const { uploadFile } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const { setLoader, key, setKey } = useAICenter();
    const [fileUploading, setFileUploading] = useState(false);

    const handleUploadClick = () => {
        setKey('image');
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const { pdfFile } = await convertImageToPDF(file);
                console.log('PDF file created:', pdfFile);

                const response1 = await uploadFile({
                    file: pdfFile,
                    setIsUploading: setFileUploading,
                    userId: 'your-user-id',
                    source: instituteId,
                    sourceId: 'STUDENTS',
                });
                console.log('Upload response:', response1);

                if (response1) {
                    try {
                        const response = await handleStartProcessUploadedFile(response1);
                        console.log('Process response:', response);

                        if (response) {
                            generateAssessmentMutation.mutate({
                                pdfId: response.pdf_id,
                                userPrompt: '',
                                taskName,
                                taskId: '',
                            });
                        }
                    } catch (processError) {
                        console.error('Error in handleStartProcessUploadedFile:', processError);
                    }
                }
            } catch (error) {
                console.error('Error in file processing:', error);
            }
            event.target.value = '';
        }
    };

    const generateAssessmentMutation = useMutation({
        mutationFn: ({
            pdfId,
            userPrompt,
            taskName,
            taskId,
        }: {
            pdfId: string;
            userPrompt: string;
            taskName: string;
            taskId: string;
        }) => {
            setLoader(true);
            setKey('image');
            return handleGenerateAssessmentImage(pdfId, userPrompt, taskName, taskId);
        },
        onSuccess: () => {
            setLoader(false);
            setKey(null);
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['GET_INDIVIDUAL_AI_LIST_DATA'] });
            }, 100);
        },
        onError: () => {
            setLoader(false);
            setKey(null);
        },
    });

    useEffect(() => {
        if (key === 'image') {
            if (fileUploading == true) setLoader(true);
        }
    }, [fileUploading, key]);

    return (
        <>
            <GenerateCard
                handleUploadClick={handleUploadClick}
                fileInputRef={fileInputRef}
                handleFileChange={handleFileChange}
                cardTitle="Extract Questions from Image"
                cardDescription="Upload JPG/JPEG/PNG"
                inputFormat=".jpg,.jpeg,.png"
                keyProp="image"
                taskName={taskName}
                setTaskName={setTaskName}
                sectionsForm={form}
                currentSectionIndex={currentSectionIndex}
            />
            {generateAssessmentMutation.status === 'success' && (
                <AITasksList
                    heading="Vsmart Image"
                    enableDialog={true}
                    sectionsForm={form}
                    currentSectionIndex={currentSectionIndex}
                />
            )}
        </>
    );
};

export default GenerateAiQuestionFromImageComponent;
