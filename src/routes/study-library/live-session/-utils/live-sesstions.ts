import { DraftSession, LiveSession } from '../-services/utils';

export const getSessionJoinLink = (session: LiveSession | DraftSession, baseUrl: string) => {
    const normalizedBase = baseUrl
        ? (baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`)
        : '';
    if (session.access_level === 'private') {
        return `${normalizedBase}/study-library/live-class/embed?sessionId=${session.schedule_id}`;
    } else return `${normalizedBase}/register/live-class?sessionId=${session.session_id}`;
};
