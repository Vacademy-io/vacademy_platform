import React, { useState } from 'react';
import { ModernButton } from '@/components/design-system/modern-button';
import { 
  ModernCard, 
  ModernCardHeader, 
  ModernCardTitle, 
  ModernCardContent,
  ModernCardFooter 
} from '@/components/design-system/modern-card';
import { ModernInput } from '@/components/design-system/modern-input';
import { 
  Play, 
  Heart, 
  Share, 
  User, 
  Envelope, 
  Lock,
  MagnifyingGlass,
  Bell,
  Gear,
  TrendUp,
  Download
} from 'phosphor-react';

/**
 * Modern Design System Showcase
 * 
 * This component demonstrates the usage of our new design system components
 * and serves as a reference for implementation patterns.
 */
export const ModernDesignShowcase: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState('');

  const handleAction = async (action: string) => {
    setIsLoading(true);
    setNotification(`${action} initiated...`);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setNotification(`${action} completed successfully!`);
      setTimeout(() => setNotification(''), 3000);
    }, 2000);
  };

  return (
    <div className="container-modern py-8 space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4 animate-fade-down">
        <h1 className="text-h1-semibold text-gradient-primary">
          Modern Design System
        </h1>
        <p className="text-subtitle text-neutral-600 max-w-2xl mx-auto">
          Experience our comprehensive design system with modern components, 
          beautiful animations, and intuitive interactions.
        </p>
      </div>

      {/* Notification */}
      {notification && (
        <div className="bg-success-50 border border-success-200 text-success-700 px-4 py-3 rounded-lg animate-fade-up">
          {notification}
        </div>
      )}

      {/* Button Showcase */}
      <ModernCard variant="elevated" className="animate-fade-up">
        <ModernCardHeader>
          <ModernCardTitle size="lg">Button Components</ModernCardTitle>
        </ModernCardHeader>
        <ModernCardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Primary Buttons */}
            <div className="space-y-4">
              <h3 className="text-h3-semibold">Primary Actions</h3>
              <div className="stack-vertical">
                <ModernButton 
                  variant="primary" 
                  size="lg"
                  leftIcon={<Play weight="duotone" />}
                  onClick={() => handleAction('Play')}
                  isLoading={isLoading}
                >
                  Start Learning
                </ModernButton>
                
                <ModernButton 
                  variant="primary" 
                  size="md"
                  rightIcon={<Download weight="duotone" />}
                  onClick={() => handleAction('Download')}
                >
                  Download Resources
                </ModernButton>
                
                <ModernButton 
                  variant="primary" 
                  size="sm"
                  rounded="full"
                  className="shadow-colored"
                >
                  Quick Action
                </ModernButton>
              </div>
            </div>

            {/* Secondary Buttons */}
            <div className="space-y-4">
              <h3 className="text-h3-semibold">Secondary Actions</h3>
              <div className="stack-vertical">
                <ModernButton 
                  variant="secondary" 
                  size="lg"
                  leftIcon={<Gear weight="duotone" />}
                >
                  Settings
                </ModernButton>
                
                <ModernButton 
                  variant="outline" 
                  size="md"
                  leftIcon={<Share weight="duotone" />}
                >
                  Share
                </ModernButton>
                
                <ModernButton 
                  variant="ghost" 
                  size="sm"
                  leftIcon={<Heart weight="duotone" />}
                  className="hover-scale-gentle"
                >
                  Like
                </ModernButton>
              </div>
            </div>
          </div>
        </ModernCardContent>
      </ModernCard>

      {/* Card Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Elevated Card */}
        <ModernCard 
          variant="elevated" 
          hoverable 
          interactive
          className="animate-fade-up group"
          style={{ animationDelay: '0.1s' } as React.CSSProperties}
        >
          <ModernCardHeader>
            <div className="flex items-center justify-between">
              <ModernCardTitle size="md">Progress Tracker</ModernCardTitle>
              <TrendUp 
                weight="duotone" 
                className="text-success-500 group-hover:scale-110 transition-transform" 
              />
            </div>
          </ModernCardHeader>
          <ModernCardContent>
            <div className="text-h2-semibold text-primary-600 mb-2">
              85%
            </div>
            <p className="text-caption text-neutral-600">
              Course completion rate
            </p>
            <div className="w-full bg-neutral-200 rounded-full h-2 mt-3">
              <div className="bg-primary-500 h-2 rounded-full w-[85%] animate-fade-up"></div>
            </div>
          </ModernCardContent>
        </ModernCard>

        {/* Glass Card */}
        <ModernCard 
          variant="glass" 
          padding="lg" 
          rounded="2xl"
          className="animate-fade-up"
          style={{ animationDelay: '0.2s' } as React.CSSProperties}
        >
          <ModernCardContent className="text-center">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell weight="duotone" className="text-white text-2xl" />
            </div>
            <ModernCardTitle size="lg" className="mb-2">
              Notifications
            </ModernCardTitle>
            <p className="text-body text-neutral-600 mb-4">
              Stay updated with your learning progress
            </p>
            <ModernButton variant="outline" size="sm" className="w-full">
              Enable Notifications
            </ModernButton>
          </ModernCardContent>
        </ModernCard>

        {/* Outlined Card */}
        <ModernCard 
          variant="outlined" 
          hoverable
          className="animate-fade-up md:col-span-2 lg:col-span-1"
          style={{ animationDelay: '0.3s' } as React.CSSProperties}
        >
          <ModernCardHeader variant="bordered">
            <ModernCardTitle size="md">Quick Stats</ModernCardTitle>
          </ModernCardHeader>
          <ModernCardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-title font-semibold text-primary-600">12</div>
                <div className="text-caption text-neutral-600">Courses</div>
              </div>
              <div className="text-center">
                <div className="text-title font-semibold text-success-600">8</div>
                <div className="text-caption text-neutral-600">Completed</div>
              </div>
            </div>
          </ModernCardContent>
        </ModernCard>
      </div>

      {/* Input Showcase */}
      <ModernCard variant="default" className="animate-fade-up">
        <ModernCardHeader>
          <ModernCardTitle size="lg">Form Components</ModernCardTitle>
        </ModernCardHeader>
        <ModernCardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Standard Inputs */}
            <div className="space-y-4">
              <h3 className="text-h3-semibold">Standard Inputs</h3>
              
              <ModernInput
                label="Full Name"
                placeholder="Enter your full name"
                leftIcon={<User />}
                variant="default"
              />
              
              <ModernInput
                label="Email Address"
                type="email"
                placeholder="Enter your email"
                leftIcon={<Envelope />}
                variant="filled"
                helperText="We'll never share your email"
              />
              
              <ModernInput
                label="Password"
                type="password"
                placeholder="Enter your password"
                leftIcon={<Lock />}
                variant="outlined"
                state="error"
                errorText="Password must be at least 8 characters"
              />
            </div>

            {/* Enhanced Inputs */}
            <div className="space-y-4">
              <h3 className="text-h3-semibold">Enhanced Inputs</h3>
              
              <ModernInput
                label="Search"
                placeholder="Search courses..."
                leftIcon={<MagnifyingGlass />}
                variant="ghost"
              />
              
              <ModernInput
                label="Username"
                placeholder="Choose a username"
                variant="default"
                state="success"
                helperText="This username is available!"
              />
              
              <ModernInput
                label="Loading Example"
                placeholder="Checking availability..."
                isLoading={true}
                variant="filled"
              />
            </div>
          </div>
        </ModernCardContent>
        <ModernCardFooter>
          <ModernButton 
            variant="primary" 
            size="md"
            className="mr-3"
            onClick={() => handleAction('Form Submit')}
            isLoading={isLoading}
          >
            Submit Form
          </ModernButton>
          <ModernButton variant="ghost" size="md">
            Reset
          </ModernButton>
        </ModernCardFooter>
      </ModernCard>

      {/* Animation Showcase */}
      <ModernCard variant="subtle" className="animate-fade-up">
        <ModernCardHeader>
          <ModernCardTitle size="lg">Animation Examples</ModernCardTitle>
        </ModernCardHeader>
        <ModernCardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-primary-100 rounded-xl flex items-center justify-center mx-auto hover-lift-gentle">
                <div className="w-8 h-8 bg-primary-500 rounded-full animate-pulse-soft"></div>
              </div>
              <div>
                <div className="text-subtitle font-medium">Hover Lift</div>
                <div className="text-caption text-neutral-600">Gentle lift on hover</div>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-success-100 rounded-xl flex items-center justify-center mx-auto hover-scale-gentle">
                <div className="w-8 h-8 bg-success-500 rounded-full animate-bounce-gentle"></div>
              </div>
              <div>
                <div className="text-subtitle font-medium">Scale Effect</div>
                <div className="text-caption text-neutral-600">Gentle scale on hover</div>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-warning-100 rounded-xl flex items-center justify-center mx-auto clickable">
                <div className="w-8 h-8 bg-warning-500 rounded-full animate-scale-in"></div>
              </div>
              <div>
                <div className="text-subtitle font-medium">Click Effect</div>
                <div className="text-caption text-neutral-600">Active state feedback</div>
              </div>
            </div>
          </div>
        </ModernCardContent>
      </ModernCard>

      {/* Footer */}
      <div className="text-center space-y-4 animate-fade-up">
        <p className="text-body text-neutral-600">
          This design system provides a solid foundation for building modern, 
          accessible, and performant user interfaces.
        </p>
        <div className="flex justify-center space-x-4">
          <ModernButton 
            variant="outline" 
            size="sm"
            onClick={() => window.open('/docs/DESIGN_SYSTEM.md', '_blank')}
          >
            View Documentation
          </ModernButton>
          <ModernButton 
            variant="ghost" 
            size="sm"
            onClick={() => window.open('https://github.com', '_blank')}
          >
            GitHub Repository
          </ModernButton>
        </div>
      </div>
    </div>
  );
};

export default ModernDesignShowcase; 