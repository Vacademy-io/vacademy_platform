import React, { useState, useEffect } from 'react';
import { useCatalogStore } from '../../../-store/catalogStore';
import { getPublicUrl } from '@/services/upload_file';
import { LoginModel } from '@/components/common/LoginModel/LoginModel';
import { SignUpModel } from '@/components/common/SignUpModel/SignUpModel';


const Header: React.FC = () => {
  const defaultLogoUrl = '/images/logo.png';
  const defaultInstituteName = 'Institute Portal';

  const {instituteData}=useCatalogStore();
  const [logoUrlToDisplay, setLogoUrlToDisplay] = useState<string>(defaultLogoUrl);
  const [logoLoading, setLogoLoading] = useState<boolean>(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDynamicLogo = async () => {
      if (instituteData&&instituteData.institute_logo_file_id) {
        if (isMounted) setLogoLoading(true);
        try {
          const url = await getPublicUrl(instituteData.institute_logo_file_id);
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
  }, [instituteData]);

  const displayName =instituteData?.institute_name || defaultInstituteName;


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
          src="/images/logo.png"
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
          <li title={instituteData?.description || 'Learn more about us'}><a href="#about" className="hover:text-blue-600 transition">About</a></li>
          <li><a href="#impact" className="hover:text-blue-600 transition">Impact</a></li>
          <li><a href="#courses" className="hover:text-blue-600 transition">Courses</a></li>
          <li><a href="#involved" className="hover:text-blue-600 transition">Get Involved</a></li>
          <li><a href="#contact" className="hover:text-blue-600 transition">Contact</a></li>
        </ul>
        <div className='flex gap-3'>
          <button className='px-3 py-2 border border-1 border-gray-300 bg-white text-black rounded-md hover:bg-gray-100 transition'
            onClick={() => setShowLogin(true)}
          >
            Login
          </button>
          {showLogin && (
            <LoginModel
              onClose={() => setShowLogin(false)}
              switchToSignUp={() => {
                setShowLogin(false);
                setShowSignUp(true);
              }}
            />
          )}

          {showSignUp && (
            <SignUpModel
              onClose={() => setShowSignUp(false)}
              switchToLogin={() => {
                setShowSignUp(false);
                setShowLogin(true);
              }}
            />
          )}
          <button className='px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition'>Donate</button>
        </div>
      </div>
    </nav>
  );
}

export default Header; 










// const Header: React.FC = () => {
//   return (
//     <nav className="min-h-[80px] bg-white py-5 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center">
//       <img src="/images/logo.png" alt="Company Logo - EduSite" className="h-10 mb-4 md:mb-0"/> {/* Added margin for mobile */}

//       <div className='flex flex-col md:flex-row items-center gap-6'> {/* Adjusted flex for mobile stacking */}
//         <ul className='flex flex-wrap justify-center md:justify-start items-center gap-4 text-gray-800 mb-4 md:mb-0'> {/* Added flex-wrap for mobile */}
//           <li><a href="#home" className="hover:text-blue-600 transition">Home</a></li>
//           <li><a href="#about" className="hover:text-blue-600 transition">About</a></li>
//           <li><a href="#impact" className="hover:text-blue-600 transition">Impact</a></li>
//           <li><a href="#courses" className="hover:text-blue-600 transition">Courses</a></li>
//           <li><a href="#involved" className="hover:text-blue-600 transition">Get Involved</a></li>
//           <li><a href="#contact" className="hover:text-blue-600 transition">Contact</a></li>
//         </ul>
//         <div className='flex gap-3'>
//           <button className='px-3 py-2 border border-1 border-gray-300 bg-white text-black rounded-md hover:bg-gray-100 transition'>Login</button>
//           <button className='px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition'>Donate</button>
//         </div>
//       </div>
//     </nav>
//   );
// }

// export default Header; 