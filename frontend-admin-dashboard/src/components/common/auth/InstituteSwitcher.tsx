import { useState, useEffect } from 'react';
import { useInstitute } from '@/hooks/auth/useInstitute';
import { getInstitutesFromToken, getPrimaryRole } from '@/lib/auth/instituteUtils';
import { fetchMultipleInstituteDetails, getInstituteName } from '@/lib/auth/instituteService';
import { InstituteDetailsType } from '@/schemas/student/student-list/institute-schema';
import { Building2, ChevronDown, GraduationCap, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export function InstituteSwitcher() {
    const { currentInstituteId, selectInstitute, getCurrentInstituteRole } = useInstitute();
    const [isOpen, setIsOpen] = useState(false);
    const [institutes, setInstitutes] = useState(getInstitutesFromToken());
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    const currentInstitute = institutes.find((inst) => inst.id === currentInstituteId);
    const currentRole = getCurrentInstituteRole();

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'ADMIN':
                return <Shield className="h-4 w-4 text-red-500" />;
            case 'TEACHER':
                return <GraduationCap className="h-4 w-4 text-blue-500" />;
            case 'STUDENT':
                return <User className="h-4 w-4 text-green-500" />;
            default:
                return <User className="h-4 w-4 text-gray-500" />;
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'ADMIN':
                return 'text-red-600 bg-red-50 border-red-200';
            case 'TEACHER':
                return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'STUDENT':
                return 'text-green-600 bg-green-50 border-green-200';
            default:
                return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const handleInstituteSelect = (instituteId: string) => {
        selectInstitute(instituteId);
        setIsOpen(false);
        toast.success('Institute switched successfully');

        // Reload the page to update the context
        window.location.reload();
    };

    // Fetch institute details when component mounts
    useEffect(() => {
        const fetchDetails = async () => {
            if (institutes.length > 0) {
                try {
                    setIsLoadingDetails(true);
                    const instituteIds = institutes.map(institute => institute.id);
                    const instituteDetails = await fetchMultipleInstituteDetails(instituteIds);

                    // Update institute names with real names
                    const updatedInstitutes = institutes.map(institute => ({
                        ...institute,
                        name: getInstituteName(instituteDetails[institute.id] || null, institute.id),
                        details: instituteDetails[institute.id] || null,
                    }));

                    setInstitutes(updatedInstitutes);
                } catch (error) {
                    console.error('Error fetching institute details:', error);
                } finally {
                    setIsLoadingDetails(false);
                }
            }
        };

        fetchDetails();
    }, []);

    if (!currentInstitute) {
        return null;
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className="flex items-center gap-2 border-gray-200 bg-white hover:bg-gray-50"
                >
                    <Building2 className="h-4 w-4 text-gray-600" />
                    <div className="flex flex-col items-start">
                        <span className="text-sm font-medium text-gray-900">
                            {currentInstitute.name}
                        </span>
                        {currentRole && (
                            <span className={`inline-flex items-center gap-1 text-xs ${getRoleColor(currentRole)}`}>
                                {getRoleIcon(currentRole)}
                                {currentRole}
                            </span>
                        )}
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <div className="p-2">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Switch Institute</h3>
                    {institutes.map((institute) => {
                        const isSelected = institute.id === currentInstituteId;
                        const primaryRole = getPrimaryRole(institute.roles);

                        return (
                            <DropdownMenuItem
                                key={institute.id}
                                onClick={() => handleInstituteSelect(institute.id)}
                                className={`flex items-center justify-between p-3 cursor-pointer ${
                                    isSelected ? 'bg-primary-50 border-primary-200' : 'hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Building2 className="h-4 w-4 text-gray-600" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-900">
                                            {institute.name}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {institute.details?.city && institute.details?.state
                                                ? `${institute.details.city}, ${institute.details.state}`
                                                : institute.id
                                            }
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${getRoleColor(primaryRole)}`}>
                                        {getRoleIcon(primaryRole)}
                                        {primaryRole}
                                    </span>
                                    {isSelected && (
                                        <span className="text-xs text-primary-600 font-medium">
                                            Current
                                        </span>
                                    )}
                                </div>
                            </DropdownMenuItem>
                        );
                    })}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
