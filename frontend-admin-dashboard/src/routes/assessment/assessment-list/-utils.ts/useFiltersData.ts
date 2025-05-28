import { useMemo } from "react";
import { InstituteDetailsType } from "@/schemas/student/student-list/institute-schema";
import { AssessmentDetailsType } from "@/schemas/assessment/assessment-schema";

export const useFilterDataForAssesment = (initData: InstituteDetailsType) => {
    const BatchesFilterData = useMemo(() => {
        return (
            initData?.batches_for_sessions
                ?.map((item) => ({
                    id: String(item.id),
                    name: `${item.level.level_name} ${item.package_dto.package_name}`,
                }))
                .sort((a, b) => Number(a.id) - Number(b.id)) || []
        );
    }, [initData]);

    const SubjectFilterData = useMemo(() => {
        return (
            initData?.subjects?.map((subject) => ({
                id: subject.id,
                name: subject.subject_name,
            })) || []
        );
    }, [initData]);

    const YearClassFilterData = useMemo(() => {
        return (
            initData?.levels?.map((level) => ({
                id: level.id,
                name: level.level_name,
            })) || []
        );
    }, [initData]);

    return {
        BatchesFilterData,
        SubjectFilterData,

        YearClassFilterData,
    };
};

export const useFilterDataForAssesmentInitData = (initData: AssessmentDetailsType) => {
    const AssessmentTypeData = useMemo(() => {
        return (
            initData?.assessment_access_statuses?.map((data, idx) => ({
                id: String(idx),
                name: data,
            })) || []
        );
    }, [initData]);

    const ModeData = useMemo(() => {
        return (
            initData?.assessment_mode_types?.map((data, idx) => ({
                id: String(idx),
                name: data,
            })) || []
        );
    }, [initData]);

    const AssessmentStatusData = useMemo(() => {
        return (
            initData?.assessment_statuses?.map((data, idx) => ({
                id: String(idx),
                name: data,
            })) || []
        );
    }, [initData]);

    const EvaluationTypeData = useMemo(() => {
        return (
            initData?.evaluation_types?.map((data) => ({
                id: String(data),
                name: data,
            })) || []
        );
    }, [initData]);
    return {
        AssessmentTypeData,
        AssessmentStatusData,
        ModeData,
        EvaluationTypeData,
    };
};
