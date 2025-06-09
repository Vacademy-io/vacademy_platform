
import React, { useState, useEffect, useCallback } from 'react';
import Footer from './Footer.tsx';
import InstructorCTASection from './InstructorCTASection.tsx';
import SupportersSection from './SupportersSection.tsx';
import CoursesPage from './CoursesPage.tsx';
import Header from './Header.tsx';
import HeroSectionCourseCatalog from './HeroSectionCourseCatalog.tsx';
import { useCatalogStore } from '../-store/catalogStore.ts';
import axios from 'axios';
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { getAccessToken} from '@/lib/auth/sessionUtility';
import { GET_INSTITUTE_DETAILS,SEARCH_COURSES} from '@/constants/urls';
//import { redirect, useParams, useSearch } from '@tanstack/react-router';
// Preferences import is removed as we are fetching from a new API now for these details
// import { Preferences } from '@capacitor/preferences'; 

// Mock data for filter options is now primarily derived from API.
// const mockLevels = [ ... ]; // Removed
// const mockInitialTags = [ ... ]; // Removed
const mockInstructors = [ // Kept for now, as instructor data source isn't specified in institute details API
  { id: 'alice', name: 'Alice Wonderland' },
  { id: 'bob', name: 'Bob The Builder' },
  { id: 'charlie', name: 'Charlie Brown' },
  { id: 'diana', name: 'Diana Prince' },
  { id: 'edward', name: 'Edward Scissorhands' },
  { id: 'fiona', name: 'Fiona Gallagher' },
];

// Define interfaces for the API response structure
interface ApiPackageDto {
  id: string;
  package_name: string;
  thumbnail_file_id: string;
  tags?: string[];
  course_depth?: number | null;
  [key: string]: any;
}

interface ApiCourseItem {
  package_dto: ApiPackageDto;
  batches: any[];
}

// Interface for the new API-fetched institute details is already in the store,
// but we can reference it here for clarity if needed, or rely on the store's typing.
// interface ApiInstituteDetailsType { ... }

