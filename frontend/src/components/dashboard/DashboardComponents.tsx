import React, { useState, useEffect } from 'react';
import { 
  SmoothCard, 
  SmoothButton, 
  SmoothInput, 
  SmoothBadge, 
  SmoothProgressBar 
} from '../styles/SmoothUIStyles';
import { 
  SmoothForm, 
  SmoothInputField, 
  SmoothSelectField, 
  SmoothTextAreaField, 
  SmoothToggleField 
} from '../components/form/SmoothFormComponents';
import { 
  SmoothModal, 
  SmoothDropdownMenu, 
  SmoothTooltipWrapper 
} from '../components/feedback/SmoothFeedbackComponents';
import { 
  SmoothVirtualizedList, 
  SmoothInfiniteScroll, 
  SmoothDragAndDropList, 
  SmoothSearchableList, 
  SmoothFilterableList, 
  SmoothSortableList 
} from '../components/list/SmoothListComponents';
import { 
  SmoothCarousel, 
  SmoothImageGallery, 
  SmoothTabView, 
  SmoothExpandableSection, 
  SmoothProgressSteps, 
  SmoothFloatingAction 
} from '../components/navigation/SmoothNavigationComponents';
import { 
  SmoothLoadingOverlay, 
  SmoothSkeleton, 
  SmoothAnimatedCounter, 
  SmoothProgressIndicator, 
  SmoothAnimatedBackground, 
  SmoothHoverCard, 
  SmoothAnimatedList, 
  SmoothStaggeredAnimation, 
  SmoothParallaxSection, 
  SmoothPulseAnimation 
} from '../components/animations/SmoothAnimationComponents';

// Dashboard Components
const DashboardCard = ({ title, value, change, icon }: { 
  title: string; 
  value: string; 
  change: string; 
  icon: React.ReactNode;
}) => (
  <SmoothCard 
    $elevation="md" 
    $rounded="lg" 
    $interactive={true} 
    $hoverEffect={true}
    className="p-6"
    whileHover={{ y: -5 }}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
        <p className="text-sm text-green-600 mt-1">{change}</p>
      </div>
      <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
        {icon}
      </div>
    </div>
  </SmoothCard>
);

const ActivityFeed = () => {
  const activities = [
    { id: 1, user: 'Alex Johnson', action: 'created a new project', time: '2 min ago' },
    { id: 2, user: 'Sam Smith', action: 'updated the documentation', time: '15 min ago' },
    { id: 3, user: 'Taylor Brown', action: 'commented on your post', time: '1 hour ago' },
  ];

  return (
    <SmoothCard $elevation="md" $rounded="lg" className="p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start">
            <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">{activity.user}</p>
              <p className="text-sm text-gray-600">{activity.action}</p>
              <p className="text-xs text-gray-500">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </SmoothCard>
  );
};

const ProjectList = () => {
  const projects = [
    { id: 1, name: 'Website Redesign', status: 'In Progress', progress: 75 },
    { id: 2, name: 'Mobile App', status: 'Planning', progress: 25 },
    { id: 3, name: 'API Integration', status: 'Complete', progress: 100 },
  ];

  return (
    <SmoothCard $elevation="md" $rounded="lg" className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Projects</h3>
        <SmoothButton $variant="primary" $size="sm">New Project</SmoothButton>
      </div>
      <div className="space-y-4">
        {projects.map((project) => (
          <div key={project.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">{project.name}</h4>
              <SmoothBadge 
                $variant={project.status === 'Complete' ? 'success' : project.status === 'In Progress' ? 'primary' : 'warning'}
                $size="sm"
                className="mt-1"
              >
                {project.status}
              </SmoothBadge>
            </div>
            <div className="w-32">
              <SmoothProgressBar $progress={project.progress} $color={project.progress === 100 ? 'success' : 'primary'} $size="sm" />
            </div>
          </div>
        ))}
      </div>
    </SmoothCard>
  );
};

// Settings Page Components
const SettingsSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <SmoothCard $elevation="sm" $rounded="md" className="p-6 mb-6">
    <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
    {children}
  </SmoothCard>
);

