export enum EntityType {
    COURSE = "COURSE",
    LEVEL = "LEVEL",
    SUBJECT = "SUBJECT",
}

export interface SideBarData {
    sideBarList: { value: string; id: string }[];
    title: string;
    listIconText: string;
    searchparam: string;
}

export const getInternalSideBarDetails = () => {};
