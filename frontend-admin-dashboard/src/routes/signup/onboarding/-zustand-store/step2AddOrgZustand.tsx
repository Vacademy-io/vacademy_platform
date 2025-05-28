import { create } from "zustand";

interface FormValues {
    name: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    roleType: string[];
}

interface FormStore {
    formDataAddOrg: FormValues;
    setFormDataAddOrg: (data: Partial<FormValues>) => void;
    resetAddOrgForm: () => void;
}

export const useAddOrgStore = create<FormStore>((set) => ({
    formDataAddOrg: {
        name: "",
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        roleType: [],
    },
    setFormDataAddOrg: (data) =>
        set((state) => ({
            formDataAddOrg: { ...state.formDataAddOrg, ...data },
        })),
    resetAddOrgForm: () =>
        set({
            formDataAddOrg: {
                name: "",
                username: "",
                email: "",
                password: "",
                confirmPassword: "",
                roleType: [],
            },
        }),
}));
