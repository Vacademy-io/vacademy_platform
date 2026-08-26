import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { CertificateVisualEditor } from '@/routes/settings/-components/Certificates/CertificateVisualEditor';
import type { FieldMapping, ImageTemplate } from '@/types/certificate/certificate-types';

/**
 * The field properties panel — where X and Y are typed in.
 *
 * <p>The panel is `position: fixed`, so the page cannot scroll it. Its content
 * (font, colour, alignment, Position, Field Size) is taller than a laptop
 * viewport, which put the X/Y boxes below the fold with no way to reach them.
 */

const template: ImageTemplate = {
    id: 'tpl-1',
    fileName: 'bg.png',
    originalFileName: 'bg.png',
    imageDataUrl: 'https://cdn.example/bg.png',
    width: 1123,
    height: 794,
    format: 'png',
    createdAt: '2026-01-01',
    sourceType: 'image',
};

const field: FieldMapping = {
    id: 'f1',
    fieldName: 'course_name',
    displayName: 'Course Name',
    type: 'text',
    position: { x: 100, y: 300, width: 400, height: 60 },
    style: {
        fontSize: 32,
        fontColor: '#111111',
        fontFamily: 'Arial, sans-serif',
        alignment: 'center',
        fontWeight: 'normal',
    },
};

const openPanel = () => {
    render(
        <DndContext>
            <CertificateVisualEditor
                imageTemplate={template}
                fieldMappings={[field]}
                onFieldMappingsChange={vi.fn()}
            />
        </DndContext>
    );
    fireEvent.click(screen.getByText('Course Name'));
    return screen.getByText('Field Properties').closest('div.fixed') as HTMLElement;
};

describe('field properties panel', () => {
    it('opens on the field that was clicked', () => {
        expect(openPanel()).toBeTruthy();
        expect(screen.getByText('X Position')).toBeInTheDocument();
        expect(screen.getByText('Y Position')).toBeInTheDocument();
    });

    /** The fix: the panel body scrolls, so X/Y are always reachable. */
    it('scrolls its own content instead of running off the screen', () => {
        const panel = openPanel();
        const body = panel.querySelector('.overflow-y-auto');
        expect(body).not.toBeNull();
        expect(body!.className).toContain('flex-1');
        // Bounded to the viewport below the panel's top edge — without a cap
        // there is nothing for the overflow to trigger against.
        expect(panel.style.maxHeight).toContain('100vh');
    });

    /** Scrolling the body must not take the header with it. */
    it('keeps the header in place while the body scrolls', () => {
        const panel = openPanel();
        const header = screen.getByText('Field Properties').closest('div.shrink-0');
        expect(header).not.toBeNull();
        expect(panel.className).toContain('flex-col');
    });
});
