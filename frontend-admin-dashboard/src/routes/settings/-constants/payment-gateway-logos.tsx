/**
 * Official brandmarks for the payment gateways we integrate with, inlined as SVG so they render
 * crisply at badge size and never depend on a CDN at runtime. These are the vendors' own marks used
 * nominatively (to identify which gateway processed a payment) — do not restyle or recolour them.
 *
 * A gateway with no mark here falls back to the letter badge from `payment-gateway-branding`.
 */

import { normalizeVendor } from './payment-gateway-branding';

/**
 * The vendors' own brand colours. These are trademarked values, not design tokens — a logo recoloured
 * to our palette is no longer that company's logo, so they are exempt from the tokens-only rule.
 */
const BRAND = {
    razorpay: '#0C2451', // design-lint-ignore — official brand colour
    stripe: '#635BFF', // design-lint-ignore — official brand colour
    cashfreeGreen: '#04AA61', // design-lint-ignore — official brand colour
    cashfreeAmber: '#FBB016', // design-lint-ignore — official brand colour
    phonepe: '#5F259F', // design-lint-ignore — official brand colour
    paytm: '#20336B', // design-lint-ignore — official brand colour
    paypal: '#002991', // design-lint-ignore — official brand colour
} as const;

export interface GatewayLogoProps {
    /** Rendered edge length in px. */
    size?: number;
    className?: string;
}

const RazorpayLogo = ({ size = 15, className }: GatewayLogoProps) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={BRAND.razorpay}
        className={className}
        aria-hidden="true"
        focusable="false"
    >
        <path d="M22.436 0l-11.91 7.773-1.174 4.276 6.625-4.297L11.65 24h4.391l6.395-24zM14.26 10.098L3.389 17.166 1.564 24h9.008l3.688-13.902Z" />
    </svg>
);

const StripeLogo = ({ size = 15, className }: GatewayLogoProps) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={BRAND.stripe}
        className={className}
        aria-hidden="true"
        focusable="false"
    >
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
    </svg>
);

/** Cashfree's two-tone mark (green stem + amber bars), traced from their 256px app icon. */
const CashfreeLogo = ({ size = 15, className }: GatewayLogoProps) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 256 256"
        fill="none"
        className={className}
        aria-hidden="true"
        focusable="false"
    >
        <path
            d="M74 60A30 30 0 0 1 104 30H225V32A30 30 0 0 1 195 62H104V152A30 30 0 0 1 74 182Z"
            fill={BRAND.cashfreeGreen}
        />
        <path d="M30 105A31 31 0 0 1 61 74V195A31 31 0 0 1 30 226Z" fill={BRAND.cashfreeAmber} />
        <path d="M116 74H186V75A31 31 0 0 1 155 106H116Z" fill={BRAND.cashfreeAmber} />
    </svg>
);

const PhonePeLogo = ({ size = 15, className }: GatewayLogoProps) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={BRAND.phonepe}
        className={className}
        aria-hidden="true"
        focusable="false"
    >
        <path d="M10.206 9.941h2.949v4.692c-.402.201-.938.268-1.34.268-1.072 0-1.609-.536-1.609-1.743V9.941zm13.47 4.816c-1.523 6.449-7.985 10.442-14.433 8.919C2.794 22.154-1.199 15.691.324 9.243 1.847 2.794 8.309-1.199 14.757.324c6.449 1.523 10.442 7.985 8.919 14.433zm-6.231-5.888a.887.887 0 0 0-.871-.871h-1.609l-3.686-4.222c-.335-.402-.871-.536-1.407-.402l-1.274.401c-.201.067-.268.335-.134.469l4.021 3.82H6.386c-.201 0-.335.134-.335.335v.67c0 .469.402.871.871.871h.938v3.217c0 2.413 1.273 3.82 3.418 3.82.67 0 1.206-.067 1.877-.335v2.145c0 .603.469 1.072 1.072 1.072h.938a.432.432 0 0 0 .402-.402V9.874h1.542c.201 0 .335-.134.335-.335v-.67z" />
    </svg>
);

