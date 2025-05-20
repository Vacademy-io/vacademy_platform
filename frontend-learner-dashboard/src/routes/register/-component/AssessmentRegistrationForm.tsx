import { MyButton } from "@/components/design-system/button";
import { MyInput } from "@/components/design-system/input";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { VacademyLogoWeb } from "@/svgs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import {
    getOpenTestRegistrationDetails,
    handleGetParticipantsTest,
    handleGetStudentDetailsOfInstitute,
    handleGetUserId,
    handleRegisterOpenParticipant,
} from "../-services/open-registration-services";
import { Route } from "..";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { convertToLocalDateTime } from "@/constants/helper";
import { parseHtmlToString } from "@/lib/utils";
import {
    calculateTimeDifference,
    calculateTimeLeft,
    getDynamicSchema,
    getOpenRegistrationUserDetailsByEmail,
} from "../-utils/helper";
import SelectField from "@/components/design-system/select-field";
import {
    AssessmentCustomFieldOpenRegistration,
    DynamicSchemaData,
    ParticipantsDataInterface,
} from "@/types/assessment-open-registration";
import CheckEmailStatusAlertDialog from "./CheckEmailStatusAlertDialog";
import AssessmentClosedExpiredComponent from "./AssessmentClosedExpiredComponent";
import {
    getTokenDecodedData,
    getTokenFromStorage,
} from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { AxiosError } from "axios";
import { toast } from "sonner";
import AssessmentRegistrationCompleted from "./AssessmentRegistrationCompleted";

const case1 = (serverTime: number, startDate: string) => {
    const registrationStartDate: number = new Date(
        Date.parse(startDate)
    ).getTime();
    return serverTime < registrationStartDate;
};

const case2 = (serverTime: number, startDate: string, endDate: string) => {
    const registrationStartDate: number = new Date(
        Date.parse(startDate)
    ).getTime();
    const registrationEndDate: number = new Date(Date.parse(endDate)).getTime();
    return (
        registrationStartDate <= serverTime && serverTime <= registrationEndDate
    );
};

const case3 = (serverTime: number, endDate: string) => {
    const registrationEndDate: number = new Date(Date.parse(endDate)).getTime();
    return serverTime > registrationEndDate;
};

