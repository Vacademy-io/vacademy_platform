import { describe, expect, it } from 'vitest';
import { hasLink, linkifySegments } from './linkify';

/** Convenience: just the linked runs, as `text → href` pairs. */
const links = (text: string) =>
    linkifySegments(text)
        .filter((s) => s.kind === 'link')
        .map((s) => [s.text, s.href]);

/** Round-trips the segments back into the original string. */
const rebuilt = (text: string) =>
    linkifySegments(text)
        .map((s) => s.text)
        .join('');

describe('linkifySegments', () => {
    it('leaves link-free text as a single plain segment', () => {
        const segments = linkifySegments('Dear Students, the class starts at 12:00 PM.');
        expect(segments).toEqual([
            { kind: 'text', text: 'Dear Students, the class starts at 12:00 PM.' },
        ]);
    });

    it('links a bare https URL', () => {
        expect(links('Register: https://forms.gle/gUpGToPiFNAG1t4E6')).toEqual([
            ['https://forms.gle/gUpGToPiFNAG1t4E6', 'https://forms.gle/gUpGToPiFNAG1t4E6'],
        ]);
    });

    it('keeps query strings, including the invite links teachers paste', () => {
        const url =
            'https://learner.shikshanation.com/learner-invitation-response?instituteId=35675130-7c65-41d6-a869-0811d2e1753e&inviteCode=pako7s';
        expect(links(`👉Register Now: ${url}`)).toEqual([[url, url]]);
    });

    it('finds every link in a multi-line broadcast', () => {
        const message = [
            '📱 Download the Shiksha Nation App:',
            '🍎 iOS: https://l1nk.dev/wkcg0g9',
            '🤖 Android: https://l1nk.dev/akzpcnu',
        ].join('\n');
        expect(links(message)).toEqual([
            ['https://l1nk.dev/wkcg0g9', 'https://l1nk.dev/wkcg0g9'],
            ['https://l1nk.dev/akzpcnu', 'https://l1nk.dev/akzpcnu'],
        ]);
    });

    it('gives sentence punctuation back to the text, not the link', () => {
        expect(links('See https://vacademy.io/pricing.')).toEqual([
            ['https://vacademy.io/pricing', 'https://vacademy.io/pricing'],
        ]);
        expect(rebuilt('See https://vacademy.io/pricing.')).toBe(
            'See https://vacademy.io/pricing.'
        );
    });

    it('drops an unbalanced closing paren but keeps a balanced one', () => {
        expect(links('(see https://a.io/x)')).toEqual([['https://a.io/x', 'https://a.io/x']]);
        expect(links('https://a.io/x_(y)')).toEqual([['https://a.io/x_(y)', 'https://a.io/x_(y)']]);
    });

    it('prefixes a scheme onto a www link', () => {
        expect(links('www.vacademy.io')).toEqual([['www.vacademy.io', 'https://www.vacademy.io']]);
    });

    it('turns an email into a mailto and a phone into a tel', () => {
        expect(links('Write to support@vacademy.io or call +91 98765 43210')).toEqual([
            ['support@vacademy.io', 'mailto:support@vacademy.io'],
            ['+91 98765 43210', 'tel:+919876543210'],
        ]);
    });

    it('does not light up prose that merely looks domain-ish', () => {
        expect(hasLink('Chapter 8 covers Node.js basics, i.e. 3.5 hours of it')).toBe(false);
    });

    it('refuses a javascript: payload', () => {
        // eslint-disable-next-line no-script-url
        expect(hasLink('javascript:alert(1)')).toBe(false);
        expect(hasLink('data:text/html;base64,PHN2Zz4=')).toBe(false);
    });

    it('preserves the original text exactly when rebuilt', () => {
        const message =
            'Form: https://forms.gle/x4E6, mail me@x.io — details at www.a.io/b (thanks!)';
        expect(rebuilt(message)).toBe(message);
    });
});
