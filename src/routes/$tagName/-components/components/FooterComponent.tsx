import React from "react";
import { FooterProps } from "../../-types/course-catalogue-types";
import { useDomainRouting } from "@/hooks/use-domain-routing";

export const FooterComponent: React.FC<FooterProps> = ({ 
  layout, 
  leftSection, 
  rightSections, 
  rightSection,
  socialsSection,
  bottomNote 
}) => {
  const domainRouting = useDomainRouting();
  
  
  // Get social media icon component
  const getSocialIcon = (iconName: string) => {
    const iconProps = { className: "w-6 h-6", fill: "currentColor" };
    
    switch (iconName.toLowerCase()) {
      case "facebook":
        return (
          <svg {...iconProps} viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        );
      case "instagram":
        return (
          <svg {...iconProps} viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        );
      case "youtube":
        return (
          <svg {...iconProps} viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        );
      case "linkedin":
        return (
          <svg {...iconProps} viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        );
      default:
        return (
          <svg {...iconProps} viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 8.16c-.169 1.858-.896 3.46-2.053 4.617-1.157 1.157-2.759 1.884-4.617 2.053C9.03 14.828 8.5 14.5 8.5 14.5s-.53.328-1.398.33c-1.858-.169-3.46-.896-4.617-2.053C1.328 11.62.601 10.018.432 8.16.33 7.192.5 6.5.5 6.5s-.17.692-.068 1.66c.169 1.858.896 3.46 2.053 4.617 1.157 1.157 2.759 1.884 4.617 2.053C7.97 14.828 8.5 14.5 8.5 14.5s.53.328 1.398.33c1.858-.169 3.46-.896 4.617-2.053 1.157-1.157 1.884-2.759 2.053-4.617.102-.968-.068-1.66-.068-1.66s.17-.692.068-1.66z"/>
          </svg>
        );
    }
  };
  

  
   return (
     <footer 
       className="text-gray-800"
       style={{
         backgroundColor: domainRouting.instituteThemeCode ? 
           `hsl(var(--primary-200))` : 
           '#e5e7eb' // gray-200 fallback
       }}
     >
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
           {/* Left Section - Company Info */}
           <div>
             <h3 className="text-lg font-semibold mb-4 text-gray-900">{leftSection.title}</h3>
             <p className="text-gray-700 mb-4">{leftSection.text}</p>
           </div>

           {/* Right Section - Quick Links */}
           {rightSection && (
             <div>
               <h3 className="text-lg font-semibold mb-4 text-gray-900">{rightSection.title}</h3>
               <ul className="space-y-2">
                 {rightSection.links.map((link, linkIndex) => (
                   <li key={linkIndex}>
                     <a 
                       href={link.route} 
                       className="text-gray-700 hover:text-gray-900 transition-colors"
                       target={link.route.startsWith('http') ? '_blank' : '_self'}
                       rel={link.route.startsWith('http') ? 'noopener noreferrer' : undefined}
                     >
                       {link.label}
                     </a>
                   </li>
                 ))}
               </ul>
             </div>
           )}

           {/* Social Media Section */}
           {socialsSection && (
             <div>
               <h3 className="text-lg font-semibold mb-4 text-gray-900">{socialsSection.title}</h3>
               <div className="flex space-x-4">
                 {socialsSection.links.map((social, linkIndex) => (
                   <a
                     key={linkIndex}
                     href={social.url}
                     className="text-gray-700 hover:text-gray-900 transition-colors"
                     target="_blank"
                     rel="noopener noreferrer"
                     title={social.platform}
                   >
                     {getSocialIcon(social.icon)}
                   </a>
                 ))}
               </div>
             </div>
           )}
        </div>

        <div className="border-t border-gray-400 mt-8 pt-8 text-center">
          <p className="text-gray-600 text-sm">
            {bottomNote}
          </p>
        </div>
      </div>
    </footer>
  );
};
