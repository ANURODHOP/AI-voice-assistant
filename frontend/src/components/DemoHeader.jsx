// src/components/DemoHeader.jsx
const DemoHeader = ({ isDarkMode, toggleDarkMode }) => (
  <header className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white py-16 px-4 md:px-8">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
      <div>
        <h1 className="text-4xl md:text-5xl font-bold mb-2">BMS College of Engineering</h1>
        <p className="text-xl opacity-90">Autonomous Institute Affiliated to VTU | NAAC A++ Accredited</p>
      </div>
      <button
        onClick={toggleDarkMode}
        className="mt-4 md:mt-0 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Toggle dark mode"
      >
        {isDarkMode ? '☀️' : '🌙'}
      </button>
    </div>
  </header>
);

export default DemoHeader;