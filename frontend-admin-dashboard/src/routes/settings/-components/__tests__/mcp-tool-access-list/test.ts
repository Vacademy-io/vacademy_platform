import { describe, expect, it } from 'vitest';
import type { McpToolCatalogEntry } from '../../../-constants/mcp-server';
import { autoEditKeys, groupToolsByArea, withAreaLevel } from '../../McpToolAccessList';
import en from '../../../../../../public/locales/en/settingsMcpServer.json';
import hi from '../../../../../../public/locales/hi/settingsMcpServer.json';
import ar from '../../../../../../public/locales/ar/settingsMcpServer.json';
import fr from '../../../../../../public/locales/fr/settingsMcpServer.json';

const tool = (over: Partial<McpToolCatalogEntry>): McpToolCatalogEntry => ({
    name: over.key ?? 'x',
    key: 'x',
    label: 'x',
    description: '',
    mode: 'WRITE',
    area: 'website',
    level: 'edit',
    risk: 'drafts',
    ...over,
});

/** The one area a catalogue groups into. */
const onlyArea = (tools: McpToolCatalogEntry[]) => {
    const [area] = groupToolsByArea(tools);
    if (!area) throw new Error('no area');
    return area;
};

const catalogue: McpToolCatalogEntry[] = [
    tool({ key: 'website_builder', mode: 'READ', level: 'view', risk: null }),
    tool({ key: 'website_builder_edits' }),
    tool({ key: 'design_import' }),
    tool({ key: 'website_data_edits', risk: 'live_additive' }),
];

describe('MCP access: live-additive edits are opt-in', () => {
    const website = onlyArea(catalogue);

    it('the Edit level turns on every edit except the live-additive one', () => {
        const next = withAreaLevel(website, 'edit', []);
        expect(next.sort()).toEqual(['design_import', 'website_builder', 'website_builder_edits']);
        expect(autoEditKeys(website)).not.toContain('website_data_edits');
    });

    it('keeps it when already on, and Off / View remove it', () => {
        const on = ['website_builder', 'website_data_edits'];
        expect(withAreaLevel(website, 'edit', on)).toContain('website_data_edits');
        expect(withAreaLevel(website, 'view', on)).toEqual(['website_builder']);
        expect(withAreaLevel(website, 'off', on)).toEqual([]);
    });

    it('an area with only opt-in edits still has something to turn on', () => {
        const only = onlyArea([
            tool({ key: 'v', mode: 'READ', level: 'view', risk: null, area: 'a' }),
            tool({ key: 'e', risk: 'live_additive', area: 'a' }),
        ]);
        expect(autoEditKeys(only)).toEqual(['e']);
    });

    it('every locale names the risk', () => {
        for (const locale of [en, hi, ar, fr]) {
            expect(typeof locale.tools.risk.live_additive).toBe('string');
            expect(locale.tools.risk.live_additive.length).toBeGreaterThan(0);
        }
    });
});
