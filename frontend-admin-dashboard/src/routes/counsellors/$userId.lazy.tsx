import { createLazyFileRoute } from '@tanstack/react-router';
import { CounsellorsRouteWrapper } from './index.lazy';

/**
 * `/counsellors/<userId>` renders the SAME page as `/counsellors`, with the
 * drawer pre-opened for the URL's counsellor. We reuse
 * `CounsellorsRouteWrapper` so the display-settings feature gate runs here
 * too — a custom-role user without the Counsellors sub-tab enabled gets the
 * same FeatureDisabledNotice on a deep link as they would on the parent URL.
 *
 * Drawer open/close drives `navigate()` in `WorkbenchPage`, so the URL is
 * always the source of truth: paste `/counsellors/<userId>` to a colleague
 * and they land directly on that counsellor's detail drawer.
 */
export const Route = createLazyFileRoute('/counsellors/$userId')({
    component: CounsellorsRouteWrapper,
});
