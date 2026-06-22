import { SettingsTabs } from '../-constants/terms';
import PaymentSettings from '../-components/Payment/PaymentSettings';
import ReferralSettings from '../-components/Referral/ReferralSettings';
import CourseSettings from '../-components/Course/CourseSettings';
import NamingSettings from '../-components/NamingSettings';
import NotificationSettings from '../-components/Notification/NotificationSettings';
import RoleDisplaySettingsMain from '../-components/RoleDisplay/RoleDisplaySettingsMain';
import StudentDisplaySettings from '@/routes/settings/-components/RoleDisplay/StudentDisplaySettings';
import ContentProtectionSettings from '../-components/ContentProtectionSettings';
import CustomFieldsSettings from '@/components/settings/CustomFieldsSettings';
import CertificatesSettings from '../-components/Certificates/CertificatesSettings';
import { TemplateSettings } from '@/components/templates';
import AiSettings from '../-components/AiSettings';
import SchoolSettings from '../-components/School/SchoolSettings';
import WhiteLabelSettings from '../-components/WhiteLabelSettings';
import AssessmentSettings from '../-components/AssessmentSettings';
import WhatsAppSettings from '../-components/WhatsAppSettings/WhatsAppSettings';
import LeadSettings from '../-components/LeadSettings';
import GtmSettings from '../-components/GtmSettings';
import TncSettings from '../-components/Tnc/TncSettings';
import IntegrationSettings from '../-components/IntegrationSettings';
import DoubtManagementSettings from '../-components/DoubtManagementSettings';
import LiveSessionSettings from '../-components/LiveSessionSettings';
import YoutubeIntegrationSettings from '../-components/YoutubeIntegrationSettings';
import { AutomationSettings } from '../-components/Automations';
import InvoiceSettings from '../-components/Invoice/InvoiceSettings';
import CouponSettings from '../-components/Coupons/CouponSettings';
import TelephonySettings from '../-components/TelephonySettings';
import PaymentGatewaySettings from '../-components/PaymentGatewaySettings';
import LmsSettings from '../-components/Lms/LmsSettings';
import AiCallingSettings from '../-components/AiCallingSettings';

export const getAvailableSettingsTabs = () => {
    // Entries are sorted A-Z by display label (`value`) at the end so the
    // sidebar renders in alphabetical order. Authoring order here is
    // irrelevant — add new entries anywhere.
    return [
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
            tab: SettingsTabs.ContentProtection,
            value: 'Content Protection',
            component: ContentProtectionSettings,
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
            tab: SettingsTabs.Automations,
            value: 'Automations',
            component: AutomationSettings,
        },
        {
            tab: SettingsTabs.Payment,
            value: 'Payment Settings',
            component: PaymentSettings,
        },
        {
            tab: SettingsTabs.Invoice,
            value: 'Invoice Settings',
            component: InvoiceSettings,
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
            tab: SettingsTabs.Assessment,
            value: 'Assessment Settings',
            component: AssessmentSettings,
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
            tab: SettingsTabs.WhiteLabel,
            value: 'White-Label Setup',
            component: WhiteLabelSettings,
        },
        {
            tab: SettingsTabs.WhatsApp,
            value: 'WhatsApp Settings',
            component: WhatsAppSettings,
        },
        {
            tab: SettingsTabs.LeadSettings,
            value: 'Lead Settings',
            component: LeadSettings,
        },
        {
            tab: SettingsTabs.GtmSettings,
            value: 'GTM Settings',
            component: GtmSettings,
        },
        {
            tab: SettingsTabs.Tnc,
            value: 'Student T&C',
            component: TncSettings,
        },
        {
            tab: SettingsTabs.Integrations,
            value: 'Ad Integrations',
            component: IntegrationSettings,
        },
        {
            tab: SettingsTabs.DoubtManagement,
            value: 'Doubt Management',
            component: DoubtManagementSettings,
        },
        {
            tab: SettingsTabs.LiveSession,
            value: 'Live Session Settings',
            component: LiveSessionSettings,
        },
        {
            tab: SettingsTabs.Youtube,
            value: 'YouTube Integration',
            component: YoutubeIntegrationSettings,
        },
        {
            tab: SettingsTabs.Coupons,
            value: 'Coupon Settings',
            component: CouponSettings,
        },
        {
            tab: SettingsTabs.Telephony,
            value: 'Calling (Telephony)',
            component: TelephonySettings,
        },
        {
            tab: SettingsTabs.AiCalling,
            value: 'AI Calling',
            component: AiCallingSettings,
        },
        {
            tab: SettingsTabs.PaymentGateways,
            value: 'Payment Gateways',
            component: PaymentGatewaySettings,
        },
        {
            tab: SettingsTabs.Lms,
            value: 'LMS Settings',
            component: LmsSettings,
        },
    ].sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: 'base' }));
};
