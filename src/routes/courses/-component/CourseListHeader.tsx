import { useState, useEffect } from "react";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { AuthModal } from "@/components/common/auth/modal/AuthModal";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";

const CourseListHeader = ({
  fileId,
  instituteId,
  type,
  courseId,
}: {
  fileId?: string;
  instituteId?: string;
  type?: string;
  courseId?: string;
}) => {
  const [imgUrl, setImgUrl] = useState("");
  const [logoLoading, setLogoLoading] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setLogoLoading(true);
    const fetchDynamicLogo = async () => {
      try {
        const url = await getPublicUrlWithoutLogin(fileId);
        setImgUrl(url);
      } catch (error) {
        console.log(error);
      } finally {
        setLogoLoading(false);
      }
    };

    fetchDynamicLogo();
  }, [instituteId]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navigationItems = [
    { href: "#home", label: "Home" },
    { href: "#about", label: "About" },
    { href: "#impact", label: "Impact" },
    {
      href: "#courses",
      label: getTerminology(ContentTerms.Course, SystemTerms.Course) + "s",
    },
    { href: "#involved", label: "Get Involved" },
    { href: "#contact", label: "Contact" },
  ];

  return (
    <nav className="min-h-[80px] bg-white py-4 px-4 sm:px-6 lg:px-10 flex flex-col lg:flex-row justify-between items-center shadow-sm relative">
      {/* Logo Section */}
      <div className="flex items-center justify-between w-full lg:w-auto mb-4 lg:mb-0">
        <div className="flex items-center relative h-8 sm:h-10 w-20 sm:w-24">
          {logoLoading && (
            <div
              className="absolute inset-0 bg-gray-200 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 text-xs"
              aria-label="Loading logo"
            >
              Loading...
            </div>
          )}
          <img
            src={imgUrl}
            alt={`logo`}
            className={`h-full w-full object-contain rounded-md border border-gray-200 ${
              logoLoading ? "opacity-0" : "opacity-100"
            }`}
          />
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Toggle mobile menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isMobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden lg:flex lg:flex-row items-center gap-8">
        <ul className="flex items-center gap-6 text-gray-800">
          {navigationItems.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="hover:text-blue-600 transition-colors duration-200 text-sm font-medium"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <AuthModal 
            type={type} 
            courseId={courseId}
            trigger={
              <button 
                data-auth-modal-trigger
                className="px-4 py-2 border border-gray-300 text-black rounded-md hover:bg-gray-100 transition-colors duration-200 text-sm font-medium"
              >
                Login
              </button>
            }
          />
          <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 text-sm font-medium">
            Donate
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden w-full bg-white border-t border-gray-200 py-4 px-4 sm:px-6" style={{ zIndex: 100 }}>
          <ul className="flex flex-col space-y-4 mb-6">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={closeMobileMenu}
                  className="block hover:text-blue-600 transition-colors duration-200 text-gray-800 font-medium"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                closeMobileMenu();
                // Trigger the desktop AuthModal
                const desktopLoginButton = document.querySelector('[data-auth-modal-trigger]') as HTMLElement;
                if (desktopLoginButton) {
                  desktopLoginButton.click();
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 text-black rounded-md hover:bg-gray-100 transition-colors duration-200 text-sm font-medium"
            >
              Login
            </button>
            <button className="w-full px-4 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 text-sm font-medium">
              Donate
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default CourseListHeader;
