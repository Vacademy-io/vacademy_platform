import { InstituteSelection } from './-components/LoginPages/sections/InstituteSelection';
import { useNavigate } from '@tanstack/react-router';
import { setSelectedInstitute } from '@/lib/auth/instituteUtils';

export function InstituteSelectionPage() {
    const navigate = useNavigate();

    const handleInstituteSelect = (instituteId: string) => {
        setSelectedInstitute(instituteId);
        navigate({ to: '/dashboard' });
    };

    return <InstituteSelection onInstituteSelect={handleInstituteSelect} />;
}
