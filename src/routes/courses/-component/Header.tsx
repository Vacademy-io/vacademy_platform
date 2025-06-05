import React, { useState, useEffect } from 'react';
import { useCatalogStore } from '../-store/catalogStore';
import { getPublicUrl } from '@/services/upload_file';

const Header: React.FC = () => {
  const defaultLogoUrl = '/images/logo-placeholder.png'; 
  const defaultInstituteName = 'Institute Portal'; 
  
  const { apiFetchedInstituteDetails } = useCatalogStore();
  const [logoUrlToDisplay, setLogoUrlToDisplay] = useState<string>(defaultLogoUrl);
  const [logoLoading, setLogoLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDynamicLogo = async () => {
      if (apiFetchedInstituteDetails && apiFetchedInstituteDetails.institute_logo_file_id) {
        if(isMounted) setLogoLoading(true);
        try {
          const url = await getPublicUrl(apiFetchedInstituteDetails.institute_logo_file_id);
          if (isMounted) {
            if (url) {
              setLogoUrlToDisplay(url);
            } else {
              setLogoUrlToDisplay(defaultLogoUrl);
            }
          }
        } catch (error) {
          console.error("Error fetching dynamic institute logo URL:", error);
          if (isMounted) setLogoUrlToDisplay(defaultLogoUrl);
        } finally {
          if (isMounted) setLogoLoading(false);
        }
      } else {
        if (isMounted) {
          setLogoUrlToDisplay(defaultLogoUrl);
          setLogoLoading(false);
        }
      }
    };

    fetchDynamicLogo();
    return () => { isMounted = false; };
  }, [apiFetchedInstituteDetails]);

  const displayName = apiFetchedInstituteDetails?.institute_name || defaultInstituteName;
  
  useEffect(() => {
    if (apiFetchedInstituteDetails) {
      console.log("Header - Institute Details Updated:", {
        id: apiFetchedInstituteDetails.id,
        name: displayName,
        city: apiFetchedInstituteDetails.city,
        logoFileId: apiFetchedInstituteDetails.institute_logo_file_id,
        currentLogoUrl: logoUrlToDisplay
      });
    }
  }, [apiFetchedInstituteDetails, displayName, logoUrlToDisplay]);

  return (
    <nav className="min-h-[80px] bg-white py-5 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center shadow-sm">
      <div className="flex items-center relative h-10 w-24 mr-3 mb-4 md:mb-0">
        {logoLoading && (
          <div 
            className="absolute inset-0 bg-gray-200 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 text-xs"
            aria-label="Loading logo"
          >
            Loading...
          </div>
        )}
        <img 
          src={logoUrlToDisplay} 
          alt={`${displayName} Logo`} 
          className={`h-full w-full object-contain rounded-md border border-gray-200 ${logoLoading ? 'opacity-0' : 'opacity-100'}`}
          onError={() => {
            if (logoUrlToDisplay !== defaultLogoUrl) {
                setLogoUrlToDisplay(defaultLogoUrl);
            }
            setLogoLoading(false);
          }}
        /> 
      </div>
      
      <div className='flex flex-col md:flex-row items-center gap-6'>
        <ul className='flex flex-wrap justify-center md:justify-start items-center gap-4 text-gray-800 mb-4 md:mb-0'>
          <li><a href="#home" className="hover:text-blue-600 transition">Home</a></li>
          <li title={apiFetchedInstituteDetails?.description || 'Learn more about us'}><a href="#about" className="hover:text-blue-600 transition">About</a></li>
          <li><a href="#impact" className="hover:text-blue-600 transition">Impact</a></li>
          <li><a href="#courses" className="hover:text-blue-600 transition">Courses</a></li>
          <li><a href="#involved" className="hover:text-blue-600 transition">Get Involved</a></li>
          <li><a href="#contact" className="hover:text-blue-600 transition">Contact</a></li>
        </ul>
        <div className='flex gap-3'>
          <button className='px-3 py-2 border border-1 border-gray-300 bg-white text-black rounded-md hover:bg-gray-100 transition'>Login</button>
          <button className='px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition'>Donate</button>
        </div>
      </div>
    </nav>
  );
}

export default Header; 