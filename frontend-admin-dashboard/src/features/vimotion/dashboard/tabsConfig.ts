export type DashboardTab =
    | 'create'
    | 'recent'
    | 'reels'
    | 'assets'
    | 'avatars'
    | 'brand-kits'
    | 'team';

export const TAB_LABELS: Record<DashboardTab, string> = {
    create: 'Create',
    recent: 'Recent',
    reels: 'Reels',
    assets: 'Assets',
    avatars: 'Avatars',
    'brand-kits': 'Brand Kits',
    team: 'Team',
};

export const TAB_DESCRIPTIONS: Record<DashboardTab, string> = {
    create: 'Describe your video — we’ll handle script, voice, visuals, and render.',
    recent: 'Videos you and your studio have generated.',
    reels: 'Short clips cut from your indexed long-form videos.',
    assets: 'Indexed institute footage and imagery — drop into any video.',
    avatars: 'Saved hosts you can drop into any video.',
    'brand-kits': 'Palette, fonts, layout, and intro/outro/watermark — bundled and swappable.',
    team: 'Invite admins and content creators to your studio.',
};

export const TAB_ORDER: DashboardTab[] = [
    'create',
    'recent',
    'reels',
    'assets',
    'avatars',
    'brand-kits',
    'team',
];

export const isTab = (v: unknown): v is DashboardTab =>
    typeof v === 'string' && TAB_ORDER.includes(v as DashboardTab);
