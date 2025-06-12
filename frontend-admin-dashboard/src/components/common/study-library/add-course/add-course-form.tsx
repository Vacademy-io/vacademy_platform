// add-course-form.tsx
import { SubjectDefaultImage } from "@/assets/svgs";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { MyButton } from "@/components/design-system/button";
import { FileUploadComponent } from "@/components/design-system/file-upload";
import { MyInput } from "@/components/design-system/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { TokenKey } from "@/constants/auth/tokens";
import { useFileUpload } from "@/hooks/use-file-upload";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { useInstituteDetailsStore } from "@/stores/students/students-list/useInstituteDetailsStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { DotsThree } from "@phosphor-icons/react";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AddLevelInput } from "../../../design-system/add-level-input";
import { AddSessionInput } from "../../../design-system/add-session-input";
import { LevelInSessionField } from "./level-field";
import { SessionType } from "@/schemas/student/student-list/institute-schema";
// import { CourseInfoDialog } from "./course-info-dialog";
import getExplanation from "../-utils/getExplanation";

// Updated Session interface with levels array
export interface Session {
    id: string;
    session_name: string;
    status: string;
    start_date?: string;
    new_session?: boolean;
    levels: Level[]; // Add levels array to sessions
}

// Update Level interface (remove sessions)
export interface Level {
    id: string;
    level_name: string;
    duration_in_days: number | null;
    thumbnail_id: string | null;
    new_level?: boolean;
}

// Update CourseFormData
export interface CourseFormData {
    course_name: string;
    id?: string;
    thumbnail_file_id?: string;
    contain_levels?: boolean;
    status?: string;
    sessions?: Session[]; // Changed from levels to sessions at top level
}

// Update the form schema
const formSchema = z.object({
    id: z.string().optional(),
    course_name: z.string(),
    thumbnail_file_id: z.string().optional(),
    contain_levels: z.boolean().optional(),
    status: z.string().optional(),
    new_course: z.boolean().optional(),
    sessions: z
        .array(
            z.object({
                id: z.string(),
                new_session: z.boolean().optional(),
                session_name: z.string(),
                status: z.string(),
                start_date: z.string().optional(),
                levels: z.array(
                    z.object({
                        id: z.string(),
                        new_level: z.boolean().optional(),
                        level_name: z.string(),
                        duration_in_days: z.number().nullable(),
                        thumbnail_id: z.string().nullable(),
                    }),
                ),
            }),
        )
        .optional(),
});

export type AddCourseData = z.infer<typeof formSchema>;

interface AddCourseFormProps {
    initialValues?: AddCourseData;
    onSubmitCourse: ({
        courseId,
        requestData,
    }: {
        courseId?: string;
        requestData: AddCourseData;
    }) => void;
    setOpenDialog: Dispatch<SetStateAction<boolean>>;
    setDisableAddButton: Dispatch<SetStateAction<boolean>>;
    submitForm?: (submitFn: () => void) => void;
}

export function convertToFormSession(session: SessionType): Session {
    return {
        ...session,
        new_session: false,
        levels: [],
    };
}

