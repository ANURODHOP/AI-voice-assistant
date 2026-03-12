// src/App.jsx
import { useState, useEffect } from 'react';
import { Mic } from 'lucide-react'
import { cn } from './lib/utils';
import VoiceAssistantModal from './components/VoiceAssistantModal';
import DemoHeader from './components/DemoHeader';
import DemoMain from './components/DemoMain';
import DemoFooter from './components/DemoFooter';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <div className={cn("min-h-screen", isDarkMode ? "dark bg-gray-950" : "bg-gray-50")}>
      {/* Floating AI Button */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-center gap-2">
        <button
          onClick={() => setIsAIOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 shadow-2xl transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          aria-label="Open BMSCE Voice AI"
        >
          <Mic className="h-7 w-5 text-white" strokeWidth={2.0} />
        </button>

        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Ask with AI
        </span>
      </div>

      {/* Demo Website Content */}
      <DemoHeader isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)} />
      <DemoMain />
      <DemoFooter />

      {/* AI Modal Overlay */}
      {isAIOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm transition-opacity duration-300"
          onClick={(e) => {
            // Close only when clicking the overlay (not the modal content)
            if (e.target === e.currentTarget) {
              setIsAIOpen(false);
            }
          }}
        >
          <VoiceAssistantModal
            onClose={() => setIsAIOpen(false)}
            isDarkMode={isDarkMode}
            toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          />
        </div>
      )}
    </div>
  );
}

export default App;