import React, { useState, useEffect } from 'react';
// import Footer from './Footer.tsx';
// import InstructorCTASection from './InstructorCTASection.tsx';
// import SupportersSection from './SupportersSection.tsx';
import CoursesPage from './CoursesPage.tsx';
// import Header from './Header.tsx';
import { useCatalogStore } from '../-store/catalogStore.ts';
import axios from 'axios';
import HeroSection from '../-component1/HeroSection.tsx';
import Tab from '../-component1/Tab.tsx';
//import { getInstituteId } from "@/constants/helper";
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance.ts';

//import { urlInstituteDetails,urlCourseDetails,urlInstructor } from '@/constants/urls.ts';
const urlInstituteDetails = 'https://backend-stage.vacademy.io/admin-core-service/public/institute/v1/details/94337b5b-7687-4a1e-993f-1b3529dd6f44';
const urlCourseDetails = 'https://backend-stage.vacademy.io/admin-core-service/open/packages/v1/search';
const urlInstructor = 'https://backend-stage.vacademy.io/auth-service/public/v1/users-of-status?instituteId=23103559-5632-42c9-b9ce-619d55fce3cb';




const CourseCatalougePage: React.FC = () => {
  const { courseData, setCourseData, setInstituteData, setInstructors } = useCatalogStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("Newest");

  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);
  //api call to store the courses details

  //console.log("getInsutteId from the helper function",getInstituteId);
  const fetchPackages = async (search = "", sort = "Newest") => {
    try {
      const response = await axios.post(
        urlCourseDetails,
        {
          status: [],
          level_ids: [],
          faculty_ids: [],
          search_by_name: search,
          tag: [],
          min_percentage_completed: 0,
          max_percentage_completed: 0
        },
        {
          params: {
            instituteId: '94337b5b-7687-4a1e-993f-1b3529dd6f44',
            page: 0,
            size: 95,
            sortBy: sort === "Newest" ? "created_at,desc" :
              sort === "Oldest" ? "created_at,asc" :
                sort === "Rating" ? "rating,desc" : "created_at,desc"
          },
          headers: {
            'accept': '*/*',
            'Content-Type': 'application/json'
          }
        }
      );
      setCourseData(response.data.content);
      //console.log('Response courses:', response.data);
    } catch (error) {
     // console.error('Error fetching packages:', error);
    }
  };


  useEffect(() => {
    fetchPackages(searchTerm, sortOption);
  }, [searchTerm, sortOption]);


  const handleApplyFilters = async () => {
    try {
      const response = await axios.post(
        urlCourseDetails,
        {
          status: [],
          level_ids: selectedLevels,
          faculty_ids: selectedInstructors,
          search_by_name: searchTerm,
          tag: selectedTags,
          min_percentage_completed: 0,
          max_percentage_completed: 0
        },
        {
          params: {
            instituteId: '94337b5b-7687-4a1e-993f-1b3529dd6f44',
            page: 0,
            size: 95,
          },
          headers: {
            'accept': '*/*',
            'Content-Type': 'application/json'
          }
        }
      );
      setCourseData(response.data.content);
    } catch (error) {
      console.error('Error applying filters:', error);
    }
  };




  // ✅ Fetch institute details
  useEffect(() => {
    const FetchInstituteDetails = async () => {
      try {
        const response = await axios.get(urlInstituteDetails);
       // console.log("Institute details", response.data);
        setInstituteData(response.data);
        setLoading(false);
      } catch (error) {
        setError("Something went wrong while fetching the institute details.");
      }
    };

    FetchInstituteDetails();
  }, []);


  // ✅ Fetch instructor
  useEffect(() => {
    const fetchInstructor = async () => {
      try {
        const response = await axios.post(urlInstructor, {
          roles: ["TEACHER"],
          status: ["ACTIVE"]
        }, {
          headers: {
            'Accept': '*/*',
            'Content-Type': 'application/json'
          }
        });
       // console.log('Instructor response9999:', response.data);
        setInstructors(response.data);
      } catch (error) {
        setError("Something went wrong while fetching the instructors.");
      }
    };

    fetchInstructor();
  }, []);



  return (
    <div>
      <HeroSection />
        <Tab />
      <CoursesPage
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortOption={sortOption}
        onSortChange={setSortOption}

        selectedLevels={selectedLevels}
        setSelectedLevels={setSelectedLevels}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        selectedInstructors={selectedInstructors}
        setSelectedInstructors={setSelectedInstructors}

        onApplyFilters={handleApplyFilters}
        clearAllFilters={() => {
          setSelectedLevels([]);
          setSelectedTags([]);
          setSelectedInstructors([]);
           fetchPackages();
        }}
      />


      {/* <InstructorCTASection />
      <SupportersSection />
      <Footer /> */}
    </div>
  );
}

export default CourseCatalougePage;