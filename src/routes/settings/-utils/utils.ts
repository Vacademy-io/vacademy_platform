import { SettingsTabs } from '../-constants/terms';
import PaymentSettings from '../-components/Payment/PaymentSettings';
import ReferralSettings from '../-components/Referral/ReferralSettings';
import CourseSettings from '../-components/Course/CourseSettings';
import TabSettings from '../-components/Tab/TabSettings';
import NamingSettings from '../-components/NamingSettings';
import NotificationSettings from '../-components/Notification/NotificationSettings';
import RoleDisplaySettingsMain from '../-components/RoleDisplay/RoleDisplaySettingsMain';
import StudentDisplaySettings from '@/routes/settings/-components/RoleDisplay/StudentDisplaySettings';
import CustomFieldsSettings from '@/components/settings/CustomFieldsSettings';
import CertificatesSettings from '../-components/Certificates/CertificatesSettings';
import { TemplateSettings } from '@/components/templates';
import AiSettings from '../-components/AiSettings';
import SchoolSettings from '../-components/School/SchoolSettings';
import FeeManagementMain from '../fee-management/-components/FeeManagementMain';

export const getAvailableSettingsTabs = () => {
    return [
        {
            tab: SettingsTabs.Tab,
            value: 'Tab Settings',
            component: TabSettings,
        },
        {
            tab: SettingsTabs.RoleDisplay,
            value: 'Display Settings',
            component: RoleDisplaySettingsMain,
        },
        {
            tab: SettingsTabs.StudentDisplay,
            value: 'Student Display',
            component: StudentDisplaySettings,
        },
        {
            tab: SettingsTabs.Naming,
            value: 'Naming Settings',
            component: NamingSettings,
        },
        {
            tab: SettingsTabs.Notification,
            value: 'Notification Settings',
            component: NotificationSettings,
        },
        {
            tab: SettingsTabs.Payment,
            value: 'Payment Settings',
            component: PaymentSettings,
        },
        {
            tab: SettingsTabs.Referral,
            value: 'Referral Settings',
            component: ReferralSettings,
        },
        {
            tab: SettingsTabs.Course,
            value: 'Course Settings',
            component: CourseSettings,
        },
        {
            tab: SettingsTabs.CustomFields,
            value: 'Custom Fields',
            component: CustomFieldsSettings,
        },
        {
            tab: SettingsTabs.Certificates,
            value: 'Certificate Settings',
            component: CertificatesSettings,
        },
        {
            tab: SettingsTabs.Templates,
            value: 'Template Settings',
            component: TemplateSettings,
        },
        {
            tab: SettingsTabs.AiSettings,
            value: 'AI Settings',
            component: AiSettings,
        },
        {
            tab: SettingsTabs.SchoolSettings,
            value: 'School Settings',
            component: SchoolSettings,
        },
        {
            tab: SettingsTabs.FeeManagement,
            value: 'Fee Management',
            component: FeeManagementMain,
        },
    ];
};
