import { create } from 'zustand';

interface AdminStore {
    adminLogo: string;
    setAdminLogo: (logo: string) => void;
    resetAdminLogo: () => void;
}

const useAdminLogoStore = create<AdminStore>((set) => ({
    adminLogo: '',
    setAdminLogo: (logo) => set({ adminLogo: logo }),
    resetAdminLogo: () => set({ adminLogo: '' }), // Reset function
}));

export default useAdminLogoStore;
