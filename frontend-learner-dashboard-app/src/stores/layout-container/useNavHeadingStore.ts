import React from "react";
import {create} from "zustand";

interface navHeadingState {
    navHeading: string | React.ReactNode;
    setNavHeading: (newNavHeading: string | React.ReactNode) => void;
}

export const useNavHeadingStore = create<navHeadingState>((set) => ({
    navHeading: "",
    setNavHeading: (newNavHeading) =>
        set((state) => {
            // Avoid redundant updates when the heading is an identical string
            if (
                typeof newNavHeading === "string" &&
                state.navHeading === newNavHeading
            ) {
                return state;
            }
            return { navHeading: newNavHeading };
        }),
}));
