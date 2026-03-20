import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { CertificateStudentDataSection } from './-components/certificate-student-data-section';
import { Helmet } from 'react-helmet';

export const Route = createLazyFileRoute('/certificate-generation/student-data/')({
  component: CertificateStudentData,
});

export function CertificateStudentData() {
  console.log('🚀 CertificateStudentData component rendering');

  try {
    return (
      <LayoutContainer>
        <Helmet>
          <title>Certificate Generation - Student Data</title>
          <meta
            name="description"
            content="Manage student data and upload dynamic information for certificate generation."
          />
        </Helmet>
        <CertificateStudentDataSection />
      </LayoutContainer>
    );
  } catch (error) {
    console.error('❌ Error rendering CertificateStudentData:', error);
    throw error;
  }
}
