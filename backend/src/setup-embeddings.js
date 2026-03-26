import dotenv from 'dotenv';
import { loadBrainData, createEmbeddings } from './services/vectorRagService.js';

dotenv.config();

async function setup() {
  console.log('🚀 BMSCE Vector RAG Setup\n');
  
  // Load brain data
  const loaded = loadBrainData();
  if (!loaded) {
    console.error('❌ Failed to load brain data');
    process.exit(1);
  }
  
  // Create embeddings
  const success = await createEmbeddings();
  
  if (success) {
    console.log('\n✅ Setup complete! You can now start the server.');
    console.log('   Run: node src/server.js');
  } else {
    console.error('\n❌ Setup failed');
    process.exit(1);
  }
}

setup();