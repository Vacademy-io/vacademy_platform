import { MyButton } from "@/components/design-system/button";
import { MyDialog } from "@/components/design-system/dialog";
import React, { useRef, useState } from "react";
import { Plus } from "phosphor-react";
import { AddCourseData, AddCourseForm } from "./add-course-form";
import useIntroJsTour from "@/hooks/use-intro";
import { StudyLibraryIntroKey } from "@/constants/storage/introKey";
import { addCourseStep } from "@/constants/intro/steps";

const triggerButton = (
    <MyButton buttonType="primary" layoutVariant="default" scale="large" id="create-new-course">
        <Plus />
        Create Course
    </MyButton>
);

interface AddCourseButtonProps {
    onSubmit: ({ requestData }: { requestData: AddCourseData }) => void;
    courseButton?: JSX.Element;
}

export const AddCourseButton = ({ onSubmit, courseButton }: AddCourseButtonProps) => {
    const [openDialog, setOpenDialog] = useState(false);
    const [disableAddButton, setDisableAddButton] = useState(false);
    const formSubmitRef = useRef<() => void>(() => {});

    const handleOpenChange = (open: boolean) => {
        setOpenDialog(open);
    };

    // Don't use the div wrapper approach
    const triggerWithPreventSubmit = courseButton
        ? React.cloneElement(courseButton, {
              onClick: (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenDialog(true);

                  // Call the original onClick if it exists
                  if (courseButton.props.onClick) {
                      courseButton.props.onClick(e);
                  }
              },
          })
        : triggerButton;

    const submitButton = (
        <div className="items-center justify-center bg-white">
            <MyButton
                onClick={() => formSubmitRef.current()}
                type="button"
                buttonType="primary"
                layoutVariant="default"
                scale="large"
                id="add-course-button"
                className="w-[140px]"
                disable={disableAddButton}
            >
                Add
            </MyButton>
        </div>
    );

    useIntroJsTour({
        key: StudyLibraryIntroKey.addCourseStep,
        steps: addCourseStep,
        enable: openDialog,
    });

    return (
        <MyDialog
            trigger={triggerWithPreventSubmit}
            heading="Add Course"
            dialogWidth="w-[700px]"
            open={openDialog}
            onOpenChange={handleOpenChange}
            footer={submitButton}
            isTour
            className="z-[99999]"
        >
            <AddCourseForm
                onSubmitCourse={onSubmit}
                setOpenDialog={setOpenDialog}
                setDisableAddButton={setDisableAddButton}
                submitForm={(submitFn) => {
                    formSubmitRef.current = submitFn;
                }}
            />
        </MyDialog>
    );
};
