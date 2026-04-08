import React from 'react';
import type { Registration } from '../../-types/registration-types';

interface ApplicationFormPrintTemplateProps {
    formData: Partial<Registration>;
    instituteName: string;
    instituteLogo: string;
    registrationId: string;
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

const ApplicationFormPrintTemplate = React.forwardRef<
    HTMLDivElement,
    ApplicationFormPrintTemplateProps
>(({ formData, instituteName, instituteLogo, registrationId }, ref) => {
    const today = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

    const formatDate = (dateStr?: string) => {
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

    const formatAddress = (addr?: Registration['currentAddress']) => {
        if (!addr) return '';
        return [addr.houseNo, addr.street, addr.area, addr.landmark, addr.city, addr.state, addr.pinCode || addr.pincode]
            .filter(Boolean)
            .join(', ');
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
                        Application Form
                    </div>
                    <div style={{ fontSize: '8px', color: THEME.labelColor, marginTop: '4px' }}>
                        <span>
                            <strong>Registration No:</strong> {registrationId}
                        </span>
                        <span style={{ marginLeft: '16px' }}>
                            <strong>Date:</strong> {today}
                        </span>
                        {formData.academicYear && (
                            <span style={{ marginLeft: '16px' }}>
                                <strong>Academic Year:</strong> {formData.academicYear}
                            </span>
                        )}
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
                    {
                        label: 'Full Name (As per Birth Certificate)',
                        value: formData.studentName || '',
                    },
                    { label: 'Date of Birth', value: formatDate(formData.dateOfBirth) },
                    { label: 'Gender', value: formData.gender || '' },
                ]}
            />
            <FieldRow
                fields={[
                    { label: 'Nationality', value: formData.nationality || '' },
                    { label: 'Religion', value: formData.religion || '' },
                    { label: 'Category', value: formData.category || '' },
                ]}
            />
            <FieldRow
                fields={[
                    { label: 'Blood Group', value: formData.bloodGroup || '' },
                    { label: 'Mother Tongue', value: formData.motherTongue || '' },
                    {
                        label: 'Languages Known',
                        value: formData.languagesKnown?.filter(Boolean).join(', ') || '',
                    },
                ]}
            />
            <FieldRow
                fields={[
                    { label: 'ID Type', value: formData.idType || '' },
                    { label: 'ID Number', value: formData.idNumber || '' },
                    { label: '', value: '' },
                ]}
            />

            {/* ── Health Information ── */}
            <SectionHeader title="Health Information" />
            <FieldRow
                fields={[
                    {
                        label: 'Medical Conditions / Allergies',
                        value: formData.medicalConditions || '',
                    },
                    {
                        label: 'Dietary Restrictions',
                        value: formData.dietaryRestrictions || '',
                    },
                ]}
                minHeight="36px"
            />
            <FieldRow
                fields={[
                    {
                        label: 'Special Education Needs',
                        value: formData.hasSpecialNeeds ? 'Yes' : 'No',
                    },
                    {
                        label: 'Physically Challenged',
                        value: formData.isPhysicallyChallenged ? 'Yes' : 'No',
                    },
                    { label: '', value: '' },
                ]}
            />

            {/* ── Section 2: Academic Information ── */}
            <SectionHeader title="Academic Information" />
            <FieldRow
                fields={[
                    { label: 'Applying For Class', value: formData.applyingForClass || '' },
                    { label: 'Preferred Board', value: formData.preferredBoard || '' },
                    { label: 'Academic Year', value: formData.academicYear || '' },
                ]}
            />
            <FieldRow
                fields={[
                    { label: 'Previous School Name', value: formData.previousSchoolName || '' },
                    { label: 'Previous School Board', value: formData.previousSchoolBoard || '' },
                    { label: 'Last Class Attended', value: formData.lastClassAttended || '' },
                ]}
            />
            <FieldRow
                fields={[
                    { label: 'Last Exam Result', value: formData.lastExamResult || '' },
                    {
                        label: 'Subjects Studied',
                        value: formData.subjectsStudied || '',
                    },
                    { label: '', value: '' },
                ]}
            />
            <FieldRow
                fields={[
                    { label: 'TC Number', value: formData.tcNumber || '' },
                    { label: 'TC Issue Date', value: formatDate(formData.tcIssueDate) },
                    {
                        label: 'TC Pending',
                        value: formData.tcPending ? 'Yes' : 'No',
                    },
                ]}
            />

            {/* ── Section 3: Father's Details ── */}
            <SectionHeader title="Father's Details" />
            <FieldRow
                fields={[
                    { label: 'Name', value: formData.fatherInfo?.name || '' },
                    { label: 'Mobile', value: formData.fatherInfo?.mobile || '' },
                    { label: 'Email', value: formData.fatherInfo?.email || '' },
                ]}
            />
            <FieldRow
                fields={[
                    { label: 'Qualification', value: formData.fatherInfo?.qualification || '' },
                    { label: 'Occupation', value: formData.fatherInfo?.occupation || '' },
                    { label: 'Annual Income', value: formData.fatherInfo?.annualIncome || '' },
                ]}
            />

            {/* ── Section 4: Mother's Details ── */}
            <SectionHeader title="Mother's Details" />
            <FieldRow
                fields={[
                    { label: 'Name', value: formData.motherInfo?.name || '' },
                    { label: 'Mobile', value: formData.motherInfo?.mobile || '' },
                    { label: 'Email', value: formData.motherInfo?.email || '' },
                ]}
            />
            <FieldRow
                fields={[
                    { label: 'Qualification', value: formData.motherInfo?.qualification || '' },
                    { label: 'Occupation', value: formData.motherInfo?.occupation || '' },
                    { label: 'Annual Income', value: formData.motherInfo?.annualIncome || '' },
                ]}
            />

            {/* ── Section 5: Guardian Details (if present) ── */}
            {formData.guardianInfo && (
                <>
                    <SectionHeader title="Guardian Details" />
                    <FieldRow
                        fields={[
                            { label: 'Name', value: formData.guardianInfo.name || '' },
                            { label: 'Relation', value: formData.guardianInfo.relation || '' },
                            { label: 'Mobile', value: formData.guardianInfo.mobile || '' },
                        ]}
                    />
                </>
            )}

            {/* ── Section 6: Emergency Contact ── */}
            {formData.emergencyContact && (
                <>
                    <SectionHeader title="Emergency Contact" />
                    <FieldRow
                        fields={[
                            { label: 'Name', value: formData.emergencyContact.name || '' },
                            {
                                label: 'Relationship',
                                value: formData.emergencyContact.relationship || '',
                            },
                            { label: 'Mobile', value: formData.emergencyContact.mobile || '' },
                        ]}
                    />
                </>
            )}

            {/* ── Section 7: Address Details ── */}
            <SectionHeader title="Address Details" />
            <FieldRow
                fields={[
                    {
                        label: 'Current Address',
                        value: formatAddress(formData.currentAddress),
                    },
                ]}
                minHeight="44px"
            />
            <FieldRow
                fields={[
                    {
                        label: 'Permanent Address',
                        value: formData.sameAsCurrentAddress
                            ? 'Same as Current Address'
                            : formatAddress(formData.permanentAddress),
                    },
                ]}
                minHeight="44px"
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
                        I hereby declare that all the information provided above is true and correct
                        to the best of my knowledge. I understand that any false information may lead
                        to the cancellation of the application / admission.
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
});

ApplicationFormPrintTemplate.displayName = 'ApplicationFormPrintTemplate';

export default ApplicationFormPrintTemplate;
