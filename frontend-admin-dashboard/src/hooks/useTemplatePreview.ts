import { useState, useEffect } from 'react';

export const useTemplatePreview = () => {
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'laptop'>('laptop');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [previewWidth, setPreviewWidth] = useState(1024);

  const DEVICE_PRESETS: Record<typeof previewDevice, { label: string; width: number }> = {
    mobile: { label: 'Mobile', width: 390 },
    tablet: { label: 'Tablet', width: 768 },
    laptop: { label: 'Laptop', width: 1024 },
  };

  // Update window width on resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update preview width when device or window width changes
  useEffect(() => {
    const deviceWidth = DEVICE_PRESETS[previewDevice].width;
    const availableWidth = windowWidth - 120; // Account for padding and margins
    setPreviewWidth(Math.min(deviceWidth, availableWidth));
  }, [previewDevice, windowWidth]);

  return {
    previewDevice,
    setPreviewDevice,
    previewWidth,
    DEVICE_PRESETS,
  };
};
