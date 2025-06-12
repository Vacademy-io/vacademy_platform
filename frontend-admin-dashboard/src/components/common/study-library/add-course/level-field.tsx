// level-field.tsx (renamed to level-in-session-field.tsx)
import { MyButton } from "@/components/design-system/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DotsThree } from "@phosphor-icons/react";
import { Level, Session, CourseFormData } from "./add-course-form";
import { ControllerRenderProps } from "react-hook-form";

interface LevelInSessionFieldProps {
    level: Level;
    session: Session;
    field: ControllerRenderProps<CourseFormData, "sessions">;
}

export const LevelInSessionField = ({ level, session, field }: LevelInSessionFieldProps) => {
    // Generate a consistent unique identifier for the level
    const levelIdentifier = level.id || `name-${level.level_name}`;

    // Find the current session in the form value
    const currentFormValue = field.value || [];

    // Check if this level exists in the current session
    const isLevelChecked = (() => {
        const sessionInForm = currentFormValue.find((s) => s.id === session.id);
        if (!sessionInForm) return false;

        return sessionInForm.levels.some((l) => {
            // Use the level name for comparison when id is empty
            const otherLevelId = l.id || `name-${l.level_name}`;
            return otherLevelId === levelIdentifier;
        });
    })();

    return (
        <div key={levelIdentifier} className="flex items-center gap-3 rounded-md p-2">
            <Checkbox
                className="data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                checked={isLevelChecked}
                onCheckedChange={(checked) => {
                    // Create a new copy of the sessions array
                    const newSessions = [...currentFormValue];

                    if (checked) {
                        // Adding this level to the session
                        const existingSessionIndex = newSessions.findIndex(
                            (s) => s.id === session.id,
                        );

                        if (existingSessionIndex === -1) {
                            // Add new session with this level
                            newSessions.push({
                                id: session.id,
                                session_name: session.session_name,
                                status: session.status,
                                start_date: session.start_date || "",
                                new_session: session.new_session || false,
                                levels: [
                                    {
                                        id: level.id,
                                        level_name: level.level_name,
                                        duration_in_days: level.duration_in_days,
                                        thumbnail_id: level.thumbnail_id,
                                        new_level: level.id === "" || false,
                                    },
                                ],
                            });
                        } else {
                            // Add level to existing session if not already there
                            const existingSession = newSessions[existingSessionIndex];

                            if (existingSession && existingSession.levels) {
                                // Check if level already exists using our custom identifier
                                const levelExists = existingSession.levels.some((l) => {
                                    const otherLevelId = l.id || `name-${l.level_name}`;
                                    return otherLevelId === levelIdentifier;
                                });

                                if (!levelExists) {
                                    existingSession.levels.push({
                                        id: level.id,
                                        level_name: level.level_name,
                                        duration_in_days: level.duration_in_days,
                                        thumbnail_id: level.thumbnail_id,
                                        new_level: level.id === "" || false,
                                    });
                                }
                            }
                        }
                    } else {
                        // Remove this level from the session
                        const existingSessionIndex = newSessions.findIndex(
                            (s) => s.id === session.id,
                        );

                        if (existingSessionIndex !== -1) {
                            const existingSession = newSessions[existingSessionIndex];

                            if (existingSession && existingSession.levels) {
                                // Filter out this level using our custom identifier
                                existingSession.levels = existingSession.levels.filter((l) => {
                                    const otherLevelId = l.id || `name-${l.level_name}`;
                                    return otherLevelId !== levelIdentifier;
                                });

                                // Remove session if no levels left
                                if (existingSession.levels.length === 0) {
                                    newSessions.splice(existingSessionIndex, 1);
                                }
                            }
                        }
                    }

                    field.onChange(newSessions);
                }}
            />
            <div className="flex w-full items-center justify-between">
                <div className="flex flex-col">
                    <div className="flex flex-col items-start">
                        <p className="text-subtitle font-semibold">{level.level_name}</p>
                    </div>
                    <span className="text-xs text-neutral-500">
                        Duration: {level.duration_in_days || 0} days
                    </span>
                </div>
                <MyButton
                    buttonType="secondary"
                    layoutVariant="icon"
                    scale="small"
                    type="button"
                    className="hover:bg-white active:bg-white"
                >
                    <DotsThree />
                </MyButton>
            </div>
        </div>
    );
};