const AssessmentRegistrationForm = () => {
    const [userHasAttemptCount, setUserHasAttemptCount] = useState(false);
    const [isAlreadyLoggedIn, setIsAlreadyLoggedIn] = useState(false);
    const [userAlreadyRegistered, setUserAlreadyRegistered] = useState(false);
    const { code } = Route.useSearch();
    const { data, isLoading } = useSuspenseQuery(
        getOpenTestRegistrationDetails(code)
    );

    const serverTime = useRef(
        new Date(Date.parse(data.server_time_in_gmt)).getTime()
    );

    const [case1Status] = useState(
        case1(
            serverTime.current,
            data.assessment_public_dto.registration_open_date
        )
    );
    const [case2Status] = useState(
        case2(
            serverTime.current,
            data.assessment_public_dto.registration_open_date,
            data.assessment_public_dto.registration_close_date
        )
    );
    const [case3Status] = useState(
        case3(
            serverTime.current,
            data.assessment_public_dto.registration_close_date
        )
    );

    const [participantsDto, setParticipantsDto] =
        useState<ParticipantsDataInterface>({
            username: "",
            user_id: "",
            email: "",
            full_name: "",
            mobile_number: "",
            file_id: "",
            guardian_email: "",
            guardian_mobile_number: "",
            reattempt_count: 0,
        });
    const zodSchema = getDynamicSchema(data.assessment_custom_fields || []);
    type FormValues = z.infer<typeof zodSchema>;

    const [timeLeft, setTimeLeft] = useState(
        calculateTimeLeft(
            serverTime.current,
            convertToLocalDateTime(data.assessment_public_dto.bound_start_time)
        )
    );

    const [timeLeftForRegistrationCase1, setTimeLeftForRegistrationCase1] =
        useState(
            calculateTimeLeft(
                serverTime.current,
                convertToLocalDateTime(
                    data.assessment_public_dto.registration_open_date
                )
            )
        );

    const [timeLeftForRegistrationCase2, setTimeLeftForRegistrationCase2] =
        useState(
            calculateTimeLeft(
                serverTime.current,
                convertToLocalDateTime(
                    data.assessment_public_dto.registration_close_date
                )
            )
        );

    const formRef = useRef<HTMLDivElement>(null);
    const form = useForm<FormValues>({
        resolver: zodResolver(zodSchema),
        defaultValues: (data.assessment_custom_fields || [])
            .sort(
                (
                    a: AssessmentCustomFieldOpenRegistration,
                    b: AssessmentCustomFieldOpenRegistration
                ) => a.field_order - b.field_order
            )
            .reduce(
                (
                    defaults: Record<
                        string,
                        {
                            name: string;
                            value: string;
                            is_mandatory: boolean;
                            type: string;
                            comma_separated_options?: string[];
                        }
                    >,
                    field: AssessmentCustomFieldOpenRegistration
                ) => {
                    if (field.field_type === "dropdown") {
                        const optionsArray = field.comma_separated_options
                            ? field.comma_separated_options
                                  .split(",")
                                  .map((opt) => opt.trim())
                            : [];

                        defaults[field.field_key] = {
                            name: field.field_name,
                            value: optionsArray[0] || "",
                            is_mandatory: field.is_mandatory || false,
                            comma_separated_options: optionsArray,
                            type: field.field_type,
                        };
                    } else {
                        defaults[field.field_key] = {
                            name: field.field_name,
                            value: "",
                            is_mandatory: field.is_mandatory || false,
                            type: field.field_type,
                        };
                    }
                    return defaults;
                },
                {} as Record<
                    string,
                    {
                        name: string;
                        value: string;
                        is_mandatory: boolean;
                        type: string;
                        comma_separated_options?: string[];
                    }
                >
            ),
        mode: "onChange",
    });
    form.watch();

    const scrollToForm = () => {
        formRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleRegisterParticipant = useMutation({
        mutationFn: async ({
            assessment_custom_fields,
            institute_id,
            assessment_id,
            participantsDto,
            custom_field_request_list,
        }: {
            assessment_custom_fields: AssessmentCustomFieldOpenRegistration[];
            institute_id: string;
            assessment_id: string;
            participantsDto: ParticipantsDataInterface;
            custom_field_request_list: DynamicSchemaData;
        }) => {
            return handleRegisterOpenParticipant(
                assessment_custom_fields,
                institute_id,
                assessment_id,
                participantsDto,
                custom_field_request_list
            );
        },
        onSuccess: () => {
            toast.success("You have been registered successfully!");
        },
        onError: (error: unknown) => {
            if (error instanceof AxiosError) {
                toast.error(error.message, {
                    className: "error-toast",
                    duration: 2000,
                });
            } else {
                console.error("Unexpected error:", error);
            }
        },
    });

    const handleGetUserIdMutation = useMutation({
        mutationFn: async ({
            institute_id,
            custom_field_request_list,
        }: {
            institute_id: string;
            custom_field_request_list: DynamicSchemaData;
        }) => {
            return handleGetUserId(institute_id, custom_field_request_list);
        },
        onSuccess: async (response) => {
            const participantsData = {
                username: response.username,
                user_id: response.user_id,
                email: response.email,
                full_name: response.full_name,
                mobile_number: response.mobile_number,
                file_id: response.face_file_id,
                guardian_email: response.parents_email,
                guardian_mobile_number: response.parents_mobile_number,
                reattempt_count: 1,
            };
            const registerParticipant = await handleRegisterOpenParticipant(
                data.assessment_custom_fields,
                data.institute_id,
                data.assessment_public_dto.assessment_id,
                participantsData,
                form.getValues()
            );
            if (registerParticipant.status === 200) {
                toast.success("You have been registered successfully!");
            }
        },
        onError: (error: unknown) => {
            if (error instanceof AxiosError) {
                toast.error(error.message, {
                    className: "error-toast",
                    duration: 2000,
                });
            } else {
                console.error("Unexpected error:", error);
            }
        },
    });

    function onSubmit(values: FormValues) {
        if (userAlreadyRegistered) {
            handleGetUserIdMutation.mutate({
                institute_id: data.institute_id,
                custom_field_request_list: values,
            });
        } else {
            handleRegisterParticipant.mutate({
                assessment_custom_fields: data.assessment_custom_fields,
                institute_id: data.institute_id,
                assessment_id: data.assessment_public_dto.assessment_id,
                participantsDto,
                custom_field_request_list: values,
            });
        }
    }

    const onInvalid = (err: unknown) => {
        console.error(err);
    };

    useEffect(() => {
        const timer = setInterval(() => {
            serverTime.current = serverTime.current + 1000;
        }, 1000);

        return () => clearInterval(timer);
    }, []); // Empty dependency array ensures it only runs once

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(
                calculateTimeLeft(
                    serverTime.current,
                    convertToLocalDateTime(
                        data.assessment_public_dto.bound_start_time
                    )
                )
            );
        }, 1000);

        return () => clearInterval(timer);
    }, [data.assessment_public_dto.bound_start_time]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeftForRegistrationCase1(
                calculateTimeLeft(
                    serverTime.current,
                    convertToLocalDateTime(
                        data.assessment_public_dto.registration_open_date
                    )
                )
            );
        }, 1000);

        return () => clearInterval(timer);
    }, [data.assessment_public_dto.registration_open_date]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeftForRegistrationCase2(
                calculateTimeLeft(
                    serverTime.current,
                    convertToLocalDateTime(
                        data.assessment_public_dto.registration_close_date
                    )
                )
            );
        }, 1000);

        return () => clearInterval(timer);
    }, [data.assessment_public_dto.registration_close_date]);

    useEffect(() => {
        const fetchToken = async () => {
            const accessToken = await getTokenFromStorage(TokenKey.accessToken);
            if (accessToken) {
                const decodedData = getTokenDecodedData(accessToken);
                const userId = decodedData?.user;
                const assessmentId = data.assessment_public_dto.assessment_id;
                const instituteId = data.institute_id;
                const getAllStudentDetails =
                    await handleGetStudentDetailsOfInstitute(instituteId);
                const userDetails = getOpenRegistrationUserDetailsByEmail(
                    getAllStudentDetails,
                    decodedData?.email
                );
                const psIds = userDetails?.package_session_id;
                const getTestDetailsOfParticipants =
                    await handleGetParticipantsTest(
                        assessmentId,
                        instituteId,
                        userId,
                        psIds
                    );
                if (
                    getTestDetailsOfParticipants.is_already_registered &&
                    getTestDetailsOfParticipants.remaining_attempts > 0
                ) {
                    setIsAlreadyLoggedIn(true);
                }
            }
        };

        fetchToken();
    }, []);

    if (isLoading) return <DashboardLoader />;

    if (
        userAlreadyRegistered &&
        case3Status &&
        calculateTimeDifference(
            serverTime.current,
            data.assessment_public_dto.bound_end_time
        )
    )
        return (
            <AssessmentClosedExpiredComponent
                isExpired={false}
                assessmentName={data.assessment_public_dto.assessment_name}
            />
        );

    if (
        userAlreadyRegistered &&
        case3Status &&
        !calculateTimeDifference(
            serverTime.current,
            data.assessment_public_dto.bound_end_time
        )
    )
        return (
            <AssessmentClosedExpiredComponent
                isExpired={true}
                assessmentName={data.assessment_public_dto.assessment_name}
            />
        );

    if (
        (handleRegisterParticipant.status === "success" ||
            handleGetUserIdMutation.status === "success" ||
            isAlreadyLoggedIn) &&
        case2Status
    )
        return (
            <AssessmentRegistrationCompleted
                assessmentName={data.assessment_public_dto.assessment_name}
                timeLeft={timeLeft}
            />
        );

    return (
        <>
            {case1Status && (
                <div className="flex justify-center items-center w-full mt-4">
                    <div className="flex flex-col w-full sm:w-3/4 items-center justify-center gap-6">
                        <VacademyLogoWeb />
                        <h1 className="-mt-12 text-md sm:text-xl whitespace-normal sm:whitespace-nowrap p-4 sm:p-0 text-center">
                            {data?.assessment_public_dto?.assessment_name}
                        </h1>
                        <div className="flex items-center gap-4 text-sm flex-col ">
                            <span>Registration goes live in</span>
                            <span className="font-thin">
                                {timeLeftForRegistrationCase1.hours} hrs :{" "}
                                {timeLeftForRegistrationCase1.minutes} min :{" "}
                                {timeLeftForRegistrationCase1.seconds} sec
                            </span>
                        </div>
                        <Separator />
                        <h1 className="text-sm font-thin">
                            Important Dates - Mark Your Calendar!
                        </h1>
                        <div className="text-sm flex flex-col gap-4 px-4">
                            <div className="flex flex-col">
                                <h1>Registration Window:</h1>
                                <span className="font-thin">
                                    Opens:{" "}
                                    {convertToLocalDateTime(
                                        data.assessment_public_dto
                                            .registration_open_date
                                    )}
                                </span>
                                <span className="font-thin">
                                    Closes:{" "}
                                    {convertToLocalDateTime(
                                        data.assessment_public_dto
                                            .registration_close_date
                                    )}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <h1>Assessment Live Dates</h1>
                                <span className="font-thin">
                                    Starts:{" "}
                                    {convertToLocalDateTime(
                                        data.assessment_public_dto
                                            .bound_start_time
                                    )}
                                </span>
                                <span className="font-thin">
                                    Ends:{" "}
                                    {convertToLocalDateTime(
                                        data.assessment_public_dto
                                            .bound_end_time
                                    )}
                                </span>
                            </div>
                            {data.assessment_public_dto.about.content && (
                                <div className="flex flex-col">
                                    <h1>About Assessment</h1>
                                    <span className="font-thin">
                                        {parseHtmlToString(
                                            data.assessment_public_dto.about
                                                .content
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {(case2Status ||
                case3Status ||
                data.error_message === "Assessment is Private") && (
                <CheckEmailStatusAlertDialog
                    timeLeft={timeLeft}
                    registrationData={data}
                    registrationForm={form}
                    setParticipantsDto={setParticipantsDto}
                    userAlreadyRegistered={userAlreadyRegistered}
                    setUserAlreadyRegistered={setUserAlreadyRegistered}
                    userHasAttemptCount={userHasAttemptCount}
                    setUserHasAttemptCount={setUserHasAttemptCount}
                    case3Status={case3Status}
                    serverTime={serverTime.current}
                />
            )}
            {!userHasAttemptCount && case2Status && (
                <div className="flex w-full items-center justify-center bg-[linear-gradient(180deg,#FFF9F4_0%,#E6E6FA_100%)] gap-8 flex-col sm:flex-row">
                    <div className="flex justify-center items-center w-full mt-4">
                        <div className="flex flex-col w-full sm:w-3/4 items-center justify-center gap-6">
                            <VacademyLogoWeb />
                            <h1 className="-mt-12 text-md sm:text-xl whitespace-normal sm:whitespace-nowrap p-4 sm:p-0 text-center">
                                {data?.assessment_public_dto?.assessment_name}
                            </h1>
                            <div className="flex items-center gap-4 text-sm flex-col sm:flex-row">
                                <MyButton
                                    type="button"
                                    buttonType="primary"
                                    scale="large"
                                    layoutVariant="default"
                                    className="block sm:hidden"
                                    onClick={scrollToForm}
                                >
                                    Register Now!
                                </MyButton>
                                {(timeLeftForRegistrationCase2.hours > 0 ||
                                    timeLeftForRegistrationCase2.minutes > 0 ||
                                    timeLeftForRegistrationCase2.seconds >
                                        0) && (
                                    <span className="font-thin">
                                        {timeLeftForRegistrationCase2.hours} hrs
                                        : {timeLeftForRegistrationCase2.minutes}{" "}
                                        min :{" "}
                                        {timeLeftForRegistrationCase2.seconds}{" "}
                                        sec
                                    </span>
                                )}
                            </div>
                            <Separator />
                            <h1 className="text-sm font-thin">
                                Important Dates - Mark Your Calendar!
                            </h1>
                            <div className="text-sm flex flex-col gap-4 px-4">
                                <div className="flex flex-col">
                                    <h1>Registration Window:</h1>
                                    <span className="font-thin">
                                        Opens:{" "}
                                        {convertToLocalDateTime(
                                            data.assessment_public_dto
                                                .registration_open_date
                                        )}
                                    </span>
                                    <span className="font-thin">
                                        Closes:{" "}
                                        {convertToLocalDateTime(
                                            data.assessment_public_dto
                                                .registration_close_date
                                        )}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <h1>Assessment Live Dates</h1>
                                    <span className="font-thin">
                                        Starts:{" "}
                                        {convertToLocalDateTime(
                                            data.assessment_public_dto
                                                .bound_start_time
                                        )}
                                    </span>
                                    <span className="font-thin">
                                        Ends:{" "}
                                        {convertToLocalDateTime(
                                            data.assessment_public_dto
                                                .bound_end_time
                                        )}
                                    </span>
                                </div>
                                {data.assessment_public_dto.about.content && (
                                    <div className="flex flex-col">
                                        <h1>About Assessment</h1>
                                        <span className="font-thin">
                                            {parseHtmlToString(
                                                data.assessment_public_dto.about
                                                    .content
                                            )}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <Separator className="block sm:hidden mx-4" />
                    <div
                        className="flex justify-center items-center w-full"
                        ref={formRef}
                    >
                        <div className="flex justify-center items-start w-full  sm:w-3/4 flex-col bg-white rounded-xl p-4 shadow-md mx-4 mb-4">
                            <h1>Assessment Registration Form</h1>
                            <span className="text-sm text-neutral-500">
                                Register for the assessment by completing the
                                details below.
                            </span>
                            <FormProvider {...form}>
                                <form className="w-full flex flex-col gap-6 mt-4 sm:max-h-[70vh] sm:overflow-auto">
                                    {Object.entries(form.getValues()).map(
                                        ([key, value]) => (
                                            <FormField
                                                key={key}
                                                control={form.control}
                                                name={`${key}.value`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            {value.type ===
                                                            "dropdown" ? (
                                                                <SelectField
                                                                    label={
                                                                        value.name
                                                                    }
                                                                    name={`${key}.value`}
                                                                    options={
                                                                        value.comma_separated_options?.map(
                                                                            (
                                                                                option: string,
                                                                                index: number
                                                                            ) => ({
                                                                                value: option,
                                                                                label: option,
                                                                                _id: index,
                                                                            })
                                                                        ) || []
                                                                    }
                                                                    control={
                                                                        form.control
                                                                    }
                                                                    required={
                                                                        value.is_mandatory
                                                                    }
                                                                    className="!w-full"
                                                                />
                                                            ) : (
                                                                <MyInput
                                                                    inputType="text"
                                                                    inputPlaceholder={
                                                                        value.name
                                                                    }
                                                                    input={
                                                                        field.value
                                                                    }
                                                                    onChangeFunction={
                                                                        field.onChange
                                                                    }
                                                                    required={
                                                                        value.is_mandatory
                                                                    }
                                                                    size="large"
                                                                    label={
                                                                        value.name
                                                                    }
                                                                    className="!max-w-full !w-full"
                                                                />
                                                            )}
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        )
                                    )}
                                    <div className="flex items-center justify-center flex-col gap-4">
                                        <MyButton
                                            type="button"
                                            buttonType="primary"
                                            scale="large"
                                            layoutVariant="default"
                                            onClick={form.handleSubmit(
                                                onSubmit,
                                                onInvalid
                                            )}
                                        >
                                            Register
                                        </MyButton>
                                        <p
                                            className="border-none !text-primary-500 !text-sm mb-2 cursor-pointer"
                                            onClick={() => form.reset()}
                                        >
                                            Reset Form
                                        </p>
                                    </div>
                                </form>
                            </FormProvider>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AssessmentRegistrationForm;
