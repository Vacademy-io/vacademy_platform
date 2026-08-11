/**
 * Design-time stand-ins for the certificate QR and barcode.
 *
 * The real codes are generated server-side at issuance (the number does not
 * exist until then), so the editor and the downloadable preview have nothing
 * real to draw. Without a placeholder these fields render as an empty box and
 * an admin cannot see what they are positioning.
 *
 * Deliberately schematic rather than a scannable code — nothing here encodes a
 * real certificate number, and it should not look like it does.
 */

/** Coarse QR-like block grid. Not scannable; purely to show size and position. */
// Explicit width/height as well as viewBox: the downloadable preview draws
// these onto a canvas via drawImage, and an SVG with only a viewBox rasterises
// to zero size in some browsers — the field would silently vanish from the PDF.
const QR_PLACEHOLDER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="290" height="290" viewBox="0 0 29 29" shape-rendering="crispEdges">
  <rect width="29" height="29" fill="white"/>
  <g fill="black">
    <path d="M0 0h7v7H0z M1 1v5h5V1z M2 2h3v3H2z"/>
    <path d="M22 0h7v7h-7z M23 1v5h5V1z M24 2h3v3h-3z"/>
    <path d="M0 22h7v7H0z M1 23v5h5v-5z M2 24h3v3H2z"/>
    <path d="M9 0h1v1H9z M11 0h1v1h-1z M13 0h1v1h-1z M9 2h1v1H9z M12 2h1v1h-1z
             M0 9h1v1H0z M2 9h1v1H2z M4 9h1v1H4z M0 11h1v1H0z M3 11h1v1H3z
             M9 9h2v2H9z M12 9h2v2h-2z M15 9h2v2h-2z M18 9h2v2h-2z M21 9h2v2h-2z
             M9 12h2v2H9z M13 12h2v2h-2z M17 12h2v2h-2z M21 12h2v2h-2z
             M9 15h2v2H9z M12 15h2v2h-2z M16 15h2v2h-2z M20 15h2v2h-2z
             M9 18h2v2H9z M14 18h2v2h-2z M18 18h2v2h-2z M22 18h2v2h-2z
             M9 21h2v2H9z M12 21h2v2h-2z M16 21h2v2h-2z M21 21h2v2h-2z
             M9 24h2v2H9z M13 24h2v2h-2z M17 24h2v2h-2z M22 24h2v2h-2z
             M24 9h2v2h-2z M27 11h1v1h-1z M25 13h2v2h-2z M24 16h2v2h-2z M27 19h1v1h-1z"/>
  </g>
</svg>`;

/** Code 128-like bar pattern of varying widths. */
const BARCODE_PLACEHOLDER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 100 30" shape-rendering="crispEdges">
  <rect width="100" height="30" fill="white"/>
  <g fill="black">
    <rect x="2" y="2" width="2" height="26"/><rect x="6" y="2" width="1" height="26"/>
    <rect x="9" y="2" width="3" height="26"/><rect x="14" y="2" width="1" height="26"/>
    <rect x="17" y="2" width="2" height="26"/><rect x="22" y="2" width="1" height="26"/>
    <rect x="25" y="2" width="1" height="26"/><rect x="28" y="2" width="3" height="26"/>
    <rect x="33" y="2" width="1" height="26"/><rect x="36" y="2" width="2" height="26"/>
    <rect x="41" y="2" width="1" height="26"/><rect x="44" y="2" width="3" height="26"/>
    <rect x="49" y="2" width="2" height="26"/><rect x="53" y="2" width="1" height="26"/>
    <rect x="56" y="2" width="1" height="26"/><rect x="59" y="2" width="3" height="26"/>
    <rect x="64" y="2" width="1" height="26"/><rect x="67" y="2" width="2" height="26"/>
    <rect x="72" y="2" width="1" height="26"/><rect x="75" y="2" width="3" height="26"/>
    <rect x="80" y="2" width="1" height="26"/><rect x="83" y="2" width="2" height="26"/>
    <rect x="87" y="2" width="1" height="26"/><rect x="90" y="2" width="1" height="26"/>
    <rect x="93" y="2" width="3" height="26"/><rect x="98" y="2" width="1" height="26"/>
  </g>
</svg>`;

const toSvgDataUri = (svg: string): string =>
    `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;

export const CERTIFICATE_QR_PLACEHOLDER = toSvgDataUri(QR_PLACEHOLDER_SVG);
export const CERTIFICATE_BARCODE_PLACEHOLDER = toSvgDataUri(BARCODE_PLACEHOLDER_SVG);

/** Placeholder for a code field, or null when the field isn't one. */
export const resolveCertificateCodePlaceholder = (fieldName: string): string | null => {
    if (fieldName === 'certificate_qr') return CERTIFICATE_QR_PLACEHOLDER;
    if (fieldName === 'certificate_barcode') return CERTIFICATE_BARCODE_PLACEHOLDER;
    return null;
};
