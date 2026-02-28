import styled, { css } from 'styled-components';
import { motion } from 'framer-motion';

interface SmoothCardProps {
  $elevation?: 'none' | 'sm' | 'md' | 'lg';
  $rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  $interactive?: boolean;
  $hoverEffect?: boolean;
}

export const SmoothCard = styled(motion.div)<SmoothCardProps>`
  background: white;
  position: relative;
  overflow: hidden;
  
  /* Elevation styles */
  ${({ $elevation }) => {
    switch ($elevation) {
      case 'sm':
        return css`
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
        `;
      case 'md':
        return css`
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.03);
        `;
      case 'lg':
        return css`
          box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
        `;
      case 'none':
      default:
        return css`
          box-shadow: none;
        `;
    }
  }}
  
  /* Rounded corners */
  ${({ $rounded }) => {
    switch ($rounded) {
      case 'sm':
        return css`
          border-radius: 0.25rem;
        `;
      case 'md':
        return css`
          border-radius: 0.375rem;
        `;
      case 'lg':
        return css`
          border-radius: 0.5rem;
        `;
      case 'xl':
        return css`
          border-radius: 0.75rem;
        `;
      case 'full':
        return css`
          border-radius: 9999px;
        `;
      case 'none':
      default:
        return css`
          border-radius: 0;
        `;
    }
  }}
  
  /* Interactive styles */
  ${({ $interactive }) => $interactive && css`
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  `}
  
  /* Hover effects */
  ${({ $hoverEffect, $interactive }) => $hoverEffect && $interactive && css`
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    }
  `}
`;

interface SmoothButtonProps {
  $variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'link';
  $size?: 'sm' | 'md' | 'lg';
  $fullWidth?: boolean;
  $isLoading?: boolean;
  $disabled?: boolean;
}

export const SmoothButton = styled(motion.button)<SmoothButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  text-decoration: none;
  border: none;
  cursor: ${({ $disabled }) => $disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ $disabled }) => $disabled ? 0.6 : 1};
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Size variations */
  ${({ $size }) => {
    switch ($size) {
      case 'sm':
        return css`
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          min-height: 2rem;
        `;
      case 'lg':
        return css`
          padding: 0.75rem 1.5rem;
          font-size: 1.125rem;
          min-height: 3rem;
        `;
      case 'md':
      default:
        return css`
          padding: 0.625rem 1.25rem;
          font-size: 1rem;
          min-height: 2.5rem;
        `;
    }
  }}
  
  /* Full width */
  ${({ $fullWidth }) => $fullWidth && css`
    width: 100%;
  `}
  
  /* Variant styles */
  ${({ $variant }) => {
    switch ($variant) {
      case 'primary':
        return css`
          background-color: #4f46e5; /* indigo-600 */
          color: white;
          &:hover:not(:disabled) {
            background-color: #4338ca; /* indigo-700 */
          }
          &:active:not(:disabled) {
            background-color: #3730a3; /* indigo-800 */
          }
        `;
      case 'secondary':
        return css`
          background-color: #f3f4f6; /* gray-100 */
          color: #374151; /* gray-700 */
          &:hover:not(:disabled) {
            background-color: #e5e7eb; /* gray-200 */
          }
          &:active:not(:disabled) {
            background-color: #d1d5db; /* gray-300 */
          }
        `;
      case 'tertiary':
        return css`
          background-color: #eef2ff; /* indigo-50 */
          color: #4f46e5; /* indigo-600 */
          &:hover:not(:disabled) {
            background-color: #e0e7ff; /* indigo-100 */
          }
          &:active:not(:disabled) {
            background-color: #c7d2fe; /* indigo-200 */
          }
        `;
      case 'ghost':
        return css`
          background-color: transparent;
          color: #4f46e5; /* indigo-600 */
          &:hover:not(:disabled) {
            background-color: #f3f4f6; /* gray-100 */
          }
          &:active:not(:disabled) {
            background-color: #e5e7eb; /* gray-200 */
          }
        `;
      case 'link':
        return css`
          background-color: transparent;
          color: #4f46e5; /* indigo-600 */
          text-decoration: underline;
          &:hover:not(:disabled) {
            color: #4338ca; /* indigo-700 */
          }
        `;
      default:
        return css`
          background-color: #4f46e5; /* indigo-600 */
          color: white;
        `;
    }
  }}
  
  &:disabled {
    cursor: not-allowed;
  }
`;

interface SmoothInputProps {
  $size?: 'sm' | 'md' | 'lg';
  $hasError?: boolean;
  $fullWidth?: boolean;
}

export const SmoothInput = styled(motion.input)<SmoothInputProps>`
  width: ${({ $fullWidth }) => $fullWidth ? '100%' : 'auto'};
  border: 1px solid;
  border-radius: 0.375rem;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Size variations */
  ${({ $size }) => {
    switch ($size) {
      case 'sm':
        return css`
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        `;
      case 'lg':
        return css`
          padding: 0.75rem 1rem;
          font-size: 1.125rem;
        `;
      case 'md':
      default:
        return css`
          padding: 0.625rem 0.875rem;
          font-size: 1rem;
        `;
    }
  }}
  
  /* Color variations */
  ${({ $hasError }) => $hasError ? css`
    border-color: #ef4444; /* red-500 */
    &:focus {
      border-color: #dc2626; /* red-600 */
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
    }
  ` : css`
    border-color: #d1d5db; /* gray-300 */
    &:focus {
      border-color: #4f46e5; /* indigo-600 */
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }
    &:hover:not(:focus) {
      border-color: #9ca3af; /* gray-400 */
    }
  `}
  
  &:disabled {
    background-color: #f9fafb; /* gray-50 */
    cursor: not-allowed;
  }