// Helper function to format tags for PostgreSQL array literal string (if still needed by backend)
// If backend now accepts standard JSON array for tags, this might be simplified or removed.
const formatTagsForPostgresArray = (tagNames: string[]): string => {
  if (!tagNames || tagNames.length === 0) {
    return '{}'; 
  }
  const formattedTags = tagNames.map(tag => {
    const escapedTag = tag.replace(/\\/g, '\\\\').replace(/"/g, '""');
    return `"${escapedTag}"`; 
  });
  return `{${formattedTags.join(',')}}`; 
};

// Define API endpoints in one place for easier management
//const API_BASE_URL = 'https://backend-stage.vacademy.io/admin-core-service';
const INSTITUTE_DETAILS_API = (id: string) => `${GET_INSTITUTE_DETAILS}/${id}`;
const SEARCH_COURSES_API = `${SEARCH_COURSES}?page=0&size=5`;

const CourseCatalougePage: React.FC = ({ hideHero = false }) => {
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const { 
    // dynamicCourses, // Removed as it's not read in this component
    setDynamicCourses, 
    apiFetchedInstituteDetails, // Get institute details from store
    setApiFetchedInstituteDetails 
  } = useCatalogStore();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [selectedInstructorNames, setSelectedInstructorNames] = useState<string[]>([]);

  // Available filter options, will be populated from apiFetchedInstituteDetails
  const [availableLevels, setAvailableLevels] = useState<{ id: string; name: string }[]>([]);
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [availableInstructors, _setAvailableInstructors] = useState(mockInstructors); // Still uses mock
  //console.log("access token", getAccessToken());
  // Pagination state (if CoursesPage doesn't manage it internally based on data)
  // For now, assuming CoursesPage handles its own pagination state based on items per page
  // and total items it receives. We pass the raw course data.
  //const INSTITUTE_DETAILS_API = (id: string) => `${GET_INSTITUTE_DETAILS}/${id}`;
  // useEffect to get instituteId from URL

  //  const {searchUrl} = useSearch<any>({ from: "/study-library/" });
  // console.log("searchUrl", searchUrl);

  

  useEffect(() => {
    const getInstituteIdFromUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const idFromUrl = urlParams.get('instituteId');
      if (idFromUrl) {
        setInstituteId(idFromUrl);
        console.log("Fetched instituteId from URL:", idFromUrl);
      } else {
        console.log("No instituteId found in URL params.");
      }
    };
    getInstituteIdFromUrl();
  }, []);

  // useEffect to fetch institute details from the new API when instituteId is available
  useEffect(() => {
    const fetchInstituteApiDetails = async () => {
      if (!instituteId) return;
  
      console.log(`📡 Fetching institute details for instituteId: ${instituteId}`);
      try {
      const token = await getAccessToken()
        console.log("Token for Institute Details API:", token);
    const response =  await authenticatedAxiosInstance.get(INSTITUTE_DETAILS_API(instituteId));
  
        if (response?.data) {
          console.log("✅ Institute Details:", response.data);
          setApiFetchedInstituteDetails(response.data);
        } else {
          console.warn("⚠️ No data returned from institute details API");
          setApiFetchedInstituteDetails(null);
        }
      } catch (error: any) {
        console.error("❌ Error fetching institute details:", error.message || error);
        setApiFetchedInstituteDetails(null);
      }
    };
  
    fetchInstituteApiDetails();
  }, [instituteId, setApiFetchedInstituteDetails]); // Rerun when instituteId changes

  // Populate availableLevels and availableTags from apiFetchedInstituteDetails
  useEffect(() => {
    if (apiFetchedInstituteDetails) {
      // Populate Levels
      if (apiFetchedInstituteDetails.levels && Array.isArray(apiFetchedInstituteDetails.levels)) {
        const levelsFromApi = apiFetchedInstituteDetails.levels.map((level: { id: string; level_name: string }) => ({
          id: level.id,
          name: level.level_name,
        }));
        setAvailableLevels(levelsFromApi);
      } else {
        setAvailableLevels([]); // Set to empty if not found or wrong format
      }

      // Populate Tags
      if (apiFetchedInstituteDetails.tags && Array.isArray(apiFetchedInstituteDetails.tags)) {
        const tagsFromApi = apiFetchedInstituteDetails.tags.map((tag: string) => ({
          id: tag, // Using the tag itself as ID, assuming uniqueness for filtering
          name: tag,
        }));
        setAvailableTags(tagsFromApi);
      } else {
        setAvailableTags([]); // Set to empty if not found or wrong format
      }
      // Note: availableInstructors still uses mock data.
      // If instructors come from API, add similar logic here.
    }
  }, [apiFetchedInstituteDetails]);

  // Fetch Courses when instituteId or filters change
  useEffect(() => {
    if (instituteId) {
      const fetchCourses = async () => {
        const apiTagsPayload = selectedTagNames.length > 0 
          ? formatTagsForPostgresArray(selectedTagNames) 
          : []; 

        try {
          const token = await getAccessToken();
          console.log("Token for Search Courses API:", token);
          const response = await axios({
            url: SEARCH_COURSES_API,
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            data: {
              institute_id: instituteId,
              status: [], 
              level_ids: selectedLevelIds, 
              tags: apiTagsPayload, 
              search_by_name: searchTerm,
            },
          });

          const responseData = response.data;
          
          let coursesToStore = [];
          if (responseData && responseData.content && Array.isArray(responseData.content)) {
            coursesToStore = responseData.content.map((item: ApiCourseItem) => ({
              ...item.package_dto,
              packageName: item.package_dto.package_name,
              raw_batches: item.batches,
            }));
          }
          setDynamicCourses(coursesToStore);
          // Removed logic to derive tags from course API response, as it now comes from institute details.
        } catch (error) {
          console.error("Error fetching courses:", error);
          // By not clearing the courses here, we prevent the "blinking" effect on a failed API call.
          // The root cause (likely an authentication error) still needs to be resolved for new data to load.
          // setDynamicCourses([]);
        }
      };
      fetchCourses();
    }
  }, [instituteId, searchTerm, selectedLevelIds, selectedTagNames, setDynamicCourses]); 

  // Callbacks for updating filter states
  const handleSearchChange = useCallback((term: string) => setSearchTerm(term), []);
  
  const handleLevelChange = useCallback((levelId: string) => {
    setSelectedLevelIds(prev => 
      prev.includes(levelId) ? prev.filter(id => id !== levelId) : [...prev, levelId]
    );
  }, []);

  const handleTagChange = useCallback((tagName: string) => {
    setSelectedTagNames(prev => 
      prev.includes(tagName) ? prev.filter(id => id !== tagName) : [...prev, tagName]
    );
  }, []);

  const handleInstructorChange = useCallback((instructorName: string) => {
    setSelectedInstructorNames(prev => 
      prev.includes(instructorName) ? prev.filter(id => id !== instructorName) : [...prev, instructorName]
    );
  }, []);

  const clearAllFiltersInPage = useCallback(() => {
    setSelectedLevelIds([]);
    setSelectedTagNames([]);
    setSelectedInstructorNames([]);
    // setSearchTerm(''); // Optionally clear search term as well
  }, []);

  return (
      <div>
        {!hideHero && <Header/>}
      {!hideHero && <HeroSectionCourseCatalog/>}
      <CoursesPage 
        // Pass filter states and handlers to CoursesPage
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        
        availableLevels={availableLevels}
        selectedLevelIds={selectedLevelIds}
        onLevelChange={handleLevelChange}
        
        availableTags={availableTags} // Pass dynamically populated tags
        selectedTagNames={selectedTagNames}
        onTagChange={handleTagChange}

        availableInstructors={availableInstructors}
        selectedInstructorNames={selectedInstructorNames}
        onInstructorChange={handleInstructorChange}
        
        clearAllFilters={clearAllFiltersInPage}
        
        // Courses data is now sourced from the store via useCatalogStore in CoursesPage
        // No need to pass dynamicCourses directly here if CoursesPage also uses the store
        // However, CoursesPage current structure has its own mockCourses fallback
        // And it expects 'courses' prop. Let's ensure it receives data.
        // The setDynamicCourses updates the store, which CoursesPage should read.
      /> 
     {!hideHero && <InstructorCTASection/>}
     {!hideHero && <SupportersSection/>}
     {!hideHero && <Footer/>}
    </div>
  );
}

export default CourseCatalougePage; 