const UserProfileForm = () => {
  const [userData, setUserData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    bio: 'Software engineer passionate about creating beautiful user experiences.',
    notifications: true,
  });

  const handleSubmit = (data: Record<string, any>) => {
    console.log('User profile updated:', data);
  };

  return (
    <SmoothForm onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SmoothInputField
          name="firstName"
          label="First Name"
          placeholder="Enter your first name"
          required
        />
        <SmoothInputField
          name="lastName"
          label="Last Name"
          placeholder="Enter your last name"
          required
        />
        <SmoothInputField
          name="email"
          label="Email"
          type="email"
          placeholder="Enter your email"
          required
        />
        <SmoothSelectField
          name="language"
          label="Language"
          options={[
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Spanish' },
            { value: 'fr', label: 'French' },
          ]}
        />
        <div className="md:col-span-2">
          <SmoothTextAreaField
            name="bio"
            label="Bio"
            placeholder="Tell us about yourself"
            maxLength={200}
          />
        </div>
        <div className="md:col-span-2">
          <SmoothToggleField
            name="notifications"
            label="Enable notifications"
          />
        </div>
      </div>
    </SmoothForm>
  );
};

// Analytics Page Components
const ChartPlaceholder = ({ title }: { title: string }) => (
  <SmoothCard $elevation="md" $rounded="lg" className="p-6">
    <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
    <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-64" />
  </SmoothCard>
);

const MetricCard = ({ title, value, change }: { title: string; value: string; change: string }) => (
  <SmoothCard $elevation="md" $rounded="lg" className="p-6">
    <p className="text-sm font-medium text-gray-600">{title}</p>
    <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
    <p className={`text-sm mt-2 ${change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
      {change}
    </p>
  </SmoothCard>
);

// Team Management Components
const MemberCard = ({ name, role, status }: { name: string; role: string; status: 'active' | 'inactive' }) => (
  <SmoothCard $elevation="sm" $rounded="md" className="p-4 flex items-center">
    <div className="bg-gray-200 border-2 border-dashed rounded-xl w-12 h-12" />
    <div className="ml-4">
      <h4 className="font-medium text-gray-900">{name}</h4>
      <p className="text-sm text-gray-600">{role}</p>
    </div>
    <SmoothBadge 
      $variant={status === 'active' ? 'success' : 'danger'} 
      $size="sm" 
      className="ml-auto"
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </SmoothBadge>
  </SmoothCard>
);

const RoleSelector = () => {
  const roles = ['Admin', 'Editor', 'Viewer', 'Contributor'];
  
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((role) => (
        <SmoothButton 
          key={role} 
          $variant="tertiary" 
          $size="sm"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {role}
        </SmoothButton>
      ))}
    </div>
  );
};

// Export all components for use in the application
export {
  // Dashboard components
  DashboardCard,
  ActivityFeed,
  ProjectList,
  
  // Settings components
  SettingsSection,
  UserProfileForm,
  
  // Analytics components
  ChartPlaceholder,
  MetricCard,
  
  // Team management components
  MemberCard,
  RoleSelector,
  
  // Re-export all smooth UI components for convenience
  SmoothCard,
  SmoothButton,
  SmoothInput,
  SmoothBadge,
  SmoothProgressBar,
  SmoothTooltip,
  SmoothForm,
  SmoothInputField,
  SmoothSelectField,
  SmoothTextAreaField,
  SmoothToggleField,
  SmoothModal,
  SmoothDropdownMenu,
  SmoothTooltipWrapper,
  SmoothVirtualizedList,
  SmoothInfiniteScroll,
  SmoothDragAndDropList,
  SmoothSearchableList,
  SmoothFilterableList,
  SmoothSortableList,
  SmoothCarousel,
  SmoothImageGallery,
  SmoothTabView,
  SmoothExpandableSection,
  SmoothProgressSteps,
  SmoothFloatingAction,
  SmoothLoadingOverlay,
  SmoothSkeleton,
  SmoothAnimatedCounter,
  SmoothProgressIndicator,
  SmoothAnimatedBackground,
  SmoothHoverCard,
  SmoothAnimatedList,
  SmoothStaggeredAnimation,
  SmoothParallaxSection,
  SmoothPulseAnimation
};