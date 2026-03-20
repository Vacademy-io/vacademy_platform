import type { Editor } from 'grapesjs';

export const addCustomEmailBlocks = (editor: Editor) => {
    const bm = editor.BlockManager;

    // Add custom email blocks
    bm.add('email-header', {
        label: 'Header',
        category: 'Email',
        content:
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7"><tr><td data-email-cell="true" align="center" style="padding:20px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold"><div data-gjs-type="text">Company</div></td></tr></table>',
    });

    bm.add('email-hero', {
        label: 'Hero',
        category: 'Email',
        content:
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td data-email-cell="true" style="padding:0"><img data-email-img="true" src="https://via.placeholder.com/800x250" width="100%" style="display:block;border:0;outline:0;text-decoration:none" alt="" /></td></tr><tr><td data-email-cell="true" align="center" style="padding:20px 15px;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.5"><div data-gjs-type="text">Welcome to our newsletter</div></td></tr></table>',
    });

    bm.add('email-two-cols', {
        label: 'Two Columns',
        category: 'Email',
        content:
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td data-email-cell="true" valign="top" width="50%" style="padding:10px;font-family:Arial,Helvetica,sans-serif"><div data-gjs-type="text">Left content</div></td><td data-email-cell="true" valign="top" width="50%" style="padding:10px;font-family:Arial,Helvetica,sans-serif"><div data-gjs-type="text">Right content</div></td></tr></table>',
    });

    bm.add('email-cta', {
        label: 'Button',
        category: 'Email',
        content:
            '<table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr><td data-email-cell="true" align="center" bgcolor="#4f46e5" style="border-radius:4px"><a data-email-link="true" href="#" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;font-weight:bold"><span data-gjs-type="text">Call to action</span></a></td></tr></table>',
    });

    bm.add('email-footer', {
        label: 'Footer',
        category: 'Email',
        content:
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7"><tr><td data-email-cell="true" align="center" style="padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#555"><div data-gjs-type="text">You received this email because you signed up on our website.<br/>Unsubscribe</div></td></tr></table>',
    });
};

export const configureCellTraits = (editor: Editor) => {
    editor.on('component:selected', (component) => {
        const type = component.get('type');

        if (type === 'cell' || component.get('tagName') === 'td') {
            const traits = component.get('traits');
            const hasAlignTrait = traits.where({ name: 'align' });

            if (!hasAlignTrait.length) {
                component.addTrait([
                    {
                        type: 'select',
                        name: 'align',
                        label: 'Align',
                        options: [
                            { id: 'left', name: 'Left' },
                            { id: 'center', name: 'Center' },
                            { id: 'right', name: 'Right' },
                        ],
                    },
                    {
                        type: 'select',
                        name: 'valign',
                        label: 'V Align',
                        options: [
                            { id: 'top', name: 'Top' },
                            { id: 'middle', name: 'Middle' },
                            { id: 'bottom', name: 'Bottom' },
                        ],
                    },
                    {
                        type: 'text',
                        name: 'width',
                        label: 'Width',
                        placeholder: 'e.g., 50%, 100%',
                    },
                ]);
            }
        }
    });
};

export const configureStyleManager = (editor: Editor) => {
    const styleManager = editor.StyleManager;
    if (!styleManager) return;

    const sectors = styleManager.getSectors();

    // Helper to check if property exists
    const propertyExists = (propName: string): boolean => {
        return sectors.some((sector: any) => {
            const props = sector.getProperties();
            return props.some((p: any) => {
                const pProperty = p.getProperty ? p.getProperty() : p.property;
                return pProperty === propName;
            });
        });
    };

    // Find or create Dimension sector
    let dimensionSector = sectors.find((s: any) => {
        const id = s.getId ? s.getId() : s.id;
        return id === 'dimension';
    });

    if (!dimensionSector) {
        dimensionSector = styleManager.addSector('dimension', {
            name: 'Dimension',
            open: true,
        });
    }

    // Add dimension properties if they don't exist
    const dimensionProps = [
        {
            name: 'width',
            type: 'integer',
            units: ['px', '%', 'em', 'rem', 'vw', 'auto'],
            property: 'width',
        },
        {
            name: 'height',
            type: 'integer',
            units: ['px', '%', 'em', 'rem', 'vh', 'auto'],
            property: 'height',
        },
    ];

    dimensionProps.forEach((prop) => {
        if (!propertyExists(prop.property)) {
            dimensionSector.addProperty(prop, {});
        }
    });

    // Find or create Position sector
    let positionSector = sectors.find((s: any) => {
        const id = s.getId ? s.getId() : s.id;
        return id === 'position';
    });

    if (!positionSector) {
        positionSector = styleManager.addSector('position', {
            name: 'Position',
            open: false,
        });
    }

    // Add position properties
    const positionProps = [
        {
            name: 'position',
            type: 'select',
            defaults: 'static',
            options: [
                { value: 'static', name: 'Static' },
                { value: 'relative', name: 'Relative' },
                { value: 'absolute', name: 'Absolute' },
                { value: 'fixed', name: 'Fixed' },
                { value: 'sticky', name: 'Sticky' },
            ],
            property: 'position',
        },
        {
            name: 'top',
            type: 'integer',
            units: ['px', '%', 'em', 'auto'],
            property: 'top',
        },
        {
            name: 'left',
            type: 'integer',
            units: ['px', '%', 'em', 'auto'],
            property: 'left',
        },
    ];

    positionProps.forEach((prop) => {
        if (!propertyExists(prop.property)) {
            positionSector.addProperty(prop, {});
        }
    });
};