`;

interface SmoothBadgeProps {
  $variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  $size?: 'sm' | 'md' | 'lg';
}

export const SmoothBadge = styled(motion.span)<SmoothBadgeProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  border-radius: 9999px;
  
  /* Size variations */
  ${({ $size }) => {
    switch ($size) {
      case 'sm':
        return css`
          padding: 0.125rem 0.5rem;
          font-size: 0.75rem;
        `;
      case 'lg':
        return css`
          padding: 0.375rem 0.875rem;
          font-size: 0.875rem;
        `;
      case 'md':
      default:
        return css`
          padding: 0.25rem 0.625rem;
          font-size: 0.8125rem;
        `;
    }
  }}
  
  /* Variant styles */
  ${({ $variant }) => {
    switch ($variant) {
      case 'primary':
        return css`
          background-color: #eef2ff; /* indigo-50 */
          color: #4f46e5; /* indigo-600 */
        `;
      case 'secondary':
        return css`
          background-color: #f3f4f6; /* gray-100 */
          color: #6b7280; /* gray-500 */
        `;
      case 'success':
        return css`
          background-color: #ecfdf5; /* green-50 */
          color: #059669; /* green-600 */
        `;
      case 'warning':
        return css`
          background-color: #fffbeb; /* yellow-50 */
          color: #d97706; /* amber-600 */
        `;
      case 'danger':
        return css`
          background-color: #fef2f2; /* red-50 */
          color: #dc2626; /* red-600 */
        `;
      case 'info':
        return css`
          background-color: #eff6ff; /* blue-50 */
          color: #2563eb; /* blue-600 */
        `;
      default:
        return css`
          background-color: #eef2ff; /* indigo-50 */
          color: #4f46e5; /* indigo-600 */
        `;
    }
  }}
`;

interface SmoothProgressBarProps {
  $progress: number;
  $color?: 'primary' | 'success' | 'warning' | 'danger';
  $size?: 'sm' | 'md' | 'lg';
}

export const SmoothProgressBar = styled(motion.div)<SmoothProgressBarProps>`
  position: relative;
  border-radius: 9999px;
  overflow: hidden;
  background-color: #e5e7eb; /* gray-200 */
  
  /* Size variations */
  ${({ $size }) => {
    switch ($size) {
      case 'sm':
        return css`
          height: 0.5rem;
        `;
      case 'lg':
        return css`
          height: 1.25rem;
        `;
      case 'md':
      default:
        return css`
          height: 0.75rem;
        `;
    }
  }}
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: ${({ $progress }) => Math.min(100, Math.max(0, $progress))}%;
    transition: width 0.3s ease-out;
    
    /* Color variations */
    ${({ $color }) => {
      switch ($color) {
        case 'success':
          return css`
            background-color: #10b981; /* green-500 */
          `;
        case 'warning':
          return css`
            background-color: #f59e0b; /* amber-500 */
          `;
        case 'danger':
          return css`
            background-color: #ef4444; /* red-500 */
          `;
        case 'primary':
        default:
          return css`
            background-color: #4f46e5; /* indigo-600 */
          `;
      }
    }}
  }
`;

interface SmoothTooltipProps {
  $position?: 'top' | 'right' | 'bottom' | 'left';
  $visible?: boolean;
}

export const SmoothTooltip = styled(motion.div)<SmoothTooltipProps>`
  position: absolute;
  z-index: 50;
  padding: 0.5rem 0.75rem;
  background-color: #1f2937; /* gray-800 */
  color: white;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  
  /* Position variations */
  ${({ $position }) => {
    switch ($position) {
      case 'top':
        return css`
          bottom: calc(100% + 0.5rem);
          left: 50%;
          transform: translateX(-50%);
        `;
      case 'right':
        return css`
          top: 50%;
          left: calc(100% + 0.5rem);
          transform: translateY(-50%);
        `;
      case 'bottom':
        return css`
          top: calc(100% + 0.5rem);
          left: 50%;
          transform: translateX(-50%);
        `;
      case 'left':
        return css`
          top: 50%;
          right: calc(100% + 0.5rem);
          transform: translateY(-50%);
        `;
      default:
        return css`
          bottom: calc(100% + 0.5rem);
          left: 50%;
          transform: translateX(-50%);
        `;
    }
  }}
  
  /* Visibility */
  ${({ $visible }) => $visible && css`
    opacity: 1;
  `}
  
  &::after {
    content: '';
    position: absolute;
    width: 0.5rem;
    height: 0.5rem;
    background-color: #1f2937; /* gray-800 */
    
    /* Position arrow */
    ${({ $position }) => {
      switch ($position) {
        case 'top':
          return css`
            top: 100%;
            left: 50%;
            transform: translateX(-50%) rotate(45deg);
          `;
        case 'right':
          return css`
            top: 50%;
            left: -0.25rem;
            transform: translateY(-50%) rotate(45deg);
          `;
        case 'bottom':
          return css`
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%) rotate(45deg);
          `;
        case 'left':
          return css`
            top: 50%;
            right: -0.25rem;
            transform: translateY(-50%) rotate(45deg);
          `;
        default:
          return css`
            top: 100%;
            left: 50%;
            transform: translateX(-50%) rotate(45deg);
          `;
      }
    }}
  }
`;