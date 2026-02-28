import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX, FiChevronDown, FiSearch, FiBell, FiUser, FiSettings, FiHelpCircle, FiLogOut } from 'react-icons/fi';
import { Button } from './Button';
import { Input } from './Input';
import { Dropdown } from './Dropdown';
import { LoadingSpinner } from './LoadingSpinner';

interface SmoothUIConfig {
  animationsEnabled: boolean;
  animationDuration: number;
  easingFunction: string;
  touchOptimized: boolean;
  reducedMotion: boolean;
}

interface SmoothNavigationProps {
  children: React.ReactNode;
  config?: SmoothUIConfig;
}

interface SmoothModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

interface SmoothDropdownProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  trigger?: 'click' | 'hover';
}

/**
 * SmoothUIProvider component for providing smooth UI configurations
 */
export const SmoothUIProvider: React.FC<SmoothNavigationProps> = ({ children, config }) => {
  const defaultConfig: SmoothUIConfig = {
    animationsEnabled: true,
    animationDuration: 0.3,
    easingFunction: 'easeInOut',
    touchOptimized: true,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  const mergedConfig = { ...defaultConfig, ...config };

  return (
    <div className={`smooth-ui-provider ${mergedConfig.reducedMotion ? 'reduced-motion' : ''}`}>
      {children}
    </div>
  );
};

/**
 * Smooth navigation header with optimized interactions
 */
export const SmoothHeader: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
      className={`fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b transition-all duration-300 ${
        scrolled ? 'shadow-sm py-2' : 'py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 flex items-center"
          >
            <span className="font-bold text-xl text-indigo-600">ZCOP</span>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {['Dashboard', 'Projects', 'Team', 'Documents', 'Reports'].map((item) => (
              <motion.a
                key={item}
                href="#"
                whileHover={{ y: -2 }}
                className="text-gray-700 hover:text-indigo-600 font-medium transition-colors duration-200"
              >
                {item}
              </motion.a>
            ))}
          </nav>

          {/* Right section */}
          <div className="flex items-center space-x-4">
            {/* Search bar - expandable */}
            <div className="relative">
              {searchExpanded ? (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 200, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="flex items-center bg-gray-100 rounded-full pl-4 pr-2 py-1"
                >
                  <FiSearch className="text-gray-500 mr-2" />
                  <Input
                    type="text"
                    placeholder="Search..."
                    className="bg-transparent border-none focus:ring-0 w-full"
                    onBlur={() => setSearchExpanded(false)}
                  />
                </motion.div>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSearchExpanded(true)}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                >
                  <FiSearch size={18} />
                </motion.button>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              <Dropdown
                content={
                  <div className="w-80 p-4 bg-white rounded-lg shadow-xl border">
                    <h3 className="font-semibold mb-2">Notifications</h3>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <p className="text-sm font-medium">Notification {i}</p>
                          <p className="text-xs text-gray-500">2 hours ago</p>
                        </div>
                      ))}
                    </div>
                  </div>
                }
                position="bottom-end"
              >
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 relative"
                >
                  <FiBell size={18} />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </motion.button>
              </Dropdown>
            </div>

            {/* User menu */}
            <Dropdown
              content={
                <div className="w-48 bg-white rounded-lg shadow-xl border py-1">
                  <button className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100">
                    <FiUser className="mr-2" /> Profile
                  </button>
                  <button className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100">
                    <FiSettings className="mr-2" /> Settings
                  </button>
                  <button className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100">
                    <FiHelpCircle className="mr-2" /> Help
                  </button>
                  <hr className="my-1" />
                  <button className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100 text-red-600">
                    <FiLogOut className="mr-2" /> Logout
                  </button>
                </div>
              }
              position="bottom-end"
            >
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="flex items-center text-sm rounded-full focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-800 font-medium">U</span>
                </div>
              </motion.button>
            </Dropdown>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
              >
                {mobileMenuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden"
            >
              <div className="pt-4 pb-3 space-y-1">
                {['Dashboard', 'Projects', 'Team', 'Documents', 'Reports'].map((item) => (
                  <a
                    key={item}
                    href="#"
                    className="block pl-3 pr-4 py-2 text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-md"
                  >
                    {item}
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
};

/**
 * Smooth modal component with optimized transitions
 */
export const SmoothModal: React.FC<SmoothModalProps> = ({ 
  isOpen, 
  onClose, 
  children, 
  title, 
  size = 'md' 
}) => {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`bg-white rounded-xl shadow-xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              {title && (
                <div className="border-b p-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <button 
                    onClick={onClose}
                    className="p-1 rounded-full hover:bg-gray-100"
                  >
                    <FiX />
                  </button>
                </div>
              )}
              <div className="p-4">
                {children}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/**
 * Smooth dropdown component with optimized positioning
 */
export const SmoothDropdown: React.FC<SmoothDropdownProps> = ({ 
  children, 
  content, 
  position = 'bottom-start', 
  trigger = 'click' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-start':
        return 'left-0 mt-2 origin-top-left';
      case 'bottom-end':
        return 'right-0 mt-2 origin-top-right';
      case 'top-start':
        return 'left-0 mb-2 origin-bottom-left';
      case 'top-end':
        return 'right-0 mb-2 origin-bottom-right';
      default:
        return 'left-0 mt-2 origin-top-left';
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div 
        onClick={() => trigger === 'click' && setIsOpen(!isOpen)}
        onMouseEnter={() => trigger === 'hover' && setIsOpen(true)}
        onMouseLeave={() => trigger === 'hover' && setIsOpen(false)}
      >
        {children}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, transformOrigin: position.includes('top') ? 'bottom' : 'top' }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`absolute z-50 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black/5 ${getPositionClasses()}`}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Smooth loading spinner with optimized animation
 */
export const SmoothLoadingSpinner: React.FC = () => {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ 
        repeat: Infinity, 
        ease: "linear", 
        duration: 1 
      }}
      className="w-8 h-8 border-4 border-t-indigo-600 border-r-indigo-600 border-b-gray-200 border-l-gray-200 rounded-full"
    />
  );
};

/**
 * Smooth button component with optimized feedback
 */
export const SmoothButton: React.FC<{
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  disabled = false, 
  onClick 
}) => {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
    ghost: 'hover:bg-gray-100 text-gray-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${variants[variant]} ${sizes[size]} rounded-lg font-medium transition-all duration-200 flex items-center justify-center ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {loading ? (
        <>
          <SmoothLoadingSpinner />
          <span className="ml-2">Loading...</span>
        </>
      ) : (
        children
      )}
    </motion.button>
  );
};

/**
 * Smooth input field with optimized UX
 */
export const SmoothInput: React.FC<{
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
  error?: string;
}> = ({ label, placeholder, value, onChange, type = 'text', error }) => {
  return (
    <div className="space-y-1 w-full">
      {label && (
        <motion.label 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </motion.label>
      )}
      <motion.div
        whileFocusWithin={{ scale: 1.01 }}
        className={`relative rounded-lg border ${
          error ? 'border-red-500' : 'border-gray-300 focus-within:border-indigo-500'
        } transition-colors duration-200`}
      >
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full px-3 py-2 focus:outline-none bg-transparent"
        />
      </motion.div>
      {error && (
        <motion.p 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="text-sm text-red-600"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
};