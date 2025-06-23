import React from 'react';
import { createRoot } from 'react-dom/client'; // Import createRoot for React 18
import { AuthProvider } from './context/AuthContext'; // Import AuthProvider
import App from './App'; // Import the main App component

// Main entry point for the React application
const Index = () => (
  <>
    {/* Global Tailwind CSS import - crucial for styling */}
    {/* This script tag is included here for the Canvas environment's immediate preview.
        In a local development setup with a build tool, Tailwind is usually processed
        as a PostCSS plugin and bundled into your main CSS file, not loaded via CDN here. */}
    <script src="https://cdn.tailwindcss.com"></script>
    {/* Global CSS styles for font and scrollbar */}
    <style>
      {`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        /* Custom scrollbar for better aesthetics */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}
    </style>
    {/* AuthProvider wraps the entire application to provide authentication context */}
    <AuthProvider>
      <App /> {/* The main application component */}
    </AuthProvider>
  </>
);

// Render the application into the root DOM element
// For a local development environment (e.g., created with Create React App or Vite),
// you would typically have a setup like this at the very end of index.js:
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Index />);
// In the Canvas environment, exporting default Index is sufficient for rendering.
// Therefore, the above three lines are specifically for local development setups.
// They were commented out in previous versions but are now active for your local testing.
