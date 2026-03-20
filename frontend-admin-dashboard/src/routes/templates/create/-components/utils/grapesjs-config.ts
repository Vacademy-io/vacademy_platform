export const getGrapesJSConfig = (presetNewsletter: any) => ({
    height: '100%',
    width: '100%',
    fromElement: false,
    storageManager: false,
    canvas: {
        styles: [],
        scripts: [],
    },
    deviceManager: {
        devices: [
            { id: 'desktop', name: 'Desktop', width: '' },
            { id: 'tablet', name: 'Tablet', width: '768px', widthMedia: '992px' },
            { id: 'mobile', name: 'Mobile', width: '320px', widthMedia: '768px' },
        ],
    },
    layerManager: {
        multipleSelection: false,
    },
    plugins: [presetNewsletter],
    pluginsOpts: {
        [presetNewsletter as unknown as string]: {
            modalImportTitle: '',
            modalImportLabel: '',
        },
    },
    // Panel configuration for modern UI
    panels: {
        defaults: [
            {
                id: 'basic-actions',
                el: '.panel__basic-actions',
                buttons: [
                    {
                        id: 'visibility',
                        active: true,
                        className: 'btn-toggle-borders',
                        label: '<i class="fa fa-clone"></i>',
                        command: 'sw-visibility',
                    },
                ],
            },
            {
                id: 'panel-devices',
                el: '.panel__devices',
                buttons: [
                    {
                        id: 'device-desktop',
                        label: '<i class="fa fa-desktop"></i>',
                        command: 'set-device-desktop',
                        active: true,
                        togglable: false,
                    },
                    {
                        id: 'device-tablet',
                        label: '<i class="fa fa-tablet"></i>',
                        command: 'set-device-tablet',
                        togglable: false,
                    },
                    {
                        id: 'device-mobile',
                        label: '<i class="fa fa-mobile"></i>',
                        command: 'set-device-mobile',
                        togglable: false,
                    },
                ],
            },
        ],
    },
});

export const configureCanvasStyles = () => `
    /* Ensure GrapesJS editor fills container */
    #gjs {
        height: 100% !important;
        width: 100% !important;
        flex: 1 !important;
        min-height: 0 !important;
        display: flex !important;
        flex-direction: column !important;
    }
    
    /* Modern dark theme for panels */
    .gjs-one-bg {
        background-color: #1e1e1e !important;
    }
    
    .gjs-two-bg {
        background-color: #2d2d2d !important;
    }
    
    .gjs-three-bg {
        background-color: #3a3a3a !important;
    }
    
    .gjs-four-bg {
        background-color: #454545 !important;
    }
    
    /* Text colors */
    .gjs-one-color {
        color: #f5f5f5 !important;
    }
    
    .gjs-two-color {
        color: #d4d4d4 !important;
    }
    
    /* Blocks styling */
    .gjs-block {
        min-height: 60px;
        border-radius: 4px;
        transition: all 0.2s ease;
    }
    
    .gjs-block:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    /* Canvas styling */
    .gjs-cv-canvas {
        background-color: #f5f5f5 !important;
        flex: 1 !important;
        min-height: 0 !important;
        overflow-y: auto !important;
    }
    
    /* Component selection styling */
    .gjs-comp-selected {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 2px !important;
    }
    
    /* Toolbar styling */
    .gjs-toolbar {
        background-color: #2563eb !important;
        border-radius: 4px;
    }
    
    .gjs-toolbar-item {
        cursor: pointer !important;
        color: white !important;
    }
    
    .gjs-toolbar-item:hover {
        background-color: #1d4ed8 !important;
    }
    
    /* Resize handles */
    .gjs-resizer {
        border: 2px solid #3b82f6 !important;
        background: #3b82f6 !important;
        width: 8px !important;
        height: 8px !important;
    }
    
    .gjs-resizer:hover {
        background: #2563eb !important;
        border-color: #2563eb !important;
    }
`;
