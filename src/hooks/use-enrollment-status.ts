import { useState, useEffect, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { hasUserDonated } from '@/services/user-enrollment-status';

export interface EnrolledSession {
  id: string;
  session: {
    id: string;
    session_name: string;
    status: string;
    start_date: string;
  };
  level: {
    id: string;
    level_name: string;
    duration_in_days: number | null;
    thumbnail_id: string | null;
  };
  start_time: string | null;
  status: string;
  package_dto: {
    id: string;
    package_name: string;
    thumbnail_id?: string | null;
  };
}

export const useEnrollmentStatus = (instituteId: string | null) => {
  
  const [enrolledSessions, setEnrolledSessions] = useState<EnrolledSession[]>([]);
  const [userHasDonated, setUserHasDonated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [donationCheckCompleted, setDonationCheckCompleted] = useState(false);

  // Always fetch enrolled sessions from preferences, regardless of instituteId
  const fetchEnrolledSessions = useCallback(async () => {
    try {
      const sessionListResult = await Preferences.get({ key: "sessionList" });
      if (sessionListResult.value) {
        const sessionList = JSON.parse(sessionListResult.value);
        const sessions = Array.isArray(sessionList) ? sessionList : [sessionList];
        setEnrolledSessions(sessions);
      }
    } catch (error) {
      setEnrolledSessions([]);
    }
  }, []); // No dependencies needed

  // Check donation status only when instituteId is available
  const checkDonationStatus = useCallback(async () => {
    if (!instituteId) {
      setUserHasDonated(false);
      return;
    }
    
    try {
      const hasDonated = await hasUserDonated(instituteId);
      setUserHasDonated(hasDonated);
      setDonationCheckCompleted(true);
    } catch (error) {
      setUserHasDonated(false);
      setDonationCheckCompleted(true);
    }
  }, [instituteId]); // Add instituteId as dependency

  // Update preferences with new session
  const updatePreferencesWithNewSession = useCallback(async (updatedSessions: EnrolledSession[]) => {
    try {
      await Preferences.set({
        key: "sessionList",
        value: JSON.stringify(updatedSessions)
      });
    } catch (error) {
      // Silent error handling
    }
  }, []); // No dependencies needed

  // Add a new enrolled session
  const addEnrolledSession = useCallback((newSession: EnrolledSession) => {
    setEnrolledSessions(prev => {
      // Check if session already exists
      const exists = prev.some(session => 
        session.package_dto.id === newSession.package_dto.id &&
        session.session.id === newSession.session.id &&
        session.level.id === newSession.level.id
      );
      
      if (exists) {
        return prev; // Don't add duplicate
      }
      
      const updatedSessions = [...prev, newSession];
      
      // Update preferences with the new sessions array
      updatePreferencesWithNewSession(updatedSessions);
      
      return updatedSessions;
    });
  }, [updatePreferencesWithNewSession]); // Add dependency

  // Check if user is enrolled in a specific course
  const isEnrolledInCourse = useCallback((courseId: string, sessionId?: string, levelId?: string) => {
    const result = (enrolledSessions || []).some(session => {
      const courseMatch = session.package_dto.id === courseId;
      
      if (sessionId && levelId) {
        return courseMatch && 
               session.session.id === sessionId && 
               session.level.id === levelId;
      }
      
      return courseMatch;
    });
    

    
    return result;
  }, [enrolledSessions]); // Add enrolledSessions dependency

  // Refresh all data
  const refreshData = useCallback(async () => {
    try {
      await Promise.all([
        fetchEnrolledSessions(),
        checkDonationStatus()
      ]);
    } catch (error) {
      // Silent error handling
    } finally {
      setIsLoading(false);
    }
  }, [fetchEnrolledSessions, checkDonationStatus]); // Add dependencies

  // Always fetch enrolled sessions on mount
  useEffect(() => {
    fetchEnrolledSessions();
  }, []); // Only run once on mount

  // Check donation status when instituteId changes
  useEffect(() => {
    if (instituteId) {
      // Only check donation status if we haven't completed it for this instituteId
      if (!donationCheckCompleted) {
        setIsLoading(true);
        checkDonationStatus();
      }
    } else {
      // Reset donation status when instituteId is null
      setUserHasDonated(false);
      setDonationCheckCompleted(false);
    }
  }, [instituteId, checkDonationStatus, donationCheckCompleted]); // Add donationCheckCompleted as dependency

  // Function to manually refresh donation status (useful after successful donation)
  const refreshDonationStatus = useCallback(async () => {
    if (instituteId) {
      setDonationCheckCompleted(false);
      setIsLoading(true);
      await checkDonationStatus();
    }
  }, [instituteId, checkDonationStatus]);

  return {
    enrolledSessions: enrolledSessions || [],
    userHasDonated: userHasDonated === null ? false : userHasDonated,
    isLoading,
    isEnrolledInCourse,
    addEnrolledSession,
    refreshData,
    refreshDonationStatus,
  };
};
