
import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";
import { Wifi, WifiOff } from "lucide-react";
import type { PluginListenerHandle } from "@capacitor/core"; 

const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const checkNetworkStatus = async () => {
      const status = await Network.getStatus();
      setIsOnline(status.connected);
      setShowAlert(!status.connected);
    };

    checkNetworkStatus();

    let listener: PluginListenerHandle | null = null; // Explicitly type the listener

    const setupListener = async () => {
      listener = await Network.addListener("networkStatusChange", (status) => {
        setIsOnline(status.connected);
        setShowAlert(true);

        // Auto-hide the online notification after 2 seconds
        if (status.connected) {
          setTimeout(() => setShowAlert(false), 2000);
        }
      });
    };

    setupListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, []);

  

  if (!showAlert) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-start justify-center">
      <div 
        className={`
          mt-4 flex items-center gap-3 rounded-lg px-4 py-2
          transform transition-all duration-300 ease-in-out
          ${isOnline 
            ? 'bg-[#0f0f0f] text-white' 
            : 'bg-[#0f0f0f] text-white'
          }
          ${showAlert ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
        `}
      >
        <div className="flex items-center gap-3">
          {isOnline ? (
            <>
              <Wifi className="h-5 w-5 text-green-500" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Back online</span>
                <span className="text-xs text-gray-400">Your network connection was restored</span>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-red-500" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">No Internet connection</span>
                <span className="text-xs text-gray-400">Check your network settings</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkStatus;