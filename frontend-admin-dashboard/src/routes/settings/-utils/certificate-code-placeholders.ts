/**
 * Design-time stand-ins for the certificate QR and barcode.
 *
 * The real codes are generated server-side at issuance (the number does not
 * exist until then), so the editor and the downloadable preview have nothing
 * real to draw. Without a placeholder these fields render as an empty box and
 * an admin cannot see what they are positioning.
 *
 * The QR is a real, scannable code so the preview matches what is printed; it
 * encodes an obvious sample URL, never a real certificate. The barcode is still
 * schematic — there is no Code 128 encoder on the client — so treat its bars as
 * indicative of size and position only.
 */

/**
 * A real, scannable QR — the standard dense pattern, not a drawing of one.
 *
 * <p>This used to be a hand-drawn "QR-like block grid", deliberately schematic
 * so nobody mistook it for a real code. In practice it just looked broken:
 * sparse, with none of the density of an actual QR, so admins reported the
 * certificate QR as faulty when the issued one was fine.
 *
 * <p>It encodes a sample verification URL that is obviously not a real
 * certificate — scanning it lands on SAMPLE-PREVIEW-ONLY rather than any
 * learner's record — so the preview looks exactly like what gets printed
 * without ever standing in for a genuine credential.
 *
 * <p>Generated once with qrcode.react (version 5, level M, 2-module quiet zone)
 * and inlined, so the editor pays no runtime cost and the markup cannot drift.
 * The explicit width/height matter as much as the viewBox: the downloadable
 * preview draws this onto a canvas via drawImage, and an SVG with only a
 * viewBox rasterises to zero size in some browsers — the field would silently
 * vanish from the PDF.
 */
const QR_PLACEHOLDER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" height="290" width="290" viewBox="0 0 37 37"><path fill="#ffffff" d="M0,0 h37v37H0z" shape-rendering="crispEdges"></path><path fill="#000000" d="M2 2h7v1H2zM14 2h2v1H14zM17 2h1v1H17zM19 2h3v1H19zM24 2h2v1H24zM28,2 h7v1H28zM2 3h1v1H2zM8 3h1v1H8zM10 3h1v1H10zM12 3h3v1H12zM16 3h4v1H16zM21 3h3v1H21zM25 3h1v1H25zM28 3h1v1H28zM34,3 h1v1H34zM2 4h1v1H2zM4 4h3v1H4zM8 4h1v1H8zM11 4h1v1H11zM14 4h3v1H14zM18 4h1v1H18zM21 4h2v1H21zM24 4h1v1H24zM28 4h1v1H28zM30 4h3v1H30zM34,4 h1v1H34zM2 5h1v1H2zM4 5h3v1H4zM8 5h1v1H8zM12 5h1v1H12zM14 5h4v1H14zM19 5h3v1H19zM23 5h4v1H23zM28 5h1v1H28zM30 5h3v1H30zM34,5 h1v1H34zM2 6h1v1H2zM4 6h3v1H4zM8 6h1v1H8zM10 6h1v1H10zM12 6h1v1H12zM16 6h1v1H16zM18 6h1v1H18zM20 6h1v1H20zM24 6h1v1H24zM28 6h1v1H28zM30 6h3v1H30zM34,6 h1v1H34zM2 7h1v1H2zM8 7h1v1H8zM13 7h1v1H13zM15 7h7v1H15zM23 7h4v1H23zM28 7h1v1H28zM34,7 h1v1H34zM2 8h7v1H2zM10 8h1v1H10zM12 8h1v1H12zM14 8h1v1H14zM16 8h1v1H16zM18 8h1v1H18zM20 8h1v1H20zM22 8h1v1H22zM24 8h1v1H24zM26 8h1v1H26zM28,8 h7v1H28zM11 9h1v1H11zM13 9h1v1H13zM15 9h1v1H15zM17 9h1v1H17zM19 9h2v1H19zM22 9h5v1H22zM2 10h1v1H2zM4 10h1v1H4zM6 10h1v1H6zM8 10h1v1H8zM12 10h1v1H12zM14 10h2v1H14zM17 10h3v1H17zM22 10h2v1H22zM25 10h2v1H25zM30 10h1v1H30zM33 10h1v1H33zM3 11h1v1H3zM5 11h1v1H5zM10 11h2v1H10zM13 11h1v1H13zM15 11h1v1H15zM18 11h3v1H18zM22 11h1v1H22zM26 11h4v1H26zM33,11 h2v1H33zM3 12h3v1H3zM8 12h7v1H8zM16 12h1v1H16zM27 12h1v1H27zM29 12h1v1H29zM32,12 h3v1H32zM2 13h1v1H2zM9 13h2v1H9zM15 13h2v1H15zM19 13h2v1H19zM22 13h2v1H22zM25 13h1v1H25zM28 13h1v1H28zM30 13h1v1H30zM33,13 h2v1H33zM4 14h1v1H4zM8 14h2v1H8zM11 14h3v1H11zM16 14h1v1H16zM21 14h1v1H21zM26 14h4v1H26zM31 14h1v1H31zM33,14 h2v1H33zM2 15h4v1H2zM7 15h1v1H7zM11 15h1v1H11zM14 15h9v1H14zM25 15h2v1H25zM28 15h2v1H28zM34,15 h1v1H34zM4 16h1v1H4zM6 16h1v1H6zM8 16h3v1H8zM12 16h5v1H12zM18 16h3v1H18zM27 16h1v1H27zM29,16 h6v1H29zM3 17h4v1H3zM12 17h1v1H12zM14 17h6v1H14zM21 17h5v1H21zM28 17h3v1H28zM33 17h1v1H33zM2 18h2v1H2zM5 18h1v1H5zM7 18h2v1H7zM10 18h2v1H10zM14 18h2v1H14zM17 18h3v1H17zM22 18h2v1H22zM26 18h3v1H26zM31 18h1v1H31zM2 19h1v1H2zM6 19h2v1H6zM10 19h2v1H10zM14 19h3v1H14zM18 19h3v1H18zM23 19h2v1H23zM26 19h1v1H26zM28 19h2v1H28zM34,19 h1v1H34zM3 20h4v1H3zM8 20h2v1H8zM11 20h4v1H11zM19 20h1v1H19zM27 20h2v1H27zM32,20 h3v1H32zM2 21h4v1H2zM10 21h4v1H10zM15 21h1v1H15zM17 21h1v1H17zM19 21h2v1H19zM22 21h3v1H22zM27 21h1v1H27zM29 21h2v1H29zM34,21 h1v1H34zM2 22h4v1H2zM8 22h4v1H8zM14 22h2v1H14zM17 22h8v1H17zM26 22h1v1H26zM28 22h2v1H28zM31 22h1v1H31zM33 22h1v1H33zM3 23h1v1H3zM5 23h1v1H5zM7 23h1v1H7zM9 23h1v1H9zM11 23h4v1H11zM16 23h4v1H16zM21 23h2v1H21zM25 23h2v1H25zM28 23h1v1H28zM31 23h1v1H31zM33,23 h2v1H33zM2 24h1v1H2zM5 24h1v1H5zM7 24h2v1H7zM13 24h1v1H13zM15 24h2v1H15zM18 24h1v1H18zM22 24h1v1H22zM24 24h1v1H24zM27 24h2v1H27zM33,24 h2v1H33zM3 25h4v1H3zM15 25h2v1H15zM18 25h2v1H18zM23 25h2v1H23zM27 25h2v1H27zM33 25h1v1H33zM2 26h1v1H2zM5 26h1v1H5zM8 26h2v1H8zM14 26h1v1H14zM16 26h4v1H16zM22 26h3v1H22zM26 26h5v1H26zM33 26h1v1H33zM10 27h2v1H10zM13 27h1v1H13zM18 27h1v1H18zM22 27h1v1H22zM25 27h2v1H25zM30 27h2v1H30zM33,27 h2v1H33zM2 28h7v1H2zM12 28h5v1H12zM18 28h1v1H18zM25 28h2v1H25zM28 28h1v1H28zM30 28h1v1H30zM32 28h1v1H32zM34,28 h1v1H34zM2 29h1v1H2zM8 29h1v1H8zM14 29h3v1H14zM18 29h4v1H18zM23 29h2v1H23zM26 29h1v1H26zM30 29h1v1H30zM2 30h1v1H2zM4 30h3v1H4zM8 30h1v1H8zM10 30h1v1H10zM12 30h1v1H12zM18 30h1v1H18zM21 30h1v1H21zM26 30h6v1H26zM33,30 h2v1H33zM2 31h1v1H2zM4 31h3v1H4zM8 31h1v1H8zM11 31h4v1H11zM17 31h2v1H17zM21 31h2v1H21zM24 31h1v1H24zM30 31h3v1H30zM34,31 h1v1H34zM2 32h1v1H2zM4 32h3v1H4zM8 32h1v1H8zM10 32h1v1H10zM16 32h1v1H16zM20 32h1v1H20zM22 32h2v1H22zM26 32h1v1H26zM30 32h3v1H30zM34,32 h1v1H34zM2 33h1v1H2zM8 33h1v1H8zM11 33h2v1H11zM18 33h4v1H18zM23 33h1v1H23zM28 33h1v1H28zM30 33h1v1H30zM33 33h1v1H33zM2 34h7v1H2zM10 34h2v1H10zM13 34h2v1H13zM16 34h4v1H16zM22 34h2v1H22zM25 34h4v1H25zM30 34h1v1H30zM33,34 h2v1H33z" shape-rendering="crispEdges"></path></svg>`;

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
