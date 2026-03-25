import React from 'react';
import { Button } from '@/components/ui/button';
import { Monitor, Tablet, Smartphone } from 'lucide-react';

interface DeviceSelectorProps {
  previewDevice: 'mobile' | 'tablet' | 'laptop';
  onDeviceChange: (device: 'mobile' | 'tablet' | 'laptop') => void;
  className?: string;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  previewDevice,
  onDeviceChange,
  className = '',
}) => {
  const devices = [
    { key: 'mobile' as const, label: 'Mobile', icon: Smartphone },
    { key: 'tablet' as const, label: 'Tablet', icon: Tablet },
    { key: 'laptop' as const, label: 'Laptop', icon: Monitor },
  ];

  return (
    <div className={`flex items-center gap-1 sm:gap-2 ${className}`}>
      {devices.map(({ key, label, icon: Icon }) => (
        <Button
          key={key}
          variant="outline"
          size="sm"
          onClick={() => onDeviceChange(key)}
          className={`flex items-center gap-1 sm:gap-2 transition-all rounded-none border-0 border-b-2 text-xs sm:text-sm ${
            previewDevice === key
              ? 'border-primary-500 text-primary-600 bg-primary-50/50'
              : 'border-transparent hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Icon className="size-3 sm:size-4" />
          <span className="hidden xs:inline">{label}</span>
          <span className="xs:hidden">{label.charAt(0)}</span>
        </Button>
      ))}
    </div>
  );
};
