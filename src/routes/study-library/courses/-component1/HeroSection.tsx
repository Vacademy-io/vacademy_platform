import React from 'react';
import { BookOpen } from 'phosphor-react';

const HeroSection: React.FC = () => {
  return (
    <div className='relative min-h-[200px] bg-gradient-to-br from-gray-50/80 via-white to-primary-50/20 overflow-hidden w-full max-w-full'>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-16 md:w-32 h-16 md:h-32 bg-gradient-to-br from-primary-100/20 to-transparent rounded-full blur-3xl animate-gentle-pulse"></div>
        <div className="absolute bottom-1/3 right-1/3 w-20 md:w-40 h-20 md:h-40 bg-gradient-to-br from-primary-50/30 to-transparent rounded-full blur-3xl animate-gentle-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className='relative z-10 flex flex-col lg:flex-row max-w-7xl mx-auto p-2 sm:p-3 lg:p-4 min-h-[200px]'>
        {/* Content Section */}
        <div className='w-full lg:w-2/3 flex items-center justify-center lg:justify-start'>
          <div className='animate-fade-in-up max-w-2xl text-center lg:text-left'>
            {/* Header with Icon */}
            <div className="flex items-center justify-center lg:justify-start space-x-2 mb-2 sm:mb-3">
              <div className="p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg shadow-sm">
                <BookOpen size={18} className="text-primary-600" weight="duotone" />
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Course Catalog</span>
              </div>
            </div>

            {/* Main Heading */}
            <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 sm:mb-3 tracking-tight leading-tight'>
              Explore & Discover
              <span className="block bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
                Premium Courses
              </span>
            </h1>

            {/* Single Description */}
            <div className="mb-3 sm:mb-4">
              <p className="text-sm sm:text-base text-gray-600 font-medium leading-relaxed">
                Effortlessly organize, upload, and track educational resources in one place.
              </p>
            </div>
          </div>
        </div>

        {/* Image Section */}
        <div className='w-full lg:w-1/3 flex items-center justify-center p-1 sm:p-2 animate-fade-in-up' style={{ animationDelay: '0.4s' }}>
          <div className="relative group">
            {/* Floating orb effect */}
            <div className="absolute -top-2 -right-2 w-6 h-6 sm:w-8 sm:h-8 bg-primary-100/30 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            
            <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-2 sm:p-3 shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-105">
              <img 
                src="/images/Group.png" 
                alt="Illustration of diverse people learning" 
                className="w-full max-w-[150px] sm:max-w-[180px] object-contain rounded-lg"
              />
              
              {/* Progress indicator */}
              <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-primary-400 to-primary-600 w-0 group-hover:w-full transition-all duration-700 ease-out rounded-b-xl"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeroSection;
