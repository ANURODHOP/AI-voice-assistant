import fs from 'fs';

const brainData = JSON.parse(fs.readFileSync('./src/crawler/data/brain_data.json', 'utf-8'));

console.log(`\n📊 Total chunks: ${brainData.length}\n`);

// 1. Search for AIML mentions
console.log('🔍 Searching for AIML-related content...\n');

const aimlChunks = brainData.filter(chunk => {
  const text = chunk.text.toLowerCase();
  return text.includes('aiml') || 
         text.includes('artificial intelligence') || 
         text.includes('machine learning') ||
         text.includes('ai/ml') ||
         text.includes('ai & ml');
});

console.log(`Found ${aimlChunks.length} chunks mentioning AIML\n`);

if (aimlChunks.length > 0) {
  console.log('📄 Sample AIML content:\n');
  aimlChunks.slice(0, 5).forEach((chunk, i) => {
    console.log(`[${i + 1}] URL: ${chunk.source_url}`);
    console.log(`    Content: ${chunk.text.substring(0, 150)}...`);
    console.log('');
  });
}

// 2. Search for HOD/Faculty mentions
console.log('\n🔍 Searching for HOD/Faculty content...\n');

const hodChunks = brainData.filter(chunk => {
  const text = chunk.text.toLowerCase();
  return text.includes('hod') || 
         text.includes('head of department') || 
         text.includes('professor') ||
         text.includes('faculty') ||
         text.includes('dr.');
});

console.log(`Found ${hodChunks.length} chunks mentioning faculty/HOD\n`);

if (hodChunks.length > 0) {
  console.log('📄 Sample faculty content:\n');
  hodChunks.slice(0, 5).forEach((chunk, i) => {
    console.log(`[${i + 1}] URL: ${chunk.source_url}`);
    console.log(`    Content: ${chunk.text.substring(0, 150)}...`);
    console.log('');
  });
}

// 3. Check unique URLs
const urls = [...new Set(brainData.map(c => c.source_url))];

console.log(`\n📊 Total unique URLs crawled: ${urls.length}\n`);

const aimlUrls = urls.filter(url => 
  url.toLowerCase().includes('aiml') || 
  url.toLowerCase().includes('artificial') ||
  url.toLowerCase().includes('machine-learning')
);

console.log(`AIML-specific URLs: ${aimlUrls.length}`);
aimlUrls.forEach(url => console.log(`  - ${url}`));

// 4. Check department pages
console.log(`\n📊 Department pages crawled:\n`);
const deptUrls = urls.filter(url => 
  url.toLowerCase().includes('department') ||
  url.toLowerCase().includes('engineering')
);

deptUrls.slice(0, 15).forEach(url => console.log(`  - ${url}`));