export const AddCourseForm = ({
    initialValues,
    onSubmitCourse,
    setOpenDialog,
    setDisableAddButton,
    submitForm,
}: AddCourseFormProps) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    const [isUploading, setIsUploading] = useState(false);
    const { uploadFile, getPublicUrl, isUploading: isUploadingFile } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileId, setFileId] = useState<string | undefined>(
        initialValues?.thumbnail_file_id || undefined,
    );
    const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
    const [newLevelName, setNewLevelName] = useState("");
    const [newSessionName, setNewSessionName] = useState("");

    const { instituteDetails, getAllSessions, getLevelsFromPackage2 } = useInstituteDetailsStore();
    // At the top with other state variables
    const [locallyAddedLevels, setLocallyAddedLevels] = useState<Record<string, Level[]>>({});

    // Update the handleAddLevel function
    const handleAddLevel = (
        levelName: string,
        durationInDays: number | null,
        sessionId: string,
    ) => {
        const newLevel: Level = {
            id: "", // Use temporary ID for new levels
            new_level: true,
            level_name: levelName,
            duration_in_days: durationInDays,
            thumbnail_id: null,
        };

        // Add to locally tracked levels for this session
        setLocallyAddedLevels((prev) => ({
            ...prev,
            [sessionId]: [...(prev[sessionId] || []), newLevel],
        }));

        // Update form sessions value if the session is already selected
        const currentSessions = form.getValues("sessions") || [];
        const sessionIndex = currentSessions.findIndex((s) => s.id === sessionId);

        if (sessionIndex !== -1) {
            // Session exists in form value, add the new level to it
            const updatedSessions = [...currentSessions];
            const currentSession = updatedSessions[sessionIndex];

            if (currentSession) {
                currentSession.levels = [...(currentSession.levels || []), newLevel];
            }

            form.setValue("sessions", updatedSessions);
        }

        // Reset inputs
        setNewLevelName("");
        setNewLevelDuration(null);
    };
    const [sessionList, setSessionList] = useState<Session[]>([]);
    // Then in useEffect:
    useEffect(() => {
        setSessionList(getAllSessions().map((session) => convertToFormSession(session)));
    }, [instituteDetails]);
    const [newLevelDuration, setNewLevelDuration] = useState<number | null>(null);
    const [newSessionStartDate, setNewSessionStartDate] = useState<string>("");

    // In the form initialization
    const form = useForm<AddCourseData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: initialValues?.id || "",
            course_name: initialValues?.course_name || "",
            thumbnail_file_id: initialValues?.thumbnail_file_id || fileId,
            contain_levels: initialValues?.contain_levels || true,
            status: initialValues?.status || "ACTIVE",
            new_course: initialValues?.new_course || true,
            sessions: [], // Changed from levels to sessions
        },
    });

    const handleAddSession = (sessionName: string, startDate: string) => {
        const newSession: Session = {
            id: "",
            new_session: true,
            session_name: sessionName,
            status: "INACTIVE",
            start_date: startDate,
            levels: [], // Initialize with empty levels array
        };
        setSessionList((prevSessionList) => [...prevSessionList, newSession]);
    };

    useEffect(() => {
        const fetchImageUrl = async () => {
            if (initialValues?.thumbnail_file_id) {
                try {
                    const url = await getPublicUrl(initialValues?.thumbnail_file_id);
                    setFileId(url);
                } catch (error) {
                    console.error("Failed to fetch image URL:", error);
                }
            }
        };

        fetchImageUrl();
    }, [initialValues?.thumbnail_file_id]);

    const handleFileSubmit = async (file: File) => {
        try {
            setIsUploading(true);
            const uploadedFileId = await uploadFile({
                file,
                setIsUploading,
                userId: "your-user-id",
                source: INSTITUTE_ID,
                sourceId: "SUBJECTS",
            });

            if (uploadedFileId) {
                setFileId(uploadedFileId);
                // Get public URL only for preview purposes
                form.setValue("thumbnail_file_id", uploadedFileId);
                const publicUrl = await getPublicUrl(uploadedFileId);
                setPreviewUrl(publicUrl);
            }
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            setIsUploading(false);
        }
    };

    const onSubmit = (data: AddCourseData) => {
        console.log("Complete form data:", JSON.stringify(data, null, 2));
        // Filter out any sessions that might have no levels
        const filteredSessions =
            data.sessions?.filter((session) => session.levels && session.levels.length > 0) || [];

        const submissionData = {
            ...data,
            status: "ACTIVE",
            sessions: filteredSessions,
        };

        onSubmitCourse({ courseId: submissionData.id, requestData: submissionData });
        setOpenDialog(false);
    };

    const containLevels = form.watch("contain_levels");

    useEffect(() => {
        const containsLevelValue = form.getValues("contain_levels");
        const sessionValue = form.getValues("sessions");
        const courseName = form.getValues("course_name");

        if (courseName === "") {
            // Always disable if course name is empty
            setDisableAddButton(true);
        } else if (containsLevelValue === true && !initialValues) {
            // Only check for sessions if "Contains Levels" is true
            if (!sessionValue || sessionValue.length === 0) {
                setDisableAddButton(true);
            } else {
                setDisableAddButton(false);
            }
        } else {
            // If "Contains Levels" is false, only require course name
            setDisableAddButton(false);
        }
    }, [form.watch("sessions"), form.watch("course_name"), form.watch("contain_levels")]);

    // Add this line to create a form ref
    const formRef = useRef<HTMLFormElement>(null);

    // Add this method to expose form submission

    useEffect(() => {
        if (submitForm) {
            submitForm(() => {
                if (formRef.current) {
                    formRef.current.requestSubmit();
                }
            });
        }
    }, [submitForm]);

    const explanation = getExplanation(instituteDetails?.type);

    return (
        <Form {...form}>
            <form
                ref={formRef}
                onSubmit={(e) => {
                    form.handleSubmit(onSubmit)(e);
                }}
                className="flex max-h-[80vh] flex-col gap-8 p-2 text-neutral-600"
            >
                <div className="flex justify-between">
                    <div className="flex w-full flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-subtitle">
                                Course<span className="text-primary-500">*</span>
                            </p>
                            <div className="flex flex-col gap-1">
                                <p className="text-caption text-neutral-500">
                                    {explanation.course}
                                </p>
                                <p className="text-caption text-neutral-400">
                                    {explanation.courseExamples}
                                </p>
                            </div>
                        </div>
                        <FormField
                            control={form.control}
                            name="course_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <MyInput
                                            id="course-name"
                                            required={true}
                                            inputType="text"
                                            inputPlaceholder="Enter course name"
                                            className="w-full"
                                            input={field.value}
                                            onChangeFunction={(e) => field.onChange(e.target.value)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    {/* <CourseInfoDialog /> */}
                </div>

                <div className={`relative flex w-full flex-col items-center justify-center gap-3`}>
                    {isUploading ? (
                        <div className="inset-0 flex size-[200px] items-center justify-center bg-white">
                            <DashboardLoader />
                        </div>
                    ) : previewUrl || fileId ? (
                        <img
                            src={previewUrl ? previewUrl : fileId}
                            alt="Subject"
                            className="size-[200px] rounded-lg object-cover"
                        />
                    ) : (
                        <SubjectDefaultImage />
                    )}
                    <FileUploadComponent
                        fileInputRef={fileInputRef}
                        onFileSubmit={handleFileSubmit}
                        control={form.control}
                        name="thumbnail_file_id"
                        acceptedFileTypes="image/*"
                    />
                    <div
                        className={`flex w-full flex-col items-center gap-3 ${
                            isUploading ? "hidden" : "visible"
                        }`}
                    >
                        <MyButton
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading || isUploadingFile}
                            buttonType="secondary"
                            layoutVariant="default"
                            scale="large"
                            id={"course-thumbnail"}
                            type="button"
                        >
                            Upload Image
                        </MyButton>
                    </div>
                </div>

                <Separator />

                {!initialValues && (
                    <div className="flex w-full flex-col gap-3" id="course-level">
                        <FormField
                            control={form.control}
                            name="contain_levels"
                            render={({ field }) => (
                                <FormItem className={`flex flex-col gap-2 space-y-2`}>
                                    <label className="flex flex-col gap-1 text-subtitle font-semibold">
                                        <p>Contain Levels?</p>
                                        <div className="flex flex-col gap-1">
                                            <p className="text-caption text-neutral-500">
                                                {explanation.level}
                                            </p>
                                            <p className="text-caption text-neutral-400">
                                                {explanation.levelExamples}
                                            </p>
                                        </div>
                                    </label>
                                    <FormControl>
                                        <RadioGroup
                                            value={field.value ? "true" : "false"}
                                            onValueChange={(value) =>
                                                field.onChange(value === "true")
                                            }
                                            className="flex gap-8"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem
                                                    value="true"
                                                    id="contain_levels_true"
                                                />
                                                <label
                                                    htmlFor="contain_levels_true"
                                                    className="text-sm"
                                                >
                                                    Yes
                                                </label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem
                                                    value="false"
                                                    id="contain_levels_false"
                                                />
                                                <label
                                                    htmlFor="contain_levels_false"
                                                    className="text-sm"
                                                >
                                                    No
                                                </label>
                                            </div>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}

                {containLevels && !initialValues && (
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                            <p className="text-subtitle">Select levels within Sessions</p>
                            <div className="flex flex-col gap-1">
                                <p className="text-caption text-neutral-500">
                                    Session: {explanation.session}
                                </p>
                                <p className="text-caption text-neutral-400">
                                    {explanation.sessionExamples}
                                </p>
                            </div>
                        </div>
                        <FormField
                            control={form.control}
                            name="sessions"
                            render={({ field }) => (
                                <FormItem className="w-full">
                                    <FormControl>
                                        <div className="flex flex-col gap-4">
                                            {sessionList.map((session) => {
                                                const isSessionSelected = (field.value || []).some(
                                                    (s) => s.id === session.id,
                                                );
                                                return (
                                                    <div key={session.id}>
                                                        <div
                                                            className={`rounded-lg border border-neutral-200 py-2 ${
                                                                isSessionSelected
                                                                    ? "bg-neutral-100"
                                                                    : "bg-none"
                                                            }`}
                                                        >
                                                            <div className="flex w-full items-center justify-between p-4 pr-8">
                                                                {/* Replace LevelField with SessionField component */}
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex flex-col items-start">
                                                                            <p className="text-subtitle font-semibold">
                                                                                {
                                                                                    session.session_name
                                                                                }
                                                                            </p>
                                                                            <p className="text-caption text-neutral-400">
                                                                                {session.start_date ||
                                                                                    new Date().toISOString()}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <MyButton
                                                                        buttonType="secondary"
                                                                        layoutVariant="icon"
                                                                        scale="small"
                                                                        type="button"
                                                                    >
                                                                        <DotsThree />
                                                                    </MyButton>
                                                                </div>
                                                            </div>
                                                            <div className="ml-4 mr-6 mt-2">
                                                                <div>
                                                                    <Separator />
                                                                </div>
                                                                <div
                                                                    className="grid grid-cols-2 gap-4"
                                                                    id="add-course-level"
                                                                >
                                                                    {getLevelsFromPackage2({
                                                                        sessionId: session.id,
                                                                    }).map((level) => (
                                                                        /* Create new LevelInSessionField component */
                                                                        <LevelInSessionField
                                                                            key={level.id}
                                                                            level={level}
                                                                            session={session}
                                                                            field={field}
                                                                        />
                                                                    ))}
                                                                    {(
                                                                        locallyAddedLevels[
                                                                            session.id
                                                                        ] || []
                                                                    ).map((level) => (
                                                                        <LevelInSessionField
                                                                            key={level.id}
                                                                            level={level}
                                                                            session={session}
                                                                            field={field}
                                                                        />
                                                                    ))}
                                                                    <AddLevelInput
                                                                        newLevelName={newLevelName}
                                                                        setNewLevelName={
                                                                            setNewLevelName
                                                                        }
                                                                        newLevelDuration={
                                                                            newLevelDuration
                                                                        }
                                                                        setNewLevelDuration={
                                                                            setNewLevelDuration
                                                                        }
                                                                        handleAddLevel={(
                                                                            name,
                                                                            duration,
                                                                        ) =>
                                                                            handleAddLevel(
                                                                                name,
                                                                                duration,
                                                                                session.id,
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div id="add-course-session">
                                                <AddSessionInput
                                                    newSessionName={newSessionName}
                                                    setNewSessionName={setNewSessionName}
                                                    newSessionStartDate={newSessionStartDate}
                                                    setNewSessionStartDate={setNewSessionStartDate}
                                                    handleAddSession={handleAddSession}
                                                />
                                            </div>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}
            </form>
        </Form>
    );
};
