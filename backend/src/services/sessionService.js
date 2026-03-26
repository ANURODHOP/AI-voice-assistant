// src/services/sessionService.js

const sessions = {};

export function getSession(sessionId) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      language: "en",
      lastTopic: null,
      lastIntent: "LOW",
      conversationHistory: [], // ✅ Store full history
      createdAt: new Date(),
      lastActivity: new Date(),
    };
  }
  
  // Update last activity
  sessions[sessionId].lastActivity = new Date();
  
  return sessions[sessionId];
}

export function addMessage(sessionId, role, content) {
  const session = getSession(sessionId);
  
  session.conversationHistory.push({
    role: role, // 'user' or 'assistant'
    content: content,
    timestamp: new Date(),
  });
  
  // Keep only last 10 messages (5 exchanges) to avoid token limits
  if (session.conversationHistory.length > 10) {
    session.conversationHistory = session.conversationHistory.slice(-10);
  }
  
  return session;
}

export function updateMeta(sessionId, meta = {}) {
  const session = getSession(sessionId);
  
  if (meta.main_topic) session.lastTopic = meta.main_topic;
  if (meta.intent_level) session.lastIntent = meta.intent_level;
  if (meta.language) session.language = meta.language;
  
  return session;
}

export function getConversationContext(sessionId) {
  const session = getSession(sessionId);
  
  // Return formatted conversation history for the prompt
  return session.conversationHistory
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');
}

export function clearSession(sessionId) {
  delete sessions[sessionId];
}

// Clean up old sessions (run periodically)
export function cleanupOldSessions(maxAgeMinutes = 30) {
  const now = new Date();
  
  Object.keys(sessions).forEach(sessionId => {
    const session = sessions[sessionId];
    const ageMinutes = (now - session.lastActivity) / (1000 * 60);
    
    if (ageMinutes > maxAgeMinutes) {
      delete sessions[sessionId];
      console.log(`🧹 Cleaned up session: ${sessionId} (inactive for ${ageMinutes.toFixed(1)} min)`);
    }
  });
}

// Auto-cleanup every 10 minutes
setInterval(() => cleanupOldSessions(30), 10 * 60 * 1000);