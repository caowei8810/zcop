import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmoothCard, SmoothButton, SmoothProgressBar } from '../styles/SmoothUIStyles';

interface SmoothLoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
}

export const SmoothLoadingOverlay: React.FC<SmoothLoadingOverlayProps> = ({
  isLoading,
  children,
  className = ''
}) => {
  return (
    <div className={`relative ${className}`}>
      {children}
      
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-t-indigo-600 border-r-indigo-600 border-b-gray-200 border-l-gray-200 rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SmoothSkeletonProps {
  type?: 'text' | 'rect' | 'circle' | 'image';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const SmoothSkeleton: React.FC<SmoothSkeletonProps> = ({
  type = 'text',
  width = '100%',
  height,
  className = ''
}) => {
  const getHeight = () => {
    switch (type) {
      case 'circle':
        return width;
      case 'text':
        return height || '1em';
      case 'image':
        return height || '120px';
      case 'rect':
      default:
        return height || '20px';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{ width, height: getHeight() }}
      className={`
        rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
        ${type === 'circle' ? 'rounded-full' : ''}
        ${type === 'text' ? 'rounded-sm' : ''}
        ${className}
      `}
    />
  );
};

interface SmoothAnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const SmoothAnimatedCounter: React.FC<SmoothAnimatedCounterProps> = ({
  value,
  duration = 1,
  prefix = '',
  suffix = '',
  className = ''
}) => {
  const [count, setCount] = useState(0);
  const [displayedValue, setDisplayedValue] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    const increment = value / (duration * 60); // assuming 60fps
    let current = 0;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = timestamp - start;
      
      if (progress < duration * 1000) {
        current += increment;
        if (current > value) current = value;
        setDisplayedValue(Math.floor(current));
        requestAnimationFrame(animate);
      } else {
        setDisplayedValue(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <div className={className}>
      {prefix}{displayedValue.toLocaleString()}{suffix}
    </div>
  );
};

interface SmoothProgressIndicatorProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export const SmoothProgressIndicator: React.FC<SmoothProgressIndicatorProps> = ({
  steps,
  currentStep,
  className = ''
}) => {
  return (
    <div className={`flex items-center ${className}`}>
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                index <= currentStep
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {index < currentStep ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <span className={`mt-2 text-xs ${index <= currentStep ? 'text-indigo-600' : 'text-gray-500'}`}>
              {step}
            </span>
          </div>
          
          {index < steps.length - 1 && (
            <div className={`flex-1 h-0.5 ${index < currentStep ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

interface SmoothAnimatedBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export const SmoothAnimatedBackground: React.FC<SmoothAnimatedBackgroundProps> = ({
  children,
  className = ''
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      
      setMousePosition({ x, y });
      setRotation({
        x: (y - 0.5) * 10,
        y: (x - 0.5) * -10
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <motion.div
        className="absolute inset-0 z-0"
        animate={{
          backgroundPosition: [`${mousePosition.x * 100}% ${mousePosition.y * 100}%`, `${mousePosition.x * 100 + 20}% ${mousePosition.y * 100 + 20}%`]
        }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
        style={{
          background: `radial-gradient(circle at ${mousePosition.x * 100}% ${mousePosition.y * 100}%, 
                      rgba(99, 102, 241, 0.1) 0%, 
                      rgba(165, 180, 252, 0.05) 25%, 
                      transparent 80%)`,
          height: '300%',
          width: '300%',
          top: '-100%',
          left: '-100%'
        }}
      />
      
      <motion.div
        style={{ rotateX: rotation.x, rotateY: rotation.y }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
};

interface SmoothHoverCardProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export const SmoothHoverCard: React.FC<SmoothHoverCardProps> = ({
  children,
  content,
  position = 'top',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(true);
  };

  const hide = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(false), 300);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    right: 'top-1/2 left-full transform -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'top-1/2 right-full transform -translate-y-1/2 mr-2'
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        onMouseEnter={show}
        onMouseLeave={hide}
        className="cursor-default"
      >
        {children}
      </div>
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: position === 'top' ? 10 : position === 'bottom' ? -10 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: position === 'top' ? 10 : position === 'bottom' ? -10 : 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={`absolute z-50 bg-white p-4 rounded-lg shadow-lg w-64 ${positionClasses[position]}`}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SmoothAnimatedListProps {
  items: string[];
  className?: string;
}

export const SmoothAnimatedList: React.FC<SmoothAnimatedListProps> = ({
  items,
  className = ''
}) => {
  return (
    <div className={className}>
      {items.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className="py-2 px-4 hover:bg-gray-50 rounded-md"
        >
          {item}
        </motion.div>
      ))}
    </div>
  );
};

interface SmoothStaggeredAnimationProps {
  children: React.ReactNode;
  delay?: number;
  stagger?: number;
  className?: string;
}

export const SmoothStaggeredAnimation: React.FC<SmoothStaggeredAnimationProps> = ({
  children,
  delay = 0,
  stagger = 0.1,
  className = ''
}) => {
  const items = React.Children.toArray(children);
  
  return (
    <div className={className}>
      {items.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.5, 
            delay: delay + (index * stagger),
            type: 'spring',
            damping: 25,
            stiffness: 300
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
};

interface SmoothParallaxSectionProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}

export const SmoothParallaxSection: React.FC<SmoothParallaxSectionProps> = ({
  children,
  speed = 0.5,
  className = ''
}) => {
  const [offset, setOffset] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.pageYOffset;
      const parallax = scrolled * speed;
      setOffset(parallax);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return (
    <motion.div
      style={{ transform: `translateY(${offset}px)` }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface SmoothPulseAnimationProps {
  children: React.ReactNode;
  duration?: number;
  className?: string;
}

export const SmoothPulseAnimation: React.FC<SmoothPulseAnimationProps> = ({
  children,
  duration = 2,
  className = ''
}) => {
  return (
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ 
        duration,
        repeat: Infinity,
        ease: 'easeInOut'
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};