/**
 * Local development utilities for handling localhost subdomains
 */

export const getLocalhostInstituteConfig = (subdomain: string | null) => {
  // Map localhost subdomains to institute configurations
  const localhostConfigs: Record<string, { instituteId: string; redirectPath: string }> = {
    'code-circle': {
      instituteId: 'dd9b9687-56ee-467a-9fc4-8c5835eae7f9', // CODE_CIRCLE_INSTITUTE_ID
      redirectPath: '/courses'
    },
    'holistic': {
      instituteId: 'bd9f2362-84d1-4e01-9762-a5196f9bac80', // HOLISTIC_INSTITUTE_ID
      redirectPath: '/courses'
    },
    'default': {
      instituteId: 'c70f40a5-e4d3-4b6c-a498-e612d0d4b133', // Default INSTITUTE_ID
      redirectPath: '/login'
    }
  };

  if (!subdomain) {
    return localhostConfigs.default;
  }

  return localhostConfigs[subdomain] || localhostConfigs.default;
};

export const isLocalhostDevelopment = (domain: string) => {
  return domain === 'localhost' || domain.includes('localhost');
};
