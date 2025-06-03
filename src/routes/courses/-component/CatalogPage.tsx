import  { useEffect } from 'react';
import axios from 'axios';
import {useCatalogStore} from '../-store/catalogStore'// adjust path as needed

const CatalogPage= () => {
  const {
    instituteId,
    setInstituteId,
    // courses,
    setCourses,
    instituteData,
    setInstituteData,
    loading,
    setLoading,
    // error,
    setError,
  } = useCatalogStore();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('instituteId');
    setInstituteId(idFromUrl);
    console.log('Initial instituteId from URL:', idFromUrl);
  }, [setInstituteId]);

  useEffect(() => {
    if (instituteId) {
      setLoading(true);
      setError(null);
      setCourses([]);

      const fetchInstituteDetail = async () => {
        try {
          const response = await axios.get(
            `https://backend-stage.vacademy.io/admin-core-service/public/institute/v1/details/${instituteId}`
          );
          console.log('instituteDetail', response.data);
          setInstituteData(response.data);
        } catch (error: any) {
          setError('Failed to fetch institute details');
          console.error(error);
        }
      };

      const fetchCourses = async () => {
        try {
          const apiUrl =
            'https://backend-stage.vacademy.io/admin-core-service/batch/v1/search?page=0&size=5';
          const requestBody = {
            institute_id: instituteId,
            status: [],
            level_ids: [],
            tags: [],
            search_by_name: '',
          };

          const response = await axios.post(apiUrl, requestBody);
          console.log('API Response:', response.data);
          setCourses(response.data.batches || []);
        } catch (apiError) {
          console.error('API Call Error:', apiError);
          setError('Failed to fetch courses.');
        } finally {
          setLoading(false);
        }
      };

      fetchInstituteDetail();
      fetchCourses();
    }
  }, [instituteId]);

  if (!instituteId && !loading) {
    return (
      <div>
        <h2>Course Catalog</h2>
        <p>
          Institute ID not provided in URL search parameters (e.g.,
          ?instituteId=your-uuid).
        </p>
      </div>
    );
  }

  return (
    instituteData && (
      <div>
        <h3>Institute Details</h3>
        <p><strong>Name:</strong> {instituteData.institute_name}</p>
        <p><strong>ID:</strong> {instituteData.id}</p>
        <p><strong>Type:</strong> {instituteData.type}</p>
        <p><strong>City:</strong> {instituteData.city || 'N/A'}</p>
        <p><strong>State:</strong> {instituteData.state || 'N/A'}</p>
        <p><strong>Email:</strong> {instituteData.email || 'N/A'}</p>
        <p><strong>Phone:</strong> {instituteData.phone || 'N/A'}</p>
        <p><strong>Website:</strong> {instituteData.website_url || 'N/A'}</p>
  
        {/* Sub Modules */}
        <h4>Sub Modules:</h4>
        {instituteData.sub_modules?.length > 0 ? (
          <ul>
            {instituteData.sub_modules.map((mod: any) => (
              <li key={mod.id}>
                {mod.module} - {mod.sub_module}
              </li>
            ))}
          </ul>
        ) : (
          <p>No sub-modules available.</p>
        )}
  
        {/* Sessions */}
        <h4>Sessions:</h4>
        {instituteData.sessions?.length > 0 ? (
          <ul>
            {instituteData.sessions.map((session: any) => (
              <li key={session.id}>
                {session.session_name || 'Unnamed Session'} - {session.status}
              </li>
            ))}
          </ul>
        ) : (
          <p>No sessions found.</p>
        )}
  
        {/* Levels */}
        <h4>Levels:</h4>
        {instituteData.levels?.length > 0 ? (
          <ul>
            {instituteData.levels.map((level: any) => (
              <li key={level.id}>{level.level_name}</li>
            ))}
          </ul>
        ) : (
          <p>No levels found.</p>
        )}
      </div>
    )
  );
}

export default CatalogPage;
