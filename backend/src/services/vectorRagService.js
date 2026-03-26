import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const BRAIN_DATA_PATH = path.join(__dirname, '../../src/crawler/data/brain_data.json');
const EMBEDDINGS_PATH = path.join(__dirname, '../../src/crawler/data/embeddings.json');

let BRAIN_DATA = [];
let EMBEDDINGS = [];
let embedder = null;

// ============================================
// STEP 1: Load Brain Data
// ============================================
export function loadBrainData() {
  try {
    if (fs.existsSync(BRAIN_DATA_PATH)) {
      BRAIN_DATA = JSON.parse(fs.readFileSync(BRAIN_DATA_PATH, 'utf-8'));
      console.log(`✅ Loaded ${BRAIN_DATA.length} brain chunks`);
      return true;
    } else {
      console.error('❌ brain_data.json not found at:', BRAIN_DATA_PATH);
      return false;
    }
  } catch (error) {
    console.error('❌ Error loading brain data:', error.message);
    return false;
  }
}

// ============================================
// STEP 2: Create Embeddings (One-time)
// ============================================
export async function createEmbeddings() {
  console.log('\n🧠 Creating embeddings for all chunks...');
  console.log('⏳ This will take 5-10 minutes (one-time process)');
  
  if (BRAIN_DATA.length === 0) {
    console.error('❌ No brain data loaded. Run loadBrainData() first.');
    return false;
  }

  try {
    // Load the embedding model
    console.log('📥 Loading embedding model...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('✅ Model loaded');

    const embeddings = [];
    const batchSize = 100;
    
    for (let i = 0; i < BRAIN_DATA.length; i++) {
      const chunk = BRAIN_DATA[i];
      
      // Generate embedding
      const output = await embedder(chunk.text, { 
        pooling: 'mean', 
        normalize: true 
      });
      const embedding = Array.from(output.data);
      
      embeddings.push({
        id: chunk.id,
        embedding: embedding,
      });
      
      // Progress updates
      if ((i + 1) % batchSize === 0 || i === BRAIN_DATA.length - 1) {
        const progress = ((i + 1) / BRAIN_DATA.length * 100).toFixed(1);
        console.log(`   ✅ Processed ${i + 1}/${BRAIN_DATA.length} chunks (${progress}%)`);
      }
    }
    
    // Save embeddings to file
    fs.writeFileSync(EMBEDDINGS_PATH, JSON.stringify(embeddings, null, 2));
    console.log(`✅ Embeddings saved to: ${EMBEDDINGS_PATH}`);
    console.log(`💾 File size: ${(fs.statSync(EMBEDDINGS_PATH).size / 1024 / 1024).toFixed(2)} MB`);
    
    EMBEDDINGS = embeddings;
    return true;
    
  } catch (error) {
    console.error('❌ Error creating embeddings:', error.message);
    return false;
  }
}

// ============================================
// STEP 3: Load Existing Embeddings
// ============================================
export async function loadEmbeddings() {
  try {
    if (fs.existsSync(EMBEDDINGS_PATH)) {
      console.log('📥 Loading pre-computed embeddings...');
      EMBEDDINGS = JSON.parse(fs.readFileSync(EMBEDDINGS_PATH, 'utf-8'));
      console.log(`✅ Loaded ${EMBEDDINGS.length} embeddings`);
      
      // Load model for query embedding
      if (!embedder) {
        console.log('📥 Loading embedding model for queries...');
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('✅ Model ready');
      }
      
      return true;
    } else {
      console.log('⚠️  No embeddings found. Creating them now...');
      return await createEmbeddings();
    }
  } catch (error) {
    console.error('❌ Error loading embeddings:', error.message);
    return false;
  }
}

// ============================================
// STEP 4: Cosine Similarity
// ============================================
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================
// STEP 5: Semantic Search
// ============================================
export async function semanticSearch(query, topK = 10) {
  if (EMBEDDINGS.length === 0) {
    console.error('❌ No embeddings loaded');
    return [];
  }

  try {
    // Embed the query
    const queryOutput = await embedder(query, { 
      pooling: 'mean', 
      normalize: true 
    });
    const queryEmbedding = Array.from(queryOutput.data);
    
    // Calculate similarities
    const results = EMBEDDINGS.map(item => {
      const chunk = BRAIN_DATA.find(c => c.id === item.id);
      if (!chunk) return null;
      
      const similarity = cosineSimilarity(queryEmbedding, item.embedding);
      
      return { ...chunk, similarity };
    }).filter(r => r !== null);
    
    // Sort by similarity and take top K
    const topResults = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
    
    console.log(`🔍 Semantic search for: "${query}"`);
    console.log(`   Top match: ${(topResults[0]?.similarity * 100).toFixed(1)}% similarity`);
    console.log(`   Found ${topResults.length} relevant chunks`);
    
    return topResults;
    
  } catch (error) {
    console.error('❌ Error in semantic search:', error.message);
    return [];
  }
}

// ============================================
// STEP 6: Build Context
// ============================================
export function buildContext(chunks) {
  return chunks
    .map((chunk, i) => `[Source ${i + 1}] ${chunk.text}`)
    .join('\n\n');
}

// ============================================
// STEP 7: Get Sources
// ============================================
export function getSources(chunks) {
  const sources = [...new Set(chunks.map(c => c.source_url))];
  return sources.slice(0, 5);
}

// ============================================
// STEP 8: Initialize System
// ============================================
export async function initializeVectorRAG() {
  console.log('\n🚀 Initializing Vector RAG System...\n');
  
  // Step 1: Load brain data
  const brainLoaded = loadBrainData();
  if (!brainLoaded) {
    console.error('❌ Failed to load brain data');
    return false;
  }
  
  // Step 2: Load or create embeddings
  const embeddingsReady = await loadEmbeddings();
  if (!embeddingsReady) {
    console.error('❌ Failed to initialize embeddings');
    return false;
  }
  
  console.log('\n✅ Vector RAG System Ready!\n');
  return true;
}