const PaytmLogo = ({ size = 15, className }: GatewayLogoProps) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={BRAND.paytm}
        className={className}
        aria-hidden="true"
        focusable="false"
    >
        <path d="M15.85 8.167a.204.204 0 0 0-.04.004c-.68.19-.543 1.148-1.781 1.23h-.12a.23.23 0 0 0-.052.005h-.001a.24.24 0 0 0-.184.235v1.09c0 .134.106.241.237.241h.645v4.623c0 .132.104.238.233.238h1.058a.236.236 0 0 0 .233-.238v-4.623h.6c.13 0 .236-.107.236-.241v-1.09a.239.239 0 0 0-.236-.24h-.612V8.386a.218.218 0 0 0-.216-.22zm4.225 1.17c-.398 0-.762.15-1.042.395v-.124a.238.238 0 0 0-.234-.224h-1.07a.24.24 0 0 0-.236.242v5.92a.24.24 0 0 0 .236.242h1.07c.12 0 .217-.091.233-.209v-4.25a.393.393 0 0 1 .371-.408h.196a.41.41 0 0 1 .226.09.405.405 0 0 1 .145.319v4.074l.004.155a.24.24 0 0 0 .237.241h1.07a.239.239 0 0 0 .235-.23l-.001-4.246c0-.14.062-.266.174-.34a.419.419 0 0 1 .196-.068h.198c.23.02.37.2.37.408.005 1.396.004 2.8.004 4.224a.24.24 0 0 0 .237.241h1.07c.13 0 .236-.108.236-.241v-4.543c0-.31-.034-.442-.08-.577a1.601 1.601 0 0 0-1.51-1.09h-.015a1.58 1.58 0 0 0-1.152.5c-.291-.308-.7-.5-1.153-.5zM.232 9.4A.234.234 0 0 0 0 9.636v5.924c0 .132.096.238.216.241h1.09c.13 0 .237-.107.237-.24l.004-1.658H2.57c.857 0 1.453-.605 1.453-1.481v-1.538c0-.877-.596-1.484-1.453-1.484H.232zm9.032 0a.239.239 0 0 0-.237.241v2.47c0 .94.657 1.608 1.579 1.608h.675s.016 0 .037.004a.253.253 0 0 1 .222.253c0 .13-.096.235-.219.251l-.018.004-.303.006H9.739a.239.239 0 0 0-.236.24v1.09a.24.24 0 0 0 .236.242h1.75c.92 0 1.577-.669 1.577-1.608v-4.56a.239.239 0 0 0-.236-.24h-1.07a.239.239 0 0 0-.236.24c-.005.787 0 1.525 0 2.255a.253.253 0 0 1-.25.25h-.449a.253.253 0 0 1-.25-.255c.005-.754-.005-1.5-.005-2.25a.239.239 0 0 0-.236-.24zm-4.004.006a.232.232 0 0 0-.238.226v1.023c0 .132.113.24.252.24h1.413c.112.017.2.1.213.23v.14c-.013.124-.1.214-.207.224h-.7c-.93 0-1.594.63-1.594 1.515v1.269c0 .88.57 1.506 1.495 1.506h1.94c.348 0 .63-.27.63-.6v-4.136c0-1.004-.508-1.637-1.72-1.637zm-3.713 1.572h.678c.139 0 .25.115.25.256v.836a.253.253 0 0 1-.25.256h-.1c-.192.002-.386 0-.578 0zm4.67 1.977h.445c.139 0 .252.108.252.24v.932a.23.23 0 0 1-.014.076.25.25 0 0 1-.238.164h-.445a.247.247 0 0 1-.252-.24v-.933c0-.132.113-.239.252-.239Z" />
    </svg>
);

const PayPalLogo = ({ size = 15, className }: GatewayLogoProps) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={BRAND.paypal}
        className={className}
        aria-hidden="true"
        focusable="false"
    >
        <path d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z" />
    </svg>
);

/** Keyed by the same canonical uppercase vendor code as `GATEWAY_BRANDING`. */
export const GATEWAY_LOGOS: Record<string, (props: GatewayLogoProps) => JSX.Element> = {
    RAZORPAY: RazorpayLogo,
    STRIPE: StripeLogo,
    CASHFREE: CashfreeLogo,
    PHONEPE: PhonePeLogo,
    PAYTM: PaytmLogo,
    PAYPAL: PayPalLogo,
};

/** Brandmark for a free-form `payment_log.vendor` string, or `undefined` if we don't have one. */
export const resolveGatewayLogo = (
    vendor?: string | null
): ((props: GatewayLogoProps) => JSX.Element) | undefined => GATEWAY_LOGOS[normalizeVendor(vendor)];
