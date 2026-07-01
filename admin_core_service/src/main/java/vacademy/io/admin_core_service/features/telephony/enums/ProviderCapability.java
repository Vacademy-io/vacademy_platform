package vacademy.io.admin_core_service.features.telephony.enums;

/**
 * The full surface of telephony capabilities a provider adapter MAY support.
 * Each provider declares the subset it implements via
 * {@code TelephonyProviderDescriptor#capabilities()}; the core, controllers and
 * the admin UI branch on these flags instead of on {@code providerType} string
 * equality, so one provider-agnostic code path serves every provider.
 *
 * Absence of a flag = the capability is off (and, for the optional ports, the
 * adapter simply ships no bean — the registry returns empty and the feature
 * self-disables). Exotel and Vonage/Airtel differ structurally (pooled numbers
 * vs per-counsellor DID, synchronous answer-applet vs native inbound, push
 * status-callbacks vs a single signed webhook, push vs pull recording), which
 * is exactly what these flags exist to absorb.
 */
public enum ProviderCapability {
    /** Place a bridged outbound (click-to-call) request. Every provider has it. */
    OUTBOUND_CALL,
    /** Shared pool of caller-ID numbers selected per call (Exotel ExoPhones).
     *  Off => caller-ID is identity-derived (e.g. the counsellor's own DID). */
    NUMBER_POOL,
    /** Inbound is answered by us synchronously and we return a routing applet
     *  (Exotel Connect-applet / Twilio TwiML). Off => the provider routes the
     *  inbound call natively to the counsellor and we only observe + log it. */
    SYNC_INBOUND_APPLET,
    /** Provider pushes real-time call lifecycle events to a webhook. */
    REALTIME_EVENTS,
    /** Call recordings are available (pushed on a status callback or pulled
     *  from a recordings API). */
    RECORDING,
    /** Live call control: blind/warm transfer + hold. */
    TRANSFER,
    /** A number must be bound to the provider's inbound flow/application before
     *  it routes (Exotel App-Bazaar flow attach). */
    NUMBER_ATTACH,
    /** The provider exposes an API to list the numbers/DIDs it issued. */
    NUMBER_SYNC,
    /** The provider exposes an account wallet/balance reading. */
    BALANCE,
    /** The provider reports the call's outcome ONCE at the end (AI-calling),
     *  rather than via incremental per-state events. */
    SINGLE_FINAL_EVENT,
    /** Inbound calls are routed through an institute-authored multi-level IVR tree
     *  (ivr_menu/ivr_node) rendered as the provider's answer applet. Gates the IVR
     *  tree-builder UI. Plivo (Vacademy Voice) declares it. */
    IVR_BUILDER,
    /** A Vacademy-managed first-party voice product (own Plivo subaccount per
     *  institute) with a settings-driven product-config surface (enable flag,
     *  caller-ID, recording, timezone, compliance status, plan/channels). Gates the
     *  "Vacademy Voice" settings card. Plivo declares it. */
    MANAGED_VOICE
}
