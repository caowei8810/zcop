// Global styles for the smooth UI application
import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }

  body {
    background-color: #f8fafc; /* slate-50 */
    color: #1e293b; /* slate-800 */
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Smooth scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: #f1f5f9; /* slate-100 */
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: #cbd5e1; /* slate-300 */
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #94a3b8; /* slate-400 */
  }

  /* Focus styles for accessibility */
  button:focus,
  input:focus,
  select:focus,
  textarea:focus,
  a:focus {
    outline: 2px solid #4f46e5; /* indigo-600 */
    outline-offset: 2px;
  }

  /* Animation for reduced motion users */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;