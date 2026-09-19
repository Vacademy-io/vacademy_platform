import { Step } from '@/hooks/use-intro';
import i18n from '@/i18n';

// Module-scope data built at import time (consumed by an app-tour driver
// outside any component render), so `useTranslation()` isn't available here
// — call the shared i18next singleton directly with a fixed namespace.
const NAMESPACE = 'evaluatorAiIntroSteps';

export const evaluationAISteps: Step[] = [
    {
        element: '#students',
        title: i18n.t('welcomeTitle', { ns: NAMESPACE }),
        intro: i18n.t('welcomeIntro', { ns: NAMESPACE }),
        position: 'right',
    },
];
