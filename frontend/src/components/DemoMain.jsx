// src/components/DemoMain.jsx
const DemoMain = () => (
  <main className="max-w-7xl mx-auto py-16 px-4 md:px-8">
    <section className="mb-16">
      <h2 className="text-3xl font-bold mb-8 text-center dark:text-gray-100">About BMSCE</h2>
      <p className="text-lg leading-relaxed max-w-3xl mx-auto text-gray-700 dark:text-gray-300">
        Founded in 1946 by Late Sri. B. M. Sreenivasaiah, BMS College of Engineering is a premier institution in India offering quality engineering education. Located in the heart of Bengaluru, the Silicon Valley of India, BMSCE provides a conducive environment for learning and innovation.
      </p>
    </section>

    <section className="grid md:grid-cols-3 gap-8 mb-16">
      <div className="p-6 rounded-xl shadow-md bg-white dark:bg-gray-800">
        <h3 className="text-2xl font-semibold mb-4 dark:text-gray-100">Academic Programs</h3>
        <p className="text-gray-600 dark:text-gray-400">Undergraduate, Postgraduate, and Doctoral programs in various engineering disciplines.</p>
      </div>
      <div className="p-6 rounded-xl shadow-md bg-white dark:bg-gray-800">
        <h3 className="text-2xl font-semibold mb-4 dark:text-gray-100">Research & Innovation</h3>
        <p className="text-gray-600 dark:text-gray-400">State-of-the-art labs and centers promoting cutting-edge research.</p>
      </div>
      <div className="p-6 rounded-xl shadow-md bg-white dark:bg-gray-800">
        <h3 className="text-2xl font-semibold mb-4 dark:text-gray-100">Campus Life</h3>
        <p className="text-gray-600 dark:text-gray-400">Vibrant student community with clubs, sports, and cultural activities.</p>
      </div>
    </section>

    <section className="text-center py-12 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-gray-800 dark:to-gray-700 rounded-xl">
      <h2 className="text-3xl font-bold mb-4 dark:text-gray-100">Have Questions?</h2>
      <p className="text-lg mb-6 dark:text-gray-300">Use our Voice AI Assistant for instant answers!</p>
    </section>
  </main>
);

export default DemoMain;