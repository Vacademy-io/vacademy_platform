// subjects.tsx
import { EmptySubjectMaterial } from "@/assets/svgs";
import { SubjectCard } from "./subject-card";
import { Sortable, SortableItem } from "@/components/ui/sortable";
import { closestCorners } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { SubjectType } from "@/stores/study-library/use-study-library-store";
import { orderSubjectPayloadType } from "@/routes/study-library/courses/-types/order-payload";
import { useSidebar } from "@/components/ui/sidebar";
import { DropdownItemType } from "@/components/common/students/enroll-manually/dropdownTypesForPackageItems";

interface SubjectsProps {
    subjects: SubjectType[];
    onDeleteSubject: (subjectId: string) => void;
    onEditSubject: (subjectId: string, updatedSubject: SubjectType) => void;
    onOrderChange?: (updatedOrder: orderSubjectPayloadType[]) => void;
    isLoading?: boolean;
    packageSessionIds: string;
    currentSession?: DropdownItemType;
}

export const Subjects = ({
    subjects: initialSubjects,
    onDeleteSubject,
    onEditSubject,
    onOrderChange,
    isLoading = false,
    packageSessionIds,
    currentSession,
}: SubjectsProps) => {
    const { open } = useSidebar();

    const [subjects, setSubjects] = useState(initialSubjects);

    const handleValueChange = (updatedSubjects: SubjectType[]) => {
        setSubjects(updatedSubjects);

        // Create the order payload
        const orderPayload = updatedSubjects.map((subject, index) => ({
            subject_id: subject.id,
            package_session_id: packageSessionIds, // This needs to be filled with actual package session id
            subject_order: index + 1,
        }));

        onOrderChange?.(orderPayload);
    };

    useEffect(() => {
        setSubjects(initialSubjects);
    }, [initialSubjects]);

    if (isLoading) {
        return <DashboardLoader />;
    }

    return (
        <div className="h-full w-full">
            {!subjects.length ? (
                <div className="flex w-full flex-col items-center justify-center gap-8 rounded-lg py-10">
                    <EmptySubjectMaterial />
                    <div>No subjects have been added yet.</div>
                </div>
            ) : (
                <Sortable
                    orientation="mixed"
                    collisionDetection={closestCorners}
                    value={subjects}
                    onValueChange={handleValueChange}
                    overlay={<div className="bg-primary/10 size-full rounded-md" />}
                    fast={false}
                >
                    <div
                        className={`grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4 ${
                            open ? "md:grid-cols-3" : "md:grid-cols-4"
                        }`}
                    >
                        {subjects.map((subject) => (
                            <SortableItem key={subject.id} value={subject.id} asChild>
                                <div className="cursor-grab active:cursor-grabbing">
                                    <SubjectCard
                                        subject={subject}
                                        onDelete={() => onDeleteSubject(subject.id)}
                                        onEdit={(updatedSubject) =>
                                            onEditSubject(subject.id, updatedSubject)
                                        }
                                        currentSession={currentSession}
                                    />
                                </div>
                            </SortableItem>
                        ))}
                    </div>
                </Sortable>
            )}
        </div>
    );
};
