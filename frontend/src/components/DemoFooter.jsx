// src/components/DemoFooter.jsx
const DemoFooter = () => (
  <footer className="bg-gray-800 text-gray-300 py-8 px-4 md:px-8">
    <div className="max-w-7xl mx-auto text-center">
      <p>&copy; {new Date().getFullYear()} BMS College of Engineering. All rights reserved.</p>
      <p className="mt-2">Bull Temple Road, Bengaluru - 560019 | Phone: +91-80-26622130</p>
    </div>
  </footer>
);

export default DemoFooter;