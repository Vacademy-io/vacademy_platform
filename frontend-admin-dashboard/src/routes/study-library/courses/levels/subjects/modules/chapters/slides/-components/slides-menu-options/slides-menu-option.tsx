import { MyButton } from "@/components/design-system/button";
import { MyDropdown } from "@/components/design-system/dropdown";
import { DotsThree } from "phosphor-react";
import { useState } from "react";
import { dropdownList } from "@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-constants/slides-menu-options";
import { CopyToDialog } from "./copy-dialog";
import { MoveToDialog } from "./move-dialog";
import { DeleteDialog } from "./delete-dialog";

export const SlidesMenuOption = () => {
    const [openDialog, setOpenDialog] = useState<"copy" | "move" | "delete" | null>(null);

    const handleSelect = (value: string) => {
        switch (value) {
            case "copy":
                setOpenDialog("copy");
                break;
            case "move":
                setOpenDialog("move");
                break;
            case "delete":
                setOpenDialog("delete");
                break;
        }
    };

    return (
        <>
            <MyDropdown dropdownList={dropdownList} onSelect={handleSelect}>
                <MyButton buttonType="secondary" scale="large" layoutVariant="icon">
                    <DotsThree />
                </MyButton>
            </MyDropdown>

            {/* Copy Dialog */}
            <CopyToDialog openDialog={openDialog} setOpenDialog={setOpenDialog} />

            {/* Move Dialog */}
            <MoveToDialog openDialog={openDialog} setOpenDialog={setOpenDialog} />

            {/* Delete Dialog */}
            <DeleteDialog openDialog={openDialog} setOpenDialog={setOpenDialog} />
        </>
    );
};
