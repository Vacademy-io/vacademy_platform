export type DashboardTab = 'create' | 'recent' | 'assets' | 'avatars' | 'brand-kits';

export const TAB_LABELS: Record<DashboardTab, string> = {
    create: 'Create',
    recent: 'Recent',
    assets: 'Assets',
    avatars: 'Avatars',
    'brand-kits': 'Brand Kits',
};

export const TAB_DESCRIPTIONS: Record<DashboardTab, string> = {
    create: 'Describe your video — we’ll handle script, voice, visuals, and render.',
    recent: 'Videos you and your studio have generated.',
    assets: 'Indexed institute footage and imagery — drop into any video.',
    avatars: 'Saved hosts you can drop into any video.',
    'brand-kits': 'Palette, fonts, layout, and intro/outro/watermark — bundled and swappable.',
};

export const TAB_ORDER: DashboardTab[] = ['create', 'recent', 'assets', 'avatars', 'brand-kits'];

export const isTab = (v: unknown): v is DashboardTab =>
    typeof v === 'string' && TAB_ORDER.includes(v as DashboardTab);
