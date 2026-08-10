import Capacitor
import WebKit

/// App's bridge view controller subclass. Two responsibilities beyond the Capacitor default:
///
/// 1. Registers the `offline-media://` URL scheme handler on the WKWebViewConfiguration
///    *before* the WKWebView is constructed (must happen here — WKWebViewConfiguration's
///    scheme handlers are immutable once the web view exists).
/// 2. Registers the `OfflineMediaPlugin` instance once the bridge is available. This plugin is
///    a local, in-repo plugin (no npm package), so it is not present in `capacitor.config.json`'s
///    auto-registration list and must be registered manually via `registerPluginInstance`.
///
/// Main.storyboard's root view controller's custom class has been changed from
/// `CAPBridgeViewController` (Capacitor module) to `MainViewController` (App module) to route
/// through this subclass.
class MainViewController: CAPBridgeViewController {

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.setURLSchemeHandler(OfflineMediaSchemeHandler(), forURLScheme: OfflineMediaPlugin.scheme)
        return configuration
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(OfflineMediaPlugin())
    }
}
