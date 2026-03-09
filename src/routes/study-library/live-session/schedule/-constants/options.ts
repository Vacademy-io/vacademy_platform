import { StreamingPlatform } from '../../-constants/enums';

const WAITING_ROOM_OPTIONS = [
    { value: '5', label: '5 minutes', _id: 1 },
    { value: '10', label: '10 minutes', _id: 2 },
    { value: '15', label: '15 minutes', _id: 3 },
    { value: '30', label: '30 minutes', _id: 4 },
    { value: '45', label: '45 minutes', _id: 5 },
];

const STREAMING_OPTIONS = [
    { value: StreamingPlatform.YOUTUBE, label: 'Youtube', _id: 1 },
    { value: StreamingPlatform.MEET, label: 'Google Meet', _id: 2 },
    { value: StreamingPlatform.ZOOM, label: 'Zoom', _id: 3 },
    { value: StreamingPlatform.ZOHO, label: 'Zoho', _id: 4 },
    { value: StreamingPlatform.OTHER, label: 'Other', _id: 5 },
];

const TIMEZONE_OPTIONS = [
    {
        value: 'America/Los_Angeles',
        label: 'Pacific Time (US & Canada)',
        _id: 1,
    },
    {
        value: 'America/Denver',
        label: 'Mountain Time (US & Canada)',
        _id: 2,
    },
    {
        value: 'America/Chicago',
        label: 'Central Time (US & Canada)',
        _id: 3,
    },
    {
        value: 'America/New_York',
        label: 'Eastern Time (US & Canada)',
        _id: 4,
    },
    {
        value: 'America/Halifax',
        label: 'Atlantic Time (Canada)',
        _id: 5,
    },
    {
        value: 'America/Sao_Paulo',
        label: 'Brasilia, São Paulo',
        _id: 6,
    },
    {
        value: 'Europe/London',
        label: 'London, Dublin, Edinburgh',
        _id: 7,
    },
    {
        value: 'Europe/Paris',
        label: 'Paris, Berlin, Rome',
        _id: 8,
    },
    {
        value: 'Europe/Athens',
        label: 'Athens, Cairo, Helsinki',
        _id: 9,
    },
    {
        value: 'Asia/Dubai',
        label: 'Dubai, Abu Dhabi',
        _id: 10,
    },
    {
        value: 'Asia/Kolkata',
        label: 'India Standard Time (Mumbai, Delhi)',
        _id: 11,
    },
    {
        value: 'Asia/Dhaka',
        label: 'Bangladesh Standard Time (Dhaka)',
        _id: 12,
    },
    {
        value: 'Asia/Bangkok',
        label: 'Thailand, Vietnam (Bangkok)',
        _id: 13,
    },
    {
        value: 'Asia/Singapore',
        label: 'Singapore, Malaysia',
        _id: 14,
    },
    {
        value: 'Asia/Shanghai',
        label: 'China Standard Time (Beijing)',
        _id: 15,
    },
    {
        value: 'Asia/Tokyo',
        label: 'Japan Standard Time (Tokyo)',
        _id: 16,
    },
    {
        value: 'Australia/Sydney',
        label: 'Australian Eastern Time (Sydney)',
        _id: 17,
    },
    {
        value: 'Pacific/Auckland',
        label: 'New Zealand (Auckland)',
        _id: 18,
    },
];

export { WAITING_ROOM_OPTIONS, STREAMING_OPTIONS, TIMEZONE_OPTIONS };
