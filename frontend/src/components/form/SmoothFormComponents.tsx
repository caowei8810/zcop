import React, { useState, useEffect, useRef } from 'react';
import { 
  SmoothCard, 
  SmoothButton, 
  SmoothInput, 
  SmoothBadge, 
  SmoothProgressBar, 
  SmoothTooltip 
} from '../styles/SmoothUIStyles';
import { motion, AnimatePresence } from 'framer-motion';

interface SmoothFormProps {
  onSubmit: (data: Record<string, any>) => void;
  children: React.ReactNode;
  className?: string;
}

export const SmoothForm: React.FC<SmoothFormProps> = ({ onSubmit, children, className }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Basic validation
      const newErrors: Record<string, string> = {};
      
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.props.name) {
          const { name, required, minLength, maxLength, pattern } = child.props;
          const value = formData[name] || '';
          
          if (required && !value.trim()) {
            newErrors[name] = 'This field is required';
          } else if (minLength && value.length < minLength) {
            newErrors[name] = `Minimum length is ${minLength} characters`;
          } else if (maxLength && value.length > maxLength) {
            newErrors[name] = `Maximum length is ${maxLength} characters`;
          } else if (pattern && !new RegExp(pattern).test(value)) {
            newErrors[name] = 'Invalid format';
          }
        }
      });

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSubmitting(false);
        return;
      }

      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clone children and inject props
  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        onChange: (value: any) => handleChange(child.props.name, value),
        value: formData[child.props.name] || '',
        error: errors[child.props.name],
      } as any);
    }
    return child;
  });

  return (
    <form onSubmit={handleSubmit} className={className}>
      {childrenWithProps}
      <SmoothButton 
        type="submit" 
        $variant="primary" 
        $isLoading={isSubmitting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </SmoothButton>
    </form>
  );
};

interface SmoothInputFieldProps {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  className?: string;
}

export const SmoothInputField: React.FC<SmoothInputFieldProps> = ({
  name,
  label,
  type = 'text',
  placeholder,
  required = false,
  minLength,
  maxLength,
  pattern,
  value,
  onChange,
  error,
  className
}) => {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="relative">
        <SmoothInput
          id={name}
          name={name}
          type={type === 'password' && showPassword ? 'text' : type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          $hasError={!!error}
          $size="md"
          layout
          initial={false}
          animate={{
            scale: focused ? 1.02 : 1,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
        
        {type === 'password' && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
            onClick={togglePasswordVisibility}
          >
            {showPassword ? '👁️' : '🔒'}
          </button>
        )}
      </div>
      
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm text-red-600"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SmoothSelectFieldProps {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  className?: string;
}

export const SmoothSelectField: React.FC<SmoothSelectFieldProps> = ({
  name,
  label,
  options,
  required = false,
  value,
  onChange,
  error,
  className
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <SmoothInput
        as="select"
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        $hasError={!!error}
        $size="md"
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SmoothInput>
      
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
};

interface SmoothTextAreaFieldProps {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  className?: string;
}

export const SmoothTextAreaField: React.FC<SmoothTextAreaFieldProps> = ({
  name,
  label,
  placeholder,
  required = false,
  minLength,
  maxLength,
  value,
  onChange,
  error,
  className
}) => {
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    setCharCount(value?.length || 0);
  }, [value]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between">
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {maxLength && (
          <span className={`text-xs ${charCount > maxLength * 0.9 ? 'text-red-500' : 'text-gray-500'}`}>
            {charCount}/{maxLength}
          </span>
        )}
      </div>
      
      <SmoothInput
        as="textarea"
        id={name}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        $hasError={!!error}
        $size="md"
        className="min-h-[100px]"
      />
      
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
};

interface SmoothToggleFieldProps {
  name: string;
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
}

export const SmoothToggleField: React.FC<SmoothToggleFieldProps> = ({
  name,
  label,
  checked = false,
  onChange,
  className
}) => {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      
      <motion.button
        id={name}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange?.(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-indigo-600' : 'bg-gray-300'
        }`}
        whileTap={{ scale: 0.95 }}
      >
        <motion.span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
          layout
          transition={{ type: 'spring', stiffness: 700, damping: 30 }}
        />
      </motion.button>
    </div>
  );
};

interface SmoothDataTableProps<T> {
  data: T[];
  columns: Array<{
    key: keyof T;
    header: string;
    render?: (value: T[keyof T], row: T) => React.ReactNode;
  }>;
  onRowClick?: (row: T) => void;
  className?: string;
}

export const SmoothDataTable = <T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  className
}: SmoothDataTableProps<T>) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className={`min-w-full divide-y divide-gray-200 ${className}`}>
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          <AnimatePresence>
            {data.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : String(row[column.key])}
                  </td>
                ))}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
};

interface SmoothPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const SmoothPagination: React.FC<SmoothPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className
}) => {
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    
    // Always show first page
    pages.push(1);
    
    if (currentPage > 3) {
      pages.push('...');
    }
    
    // Show pages around current page
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    if (currentPage < totalPages - 2) {
      pages.push('...');
    }
    
    // Always show last page
    pages.push(totalPages);
    
    return pages;
  };

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <SmoothButton
        $variant="ghost"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        whileHover={{ scale: currentPage === 1 ? 1 : 1.02 }}
        whileTap={{ scale: currentPage === 1 ? 1 : 0.98 }}
      >
        Previous
      </SmoothButton>
      
      <div className="flex space-x-1">
        {getPageNumbers().map((page, index) => (
          <React.Fragment key={index}>
            {typeof page === 'number' ? (
              <SmoothButton
                $variant={currentPage === page ? 'primary' : 'ghost'}
                onClick={() => onPageChange(page)}
                $size="sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {page}
              </SmoothButton>
            ) : (
              <span className="px-3 py-1 text-gray-500">...</span>
            )}
          </React.Fragment>
        ))}
      </div>
      
      <SmoothButton
        $variant="ghost"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        whileHover={{ scale: currentPage === totalPages ? 1 : 1.02 }}
        whileTap={{ scale: currentPage === totalPages ? 1 : 0.98 }}
      >
        Next
      </SmoothButton>
    </div>
  );
};

interface SmoothTabPanelProps {
  children: React.ReactNode;
  activeTab: string;
  tabId: string;
}

export const SmoothTabPanel: React.FC<SmoothTabPanelProps> = ({ 
  children, 
  activeTab, 
  tabId 
}) => {
  return (
    <AnimatePresence mode="wait">
      {activeTab === tabId && (
        <motion.div
          key={tabId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface SmoothTabsProps {
  tabs: Array<{ id: string; label: string; content: React.ReactNode }>;
  className?: string;
}

export const SmoothTabs: React.FC<SmoothTabsProps> = ({ tabs, className }) => {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || '');

  return (
    <div className={className}>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      
      {tabs.map((tab) => (
        <SmoothTabPanel
          key={tab.id}
          activeTab={activeTab}
          tabId={tab.id}
        >
          {tab.content}
        </SmoothTabPanel>
      ))}
    </div>
  );
};