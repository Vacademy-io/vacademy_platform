import React,{useState,useEffect} from 'react';
import { useCatalogStore } from '../-store/catalogStore';
import { getPublicUrl } from '@/services/upload_file';
const Header: React.FC = () => {
  const { instituteData } = useCatalogStore();
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    async function fetchUrl() {
      if (instituteData?.institute_logo_file_id) {
        const publicUrl = await getPublicUrl(instituteData.institute_logo_file_id);
        setUrl(publicUrl);
      }
    }
    fetchUrl();
  }, [instituteData]);
  return (
    <nav className="min-h-[80px] bg-white py-5 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center">
      <img src={url} alt="Company Logo - EduSite" className="h-10 mb-4 md:mb-0"/> {/* Added margin for mobile */}

      <div className='flex flex-col md:flex-row items-center gap-6'> {/* Adjusted flex for mobile stacking */}
        <ul className='flex flex-wrap justify-center md:justify-start items-center gap-4 text-gray-800 mb-4 md:mb-0'> {/* Added flex-wrap for mobile */}
          <li><a href="#home" className="hover:text-blue-600 transition">Home</a></li>
          <li><a href="#about" className="hover:text-blue-600 transition">About</a></li>
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