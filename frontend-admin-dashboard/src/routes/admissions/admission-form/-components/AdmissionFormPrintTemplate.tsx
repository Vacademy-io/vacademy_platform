import React from 'react';
import type { AdmissionFormData } from './AdmissionFormWizard';

interface AdmissionFormPrintTemplateProps {
    formData: AdmissionFormData;
    instituteName: string;
    instituteLogo: string;
    trackingLabel: string;
    trackingId: string;
}

const THEME = {
    primary: '#1e3a5f',
    primaryLight: '#2c5282',
    border: '#d1d5db',
    headerBg: '#f0f4f8',
    labelColor: '#4a5568',
    valueColor: '#1a202c',
};

function SectionHeader({ title }: { title: string }) {
    return (
        <div
            style={{
                background: THEME.primary,
                color: '#ffffff',
                padding: '4px 12px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                marginTop: '8px',
                borderRadius: '3px',
            }}
        >
            {title}
        </div>
    );
}

function FieldRow({
    fields,
    minHeight,
}: {
    fields: { label: string; value: string }[];
    minHeight?: string;
}) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${fields.length}, 1fr)`,
                borderLeft: `1px solid ${THEME.border}`,
                borderRight: `1px solid ${THEME.border}`,
                borderBottom: `1px solid ${THEME.border}`,
            }}
        >
            {fields.map((field, idx) => (
                <div
                    key={idx}
                    style={{
                        padding: '4px 10px',
                        borderRight: idx < fields.length - 1 ? `1px solid ${THEME.border}` : 'none',
                        minHeight: minHeight || '24px',
                    }}
                >
                    <div
                        style={{
                            fontSize: '7px',
                            color: '#9ca3af',
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            marginBottom: '1px',
                            fontWeight: 400,
                        }}
                    >
                        {field.label}
                    </div>
                    <div
                        style={{
                            fontSize: '10.5px',
                            color: THEME.valueColor,
                            fontWeight: 700,
                            minHeight: '12px',
                        }}
                    >
                        {field.value || '\u00A0'}
                    </div>
                </div>
            ))}
        </div>
    );
}

const AdmissionFormPrintTemplate = React.forwardRef<HTMLDivElement, AdmissionFormPrintTemplateProps>(
    ({ formData, instituteName, instituteLogo, trackingLabel, trackingId }, ref) => {
        const today = new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });

        const formatDate = (dateStr: string) => {
            if (!dateStr) return '';
            try {
                return new Date(dateStr).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                });
            } catch {
                return dateStr;
            }
        };

        return (
            <div
                ref={ref}
                style={{
                    width: '210mm',
                    minHeight: '297mm',
                    padding: '12mm 14mm 10mm 14mm',
                    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
                    color: THEME.valueColor,
                    background: '#ffffff',
                    boxSizing: 'border-box',
                    lineHeight: 1.3,
                }}
            >
                {/* ── Header ── */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        borderBottom: `3px solid ${THEME.primary}`,
                        paddingBottom: '8px',
                        marginBottom: '2px',
                    }}
                >
                    {instituteLogo && instituteLogo.startsWith('data:') && (
                        <img
                            src={instituteLogo}
                            alt="Institute Logo"
                            style={{
                                width: '48px',
                                height: '48px',
                                objectFit: 'contain',
                                marginRight: '12px',
                                borderRadius: '4px',
                            }}
                        />
                    )}
                    <div style={{ flex: 1 }}>
                        <div
                            style={{
                                fontSize: '16px',
                                fontWeight: 800,
                                color: THEME.primary,
                                letterSpacing: '0.5px',
                            }}
                        >
                            {instituteName || 'Institute Name'}
                        </div>
                        <div
                            style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: THEME.primaryLight,
                                marginTop: '1px',
                                letterSpacing: '1.5px',
                                textTransform: 'uppercase',
                            }}
                        >
                            Admission Form
                        </div>
                        <div style={{ fontSize: '8px', color: THEME.labelColor, marginTop: '4px' }}>
                            {trackingLabel && trackingId && (
                                <span><strong>{trackingLabel}:</strong> {trackingId}</span>
                            )}
                            <span style={{ marginLeft: '16px' }}><strong>Date:</strong> {today}</span>
                        </div>
                    </div>
                    {/* Photo placeholder */}
                    <div
                        style={{
                            width: '80px',
                            height: '100px',
                            border: `1.5px dashed ${THEME.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '8px',
                            color: '#a0aec0',
                            borderRadius: '3px',
                            flexShrink: 0,
                        }}
                    >
                        Paste Photo
                    </div>
                </div>

                {/* ── Section 1: Student Details ── */}
                <SectionHeader title="Student Details" />
                <FieldRow
                    fields={[
                        { label: 'First Name', value: formData.studentFirstName },
                        { label: 'Middle Name', value: formData.studentMiddleName },
                        { label: 'Last Name', value: formData.studentLastName },
                    ]}
                />
                <FieldRow
                    fields={[
                        { label: 'Gender', value: formData.gender },
                        { label: 'Date of Birth', value: formatDate(formData.dateOfBirth) },
                        { label: 'Date of Admission', value: formatDate(formData.dateOfAdmission) },
                    ]}
                />
                <FieldRow
                    fields={[
                        { label: 'Class', value: formData.studentClass },
                        { label: 'Section', value: formData.section },
                        { label: 'Group', value: formData.classGroup },
                    ]}
                />
                <FieldRow
                    fields={[
                        { label: 'Application No', value: formData.applicationNumber },
                        { label: 'Student Type', value: formData.studentType },
                        { label: 'Admission Type', value: formData.admissionType },
                    ]}
                />
                <FieldRow
                    fields={[
                        { label: 'Residential Phone', value: formData.residentialPhone },
                        { label: 'Transport', value: formData.transport },
                        { label: 'Aadhaar Number', value: formData.aadhaarNumber },
                    ]}
                />

                {/* ── Section 2: Previous School & Personal Details ── */}
                <SectionHeader title="Previous School & Personal Details" />
                <FieldRow
                    fields={[
                        { label: 'Previous School Name', value: formData.schoolName },
                        { label: 'Previous Class', value: formData.previousClass },
                        { label: 'Board', value: formData.board },
                    ]}
                />
                <FieldRow
                    fields={[
                        { label: 'Year of Passing', value: formData.yearOfPassing },
                        { label: 'Percentage', value: formData.percentage },
                        { label: 'Previous Admission No', value: formData.previousAdmissionNo },
                    ]}
                />
                <FieldRow
                    fields={[
                        { label: 'Religion', value: formData.religion },
                        { label: 'Caste', value: formData.caste },
                        { label: 'Mother Tongue', value: formData.motherTongue },
                    ]}
                />
                <FieldRow
                    fields={[
                        { label: 'Blood Group', value: formData.bloodGroup },
                        { label: 'Nationality', value: formData.nationality },
                        { label: 'How Did You Know About Us', value: formData.howDidYouKnow },
                    ]}
                />

                {/* ── Section 3: Parent / Guardian Details ── */}
                <SectionHeader title="Parent / Guardian Details" />
                <FieldRow
                    fields={[
                        { label: "Father's Name", value: formData.fatherName },
                        { label: "Father's Mobile", value: formData.fatherMobile },
                        { label: "Father's Email", value: formData.fatherEmail },
                    ]}
                />
                <FieldRow
                    fields={[
                        { label: "Father's Aadhaar", value: formData.fatherAadhaar },
                        { label: "Father's Qualification", value: formData.fatherQualification },
                        { label: "Father's Occupation", value: formData.fatherOccupation },
                    ]}
                />
                <FieldRow
                    fields={[
                        { label: "Mother's Name", value: formData.motherName },
                        { label: "Mother's Mobile", value: formData.motherMobile },
                        { label: "Mother's Email", value: formData.motherEmail },
                    ]}
                />
                <FieldRow
                    fields={[
                        { label: "Mother's Aadhaar", value: formData.motherAadhaar },
                        { label: "Mother's Qualification", value: formData.motherQualification },
                        { label: "Mother's Occupation", value: formData.motherOccupation },
                    ]}
                />
                <FieldRow
                    fields={[
                        { label: "Guardian's Name", value: formData.guardianName },
                        { label: "Guardian's Mobile", value: formData.guardianMobile },
                        { label: '', value: '' },
                    ]}
                />

                {/* ── Section 4: Address Details ── */}
                <SectionHeader title="Address Details" />
                <FieldRow
                    fields={[{ label: 'Current Address', value: formData.currentAddress }]}
                    minHeight="44px"
                />
                <FieldRow
                    fields={[
                        { label: 'Locality', value: formData.currentLocality },
                        { label: 'Pin Code', value: formData.currentPinCode },
                    ]}
                />
                <FieldRow
                    fields={[
                        {
                            label: 'Permanent Address',
                            value: formData.sameAsPermanent
                                ? formData.currentAddress
                                : formData.permanentAddress,
                        },
                    ]}
                    minHeight="44px"
                />
                <FieldRow
                    fields={[
                        {
                            label: 'Permanent Locality',
                            value: formData.sameAsPermanent
                                ? formData.currentLocality
                                : formData.permanentLocality,
                        },
                        { label: '', value: '' },
                    ]}
                />

                {/* ── Declaration + Signatures (kept together) ── */}
                <div style={{ pageBreakInside: 'avoid' }}>
                    <div
                        style={{
                            marginTop: '12px',
                            padding: '8px 12px',
                            border: `1px solid ${THEME.border}`,
                            borderRadius: '3px',
                            background: THEME.headerBg,
                        }}
                    >
                        <div
                            style={{
                                fontSize: '8px',
                                fontWeight: 700,
                                color: THEME.primary,
                                marginBottom: '3px',
                                textTransform: 'uppercase',
                            }}
                        >
                            Declaration
                        </div>
                        <div style={{ fontSize: '8px', color: THEME.labelColor, lineHeight: 1.4 }}>
                            I hereby declare that all the information provided above is true and
                            correct to the best of my knowledge. I understand that any false
                            information may lead to the cancellation of admission.
                        </div>
                    </div>

                    {/* ── Signatures ── */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '40px',
                            marginTop: '36px',
                        }}
                    >
                        {['Parent / Guardian', 'Student', 'Principal'].map((role) => (
                            <div key={role} style={{ textAlign: 'center' }}>
                                <div
                                    style={{
                                        borderTop: `1.5px solid ${THEME.primary}`,
                                        paddingTop: '5px',
                                        fontSize: '8.5px',
                                        fontWeight: 600,
                                        color: THEME.primary,
                                        letterSpacing: '0.5px',
                                    }}
                                >
                                    {role}&#39;s Signature
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Footer ── */}
                    <div
                        style={{
                            marginTop: '14px',
                            textAlign: 'center',
                            fontSize: '7px',
                            color: '#a0aec0',
                            borderTop: `1px solid ${THEME.border}`,
                            paddingTop: '4px',
                        }}
                    >
                        This is a computer-generated document. Generated on {today}.
                    </div>
                </div>
            </div>
        );
    }
);

AdmissionFormPrintTemplate.displayName = 'AdmissionFormPrintTemplate';

export default AdmissionFormPrintTemplate;
