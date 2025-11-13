import React, { useState, useEffect, useRef } from 'react';
import { IntroPage } from '../-types/course-catalogue-types';
import { ChevronLeftIcon, ChevronRightIcon, X } from 'lucide-react';
import { useDomainRouting } from '@/hooks/use-domain-routing';
import { getPublicUrlWithoutLogin } from '@/services/upload_file';
import { useNavigate } from '@tanstack/react-router';
import { navigateByHomeIcon } from '@/utils/home-icon-click';

interface IntroPageComponentProps {
  introPage: IntroPage;
  onGetStarted: () => void;
  onLogin: () => void;
  onComplete: () => void;
  onClose: () => void;
  leadCollectionSettings?: any;
  instituteId?: string;
}

export const IntroPageComponent: React.FC<IntroPageComponentProps> = ({
  introPage,
  onGetStarted,
  onLogin,
  onComplete,
  onClose,
  leadCollectionSettings,
  instituteId,
}) => {
  const domainRouting = useDomainRouting();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [instituteLogoUrl, setInstituteLogoUrl] = useState<string | null>(null);
  const [processedImages, setProcessedImages] = useState<Array<{ source: string; caption: string }>>([]);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Load institute logo
  useEffect(() => {
    const loadInstituteLogo = async () => {
      if (domainRouting.instituteLogoFileId) {
        try {
          const url = await getPublicUrlWithoutLogin(domainRouting.instituteLogoFileId);
          setInstituteLogoUrl(url);
        } catch (error) {
          console.error('Error loading institute logo:', error);
        }
      }
    };

    loadInstituteLogo();
  }, [domainRouting.instituteLogoFileId]);

  // Process images (convert Google Drive URLs to direct format)
  useEffect(() => {
    const processImages = () => {
      const processed = introPage.imageSlider.images.map((image) => {
        // Convert Google Drive URLs to direct format
        if (image.source.includes('drive.google.com/uc?id=')) {
          // Extract file ID and convert to direct format
          const fileIdMatch = image.source.match(/id=([^&]+)/);
          if (fileIdMatch) {
            const fileId = fileIdMatch[1];
            // Convert to direct Google Drive image URL
            const directUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920-h1080`;
            return { source: directUrl, caption: image.caption };
          }
        }
        return { source: image.source, caption: image.caption };
      });
      setProcessedImages(processed);
    };

    processImages();
  }, [introPage.imageSlider.images]);

  // Auto-play functionality - DISABLED
  // useEffect(() => {
  //   if (isAutoPlaying && introPage.imageSlider.autoPlay && processedImages.length > 0) {
  //     intervalRef.current = setInterval(() => {
  //       setCurrentImageIndex((prev) => 
  //         prev === processedImages.length - 1 ? 0 : prev + 1
  //       );
  //     }, introPage.imageSlider.interval);
  //   }

  //   return () => {
  //     if (intervalRef.current) {
  //       clearInterval(intervalRef.current);
  //     }
  //   };
  // }, [isAutoPlaying, introPage.imageSlider.autoPlay, introPage.imageSlider.interval, processedImages.length]);

  // Auto-completion removed - user must click "Get Started" to proceed

  const nextImage = () => {
    if (currentImageIndex === processedImages.length - 1) {
      // On last slide, navigate to catalogue
      onComplete();
    } else {
      // On other slides, go to next image
      setCurrentImageIndex((prev) => prev + 1);
    }
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? 0 : prev - 1
    );
  };

  const handleButtonClick = (action: string) => {
    switch (action) {
      case 'loadNextSection':
        onComplete();
        break;
      case 'navigateToLogin':
        onLogin();
        break;
      case 'openLeadCollection':
        setShowLeadForm(true);
        break;
      default:
        onComplete();
    }
  };

  const handleLeadFormClose = () => {
    setShowLeadForm(false);
  };

  const handleLeadFormSubmit = () => {
    setShowLeadForm(false);
    onComplete(); // Go to catalogue after form submission
  };

  const getButtonStyle = (style: string) => {
    const baseClasses = 'px-6 py-3 rounded-lg font-semibold transition-colors duration-200';
    const themeColor = domainRouting.instituteThemeCode ? 
      `hsl(var(--primary))` : 
      '#3b82f6';
    const themeColorHover = domainRouting.instituteThemeCode ? 
      `hsl(var(--primary) / 0.9)` : 
      '#2563eb';
    
    switch (style) {
      case 'primary':
        return `${baseClasses} text-white hover:opacity-90`;
      case 'outlined':
        return `${baseClasses} border-2 hover:text-white`;
      case 'text':
        return `${baseClasses} hover:opacity-80`;
      default:
        return `${baseClasses} text-white hover:opacity-90`;
    }
  };

  const getButtonStyles = (style: string) => {
    const themeColor = domainRouting.instituteThemeCode ? 
      `hsl(var(--primary))` : 
      '#3b82f6';
    const themeColorHover = domainRouting.instituteThemeCode ? 
      `hsl(var(--primary) / 0.9)` : 
      '#2563eb';
    
    switch (style) {
      case 'primary':
        return {
          backgroundColor: themeColor,
          color: 'white',
          border: 'none'
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          color: themeColor,
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: themeColor
        };
      case 'text':
        return {
          backgroundColor: 'transparent',
          color: themeColor,
          border: 'none'
        };
      default:
        return {
          backgroundColor: themeColor,
          color: 'white',
          border: 'none'
        };
    }
  };

  if (!introPage.enabled) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 z-50 bg-white ${introPage.fullScreen ? 'h-screen' : 'h-full'} overflow-hidden flex flex-col pb-20 md:pb-0`}
      ref={sliderRef}
    >
      {/* Close button - only show if not fullScreen or if showHeader is true */}
      {(!introPage.fullScreen || introPage.showHeader) && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
          title="Close"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      {/* Logo - Use institute logo from domainRouting */}
      {instituteLogoUrl && (
        <div className={`flex-shrink-0 py-4 pt-10 md:pt-4 ${
          introPage.logo?.alignment === 'left' ? 'self-start pl-4' : 
          introPage.logo?.alignment === 'right' ? 'self-end pr-4' : 
          'self-center'
        } cursor-pointer`}
          onClick={() => navigateByHomeIcon(domainRouting.homeIconClickRoute, navigate)}
          role="button"
          aria-label="Go to home"
          title="Home"
        >
          <img
            src={instituteLogoUrl}
            alt={domainRouting.instituteName || "Institute Logo"}
            style={{ height: introPage.logo?.height || "80px" }}
            className="object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      )}

      {/* Image Slider or Lead Collection Form */}
      {!showLeadForm ? (
        <div 
          className="relative w-full flex-1 overflow-hidden"
          style={{ 
            backgroundColor: 'white',
            minHeight: '400px',
            maxHeight: '70vh'
          }}
        >
        {processedImages.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Image Caption - Above the image with proper spacing */}
            <div className="absolute top-4 left-0 right-0 text-center px-4 z-10 mb-4">
              <p className="text-gray-800 text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold">
                {image.caption}
              </p>
            </div>
            
            <img
              src={image.source}
              alt={image.caption}
              className="w-full h-full object-cover mt-16 md:mt-20"
              style={{
                objectFit: introPage.imageSlider.styles.objectFit,
                maxHeight: 'calc(100% - 4rem)',
                maxWidth: '100%'
              }}
              onError={(e) => {
                // Try alternative Google Drive format as fallback
                if (image.source.includes('drive.google.com/thumbnail')) {
                  const fileIdMatch = image.source.match(/id=([^&]+)/);
                  if (fileIdMatch) {
                    const fileId = fileIdMatch[1];
                    const fallbackUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
                    e.currentTarget.src = fallbackUrl;
                  } else {
                    e.currentTarget.style.display = "none";
                  }
                } else {
                  e.currentTarget.style.display = "none";
                }
              }}
            />
          </div>
        ))}

        {/* Navigation Arrows - Only show on desktop */}
        {processedImages.length > 1 && (
          <>
            <button
              onClick={prevImage}
              disabled={currentImageIndex === 0}
              className={`hidden md:block absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors p-2 rounded-full ${
                currentImageIndex === 0 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
              }`}
              title="Previous image"
            >
              <ChevronLeftIcon className="w-8 h-8" />
            </button>
            <button
              onClick={nextImage}
              className="hidden md:block absolute right-4 top-1/2 transform -translate-y-1/2 transition-colors p-2 rounded-full text-gray-700 hover:text-gray-900 hover:bg-gray-200"
              title="Next image"
            >
              <ChevronRightIcon className="w-8 h-8" />
            </button>
          </>
        )}

        </div>
      ) : (
        /* Lead Collection Form - Inline */
        <div className="relative w-full flex-1 bg-white flex items-center justify-center p-8">
          {leadCollectionSettings && instituteId && (
            <div className="w-full max-w-2xl">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Get Course Details</h2>
                  <button
                    onClick={handleLeadFormClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                {/* Multi-step form content */}
                <div className="space-y-6">
                  {leadCollectionSettings.formStyle?.type === 'multiStep' && leadCollectionSettings.fields && (
                    <div>
                      {/* Progress Bar */}
                      {leadCollectionSettings.formStyle.showProgress && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Step 1 of {leadCollectionSettings.fields.length}</span>
                            <span className="text-sm text-gray-500">Progress</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(1 / leadCollectionSettings.fields.length) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {/* Form Fields */}
                      <div className="space-y-4">
                        {leadCollectionSettings.fields.map((field: any, index: number) => (
                          <div key={field.name} className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            
                            {field.type === 'text' || field.type === 'email' || field.type === 'tel' ? (
                              <input
                                type={field.type}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder={`Enter ${field.label.toLowerCase()}`}
                              />
                            ) : field.type === 'chips' && field.options ? (
                              <div className="flex flex-wrap gap-2">
                                {field.options.map((option: any, optionIndex: number) => (
                                  <button
                                    key={optionIndex}
                                    className="px-4 py-2 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-4 mt-8">
                        <button
                          onClick={handleLeadFormClose}
                          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleLeadFormSubmit}
                          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dots Indicator - Between image slider and action buttons */}
      {!showLeadForm && processedImages.length > 1 && (
        <div className="flex justify-center mt-4 mb-20 md:mb-4 space-x-2">
          {processedImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              className={`w-3 h-3 rounded-full transition-colors duration-200 ${
                index === currentImageIndex 
                  ? (domainRouting.instituteThemeCode ? 'bg-[hsl(var(--primary))]' : 'bg-blue-600')
                  : 'bg-gray-400'
              }`}
              title={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Desktop Action Buttons - Only show when not in lead form */}
      {!showLeadForm && (
        <div className="hidden md:block flex-shrink-0 bg-white py-8">
          <div className={`flex ${
            introPage.actions.alignment === 'left' ? 'justify-start' :
            introPage.actions.alignment === 'right' ? 'justify-end' :
            'justify-center'
          } px-4`}>
            <div className="flex flex-col gap-4 items-center pb-6">
              {/* Next Button - Show on all slides */}
              {processedImages.length > 1 && (
                <button
                  onClick={() => {
                    if (currentImageIndex === processedImages.length - 1) {
                      // On last slide, navigate to catalogue
                      onComplete();
                    } else {
                      // On other slides, go to next image
                      setCurrentImageIndex(prev => prev + 1);
                    }
                  }}
                  className="px-6 py-3 rounded-lg font-semibold transition-colors duration-200 text-white hover:opacity-90"
                  style={{
                    backgroundColor: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
                  }}
                >
                  Next
                </button>
              )}
              
              {/* Login Text Button */}
              {introPage.actions.buttons.some(btn => btn.action === 'navigateToLogin') && (
                <span
                  onClick={() => handleButtonClick('navigateToLogin')}
                  className="cursor-pointer text-sm transition-colors"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <span className="text-black">Already have an account? </span>
                  <span 
                    className="underline"
                    style={{
                      color: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
                    }}
                  >
                    Login
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Action Buttons - Fixed at bottom */}
      {!showLeadForm && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 p-4">
          <div className="flex flex-col gap-3">
            {/* Next Button - Full width on mobile */}
            {processedImages.length > 1 && (
              <button
                onClick={() => {
                  if (currentImageIndex === processedImages.length - 1) {
                    // On last slide, navigate to catalogue
                    onComplete();
                  } else {
                    // On other slides, go to next image
                    setCurrentImageIndex(prev => prev + 1);
                  }
                }}
                className="w-full px-4 py-2 text-white font-medium hover:opacity-90 rounded-md transition-colors"
                style={{
                  backgroundColor: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
                }}
              >
                Next
              </button>
            )}
            
            {/* Login Text - Mobile */}
            {introPage.actions.buttons.some(btn => btn.action === 'navigateToLogin') && (
              <div className="text-center">
                <span
                  onClick={() => handleButtonClick('navigateToLogin')}
                  className="cursor-pointer text-sm transition-colors"
                >
                  <span className="text-black">Already have an account? </span>
                  <span 
                    className="underline"
                    style={{
                      color: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
                    }}
                  >
                    Login
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
};
