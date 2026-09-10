import type { TFunction } from 'i18next';
import { StreamingPlatform, WaitingRoomType } from '../../-constants/enums';

// These option lists are imported by several unrelated screens (schedule
// form, bulk grid, preview dialog, settings). Labels are translated, so each
// list is a factory that takes the caller's own bound `t` — every consumer
// must include the 'studyLibraryOptions' namespace in its own
// `useTranslation([...])` array so it's loaded before calling these.
const NAMESPACE = 'studyLibraryOptions';

const buildWaitingRoomOptions = (t: TFunction) => [
    { value: '5', label: t('waitingRoom.5min', { ns: NAMESPACE }), _id: 1 },
    { value: '10', label: t('waitingRoom.10min', { ns: NAMESPACE }), _id: 2 },
    { value: '15', label: t('waitingRoom.15min', { ns: NAMESPACE }), _id: 3 },
    { value: '30', label: t('waitingRoom.30min', { ns: NAMESPACE }), _id: 4 },
    { value: '45', label: t('waitingRoom.45min', { ns: NAMESPACE }), _id: 5 },
];

const buildWaitingRoomTypeOptions = (t: TFunction) => [
    {
        value: WaitingRoomType.WAITING_ROOM,
        label: t('waitingRoomType.waitingRoom', { ns: NAMESPACE }),
        _id: 1,
    },
    {
        value: WaitingRoomType.PRE_JOINING,
        label: t('waitingRoomType.preJoining', { ns: NAMESPACE }),
        _id: 2,
    },
];

const buildStreamingOptions = (t: TFunction) => [
    { value: StreamingPlatform.YOUTUBE, label: t('streaming.youtube', { ns: NAMESPACE }), _id: 1 },
    { value: StreamingPlatform.MEET, label: t('streaming.googleMeet', { ns: NAMESPACE }), _id: 2 },
    { value: StreamingPlatform.ZOOM, label: t('streaming.zoom', { ns: NAMESPACE }), _id: 3 },
    { value: StreamingPlatform.ZOHO, label: t('streaming.zoho', { ns: NAMESPACE }), _id: 4 },
    { value: StreamingPlatform.BBB, label: t('streaming.vacademyMeet', { ns: NAMESPACE }), _id: 5 },
    { value: StreamingPlatform.OTHER, label: t('streaming.other', { ns: NAMESPACE }), _id: 6 },
];

const buildTimezoneOptions = (t: TFunction) => [
    { value: 'America/Los_Angeles', label: t('timezone.pacific', { ns: NAMESPACE }), _id: 1 },
    { value: 'America/Denver', label: t('timezone.mountain', { ns: NAMESPACE }), _id: 2 },
    { value: 'America/Chicago', label: t('timezone.central', { ns: NAMESPACE }), _id: 3 },
    { value: 'America/New_York', label: t('timezone.eastern', { ns: NAMESPACE }), _id: 4 },
    { value: 'America/Halifax', label: t('timezone.atlantic', { ns: NAMESPACE }), _id: 5 },
    { value: 'America/Sao_Paulo', label: t('timezone.brasilia', { ns: NAMESPACE }), _id: 6 },
    { value: 'Europe/London', label: t('timezone.london', { ns: NAMESPACE }), _id: 7 },
    { value: 'Europe/Paris', label: t('timezone.paris', { ns: NAMESPACE }), _id: 8 },
    { value: 'Europe/Athens', label: t('timezone.athens', { ns: NAMESPACE }), _id: 9 },
    { value: 'Asia/Dubai', label: t('timezone.dubai', { ns: NAMESPACE }), _id: 10 },
    { value: 'Asia/Kolkata', label: t('timezone.india', { ns: NAMESPACE }), _id: 11 },
    { value: 'Asia/Dhaka', label: t('timezone.bangladesh', { ns: NAMESPACE }), _id: 12 },
    { value: 'Asia/Bangkok', label: t('timezone.thailand', { ns: NAMESPACE }), _id: 13 },
    { value: 'Asia/Singapore', label: t('timezone.singapore', { ns: NAMESPACE }), _id: 14 },
    { value: 'Asia/Shanghai', label: t('timezone.china', { ns: NAMESPACE }), _id: 15 },
    { value: 'Asia/Tokyo', label: t('timezone.japan', { ns: NAMESPACE }), _id: 16 },
    { value: 'Australia/Sydney', label: t('timezone.sydney', { ns: NAMESPACE }), _id: 17 },
    { value: 'Pacific/Auckland', label: t('timezone.auckland', { ns: NAMESPACE }), _id: 18 },
];

export {
    buildWaitingRoomOptions,
    buildWaitingRoomTypeOptions,
    buildStreamingOptions,
    buildTimezoneOptions,
};
