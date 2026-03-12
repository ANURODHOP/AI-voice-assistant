const sessions = {}; // { CallSid: { language, lastTopic, lastIntent } }

export function getSession(callSid) {
  if (!sessions[callSid]) sessions[callSid] = { language: "en", lastTopic: null, lastIntent: "LOW" };
  return sessions[callSid];
}

export function setLanguage(callSid, lang) {
  const s = getSession(callSid);
  s.language = lang; // "en" or "hi"
}

export function updateMeta(callSid, meta = {}) {
  const s = getSession(callSid);
  if (meta.main_topic) s.lastTopic = meta.main_topic;
  if (meta.intent_level) s.lastIntent = meta.intent_level;
}
