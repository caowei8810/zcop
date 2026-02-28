import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  SmoothCard, 
  SmoothButton, 
  SmoothInput, 
  SmoothBadge, 
  SmoothProgressBar, 
  SmoothTooltip 
} from '../styles/SmoothUIStyles';

interface SmoothToast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextProps {
  toasts: SmoothToast[];
  addToast: (toast: Omit<SmoothToast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextProps | undefined>(undefined);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<SmoothToast[]>([]);

  const addToast = (toast: Omit<SmoothToast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    
    setToasts((prev) => [...prev, newToast]);
    
    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: SmoothToast[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-full max-w-xs">
      <AnimatePresence>
        {toasts.map((toast) => (
          <SmoothToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface SmoothToastItemProps {
  toast: SmoothToast;
  onDismiss: () => void;
}

const SmoothToastItem: React.FC<SmoothToastItemProps> = ({ toast, onDismiss }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Pause timer when hovered
  useEffect(() => {
    if (isHovered && toast.duration !== 0) {
      return;
    }
  }, [isHovered, toast.duration]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className={`relative rounded-lg p-4 shadow-lg ${
        toast.type === 'success'
          ? 'bg-green-100 border border-green-200'
          : toast.type === 'error'
          ? 'bg-red-100 border border-red-200'
          : toast.type === 'warning'
          ? 'bg-yellow-100 border border-yellow-200'
          : 'bg-blue-100 border border-blue-200'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start">
        <div className="flex-1">
          {toast.title && (
            <h4 className={`text-sm font-semibold ${
              toast.type === 'success'
                ? 'text-green-800'
                : toast.type === 'error'
                ? 'text-red-800'
                : toast.type === 'warning'
                ? 'text-yellow-800'
                : 'text-blue-800'
            }`}>
              {toast.title}
            </h4>
          )}
          <p className={`text-sm ${
            toast.type === 'success'
              ? 'text-green-700'
              : toast.type === 'error'
              ? 'text-red-700'
              : toast.type === 'warning'
              ? 'text-yellow-700'
              : 'text-blue-700'
          }`}>
            {toast.message}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className={`ml-4 inline-flex shrink-0 rounded-md p-1.5 ${
            toast.type === 'success'
              ? 'text-green-500 hover:bg-green-200'
              : toast.type === 'error'
              ? 'text-red-500 hover:bg-red-200'
              : toast.type === 'warning'
              ? 'text-yellow-500 hover:bg-yellow-200'
              : 'text-blue-500 hover:bg-blue-200'
          }`}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </motion.div>
  );
};

interface SmoothModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showCloseButton?: boolean;
  preventCloseOnOutsideClick?: boolean;
}

export const SmoothModal: React.FC<SmoothModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  preventCloseOnOutsideClick = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  const handleClickOutside = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      if (!preventCloseOnOutsideClick) {
        onClose();
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleClickOutside}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            ref={modalRef}
            className={`bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]} overflow-hidden flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between p-4 border-b">
                {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
                {showCloseButton && (
                  <SmoothButton
                    $variant="ghost"
                    onClick={onClose}
                    aria-label="Close"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </SmoothButton>
                )}
              </div>
            )}
            
            <div className="p-4 flex-grow overflow-y-auto">
              {children}
            </div>
            
            {false && ( // Placeholder for footer - can be conditionally shown
              <div className="flex justify-end p-4 border-t bg-gray-50">
                <SmoothButton $variant="secondary" onClick={onClose}>
                  Close
                </SmoothButton>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface SmoothDropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  position?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  className?: string;
}

export const SmoothDropdownMenu: React.FC<SmoothDropdownMenuProps> = ({
  trigger,
  children,
  position = 'bottom-start',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const positionClasses = {
    'bottom-start': 'left-0 mt-2 origin-top-left',
    'bottom-end': 'right-0 mt-2 origin-top-right',
    'top-start': 'left-0 mb-2 origin-bottom-left',
    'top-end': 'right-0 mb-2 origin-bottom-right',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={`absolute z-50 min-w-max rounded-md bg-white shadow-lg ring-1 ring-black/10 ${positionClasses[position]} ${className}`}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SmoothTooltipWrapperProps {
  content: React.ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactNode;
  delay?: number;
}

export const SmoothTooltipWrapper: React.FC<SmoothTooltipWrapperProps> = ({
  content,
  position = 'top',
  children,
  delay = 0,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  return (
    <div className="relative inline-block">
      <div onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
        {children}
      </div>
      
      <AnimatePresence>
        {isVisible && (
          <SmoothTooltip
            $position={position}
            $visible={true}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2 }}
          >
            {content}
          </SmoothTooltip>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SmoothAccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const SmoothAccordionItem: React.FC<SmoothAccordionItemProps> = ({
  title,
  children,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  return (
    <div className="border border-gray-200 rounded-lg mb-2 overflow-hidden">
      <button
        className="w-full p-4 text-left font-medium bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▼
        </motion.span>
      </button>
      
      <motion.div
        initial={false}
        animate={{ height: contentHeight }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{ overflow: 'hidden' }}
      >
        <div ref={contentRef} className="p-4">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

interface SmoothAccordionProps {
  children: React.ReactNode;
}

export const SmoothAccordion: React.FC<SmoothAccordionProps> = ({ children }) => {
  return <div>{children}</div>;
};