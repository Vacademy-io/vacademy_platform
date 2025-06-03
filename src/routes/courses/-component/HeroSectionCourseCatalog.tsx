
import React, { useState, useEffect } from 'react';
import { useCatalogStore } from '../-store/catalogStore';
import { getPublicUrl } from '@/services/upload_file';

const HeroSectionCourseCatalog: React.FC = () => {
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
    <div className='h-[350px]'>
      {url ? (
        <img src="./images/banner.png" alt="Promotional banner for course catalog" className='w-full h-full object-cover' />
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
};

export default HeroSectionCourseCatalog;
