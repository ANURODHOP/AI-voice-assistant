// src/components/VoiceAssistantModal.jsx
import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Phone, PhoneOff, Send, X, Square } from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const API_BASE         = import.meta.env.VITE_API_URL;
const SILENCE_DB       = 0.015;  // below = silence while listening
const SILENCE_MS       = 1800;   // quiet after speech → send
const HANGUP_MS        = 12000;  // no speech at all → warn
const HANGUP_MS2       = 5000;   // after warn → end
// Barge-in: lower threshold because mic+speaker echo is already filtered
// We detect CHANGE in volume, not absolute volume
const BARGE_THRESHOLD  = 0.025;  // lower than SILENCE_DB — any voice counts
const BARGE_SUSTAIN    = 200;    // ms must stay above threshold (avoids speaker bleed)

const PAUSE_KEYWORDS = [
  'stop','wait','ruko','bas','hold on','ek second','ek min',
  'suno','pause','chup','thehro','sun','baat karo',
];

// End-call phrases — checked against real Azure STT transcript (reliable)
const END_PHRASES = [
  'end call','end the call','stop the call','disconnect','hang up',
  'goodbye','good bye','bye bye','ok bye','okay bye','thank you bye',
  'thanks bye','that is all','i am done','no more questions','nothing else',
  'call khatam','call band karo','call end karo','band karo',
  'bas karo','khatam karo','phone rakh','rakh do','theek hai bye',
  'alvida','shukriya bye','ok shukriya','bas itna hi','aur kuch nahi',
  'koi sawal nahi','thank you bhai','dhanyawad',
];
// Single words — end call only if that is the ENTIRE message
const END_SINGLE = ['bye','done','thanks','shukriya','alvida','bas','khatam'];
const isEndPhrase = (text) => {
  const t = text.toLowerCase().trim();
  if (END_PHRASES.some(p => t.includes(p))) return true;
  if (t.split(/\s+/).length <= 2 && END_SINGLE.some(w => t === w || t.startsWith(w + ' '))) return true;
  return false;
};

export default function VoiceAssistantModal({ onClose, isDarkMode, toggleDarkMode }) {

  const [mode,        setMode]        = useState('chat');
  const [callStatus,  setCallStatus]  = useState('idle');
  const [callDuration,setCallDuration]= useState(0);
  const [isMuted,     setIsMuted]     = useState(false);
  const [vadLevel,    setVadLevel]    = useState(0);
  const [messages,    setMessages]    = useState([]);
  const [chatInput,   setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showBadge,   setShowBadge]   = useState('');

  // ── Single persistent mic — open for entire call ───────────────────────────
  const micStream   = useRef(null);
  const micCtx      = useRef(null);
  const micAnalyser = useRef(null);

  // ── Recorder (reuses micStream, starts/stops per turn) ────────────────────
  const recorderRef = useRef(null);
  const chunksRef   = useRef([]);

  // ── Playback ───────────────────────────────────────────────────────────────
  const audioRef    = useRef(null);

  // ── Timers ─────────────────────────────────────────────────────────────────
  const silTimerRef  = useRef(null);
  const hangTimerRef = useRef(null);
  const bargeTimerRef= useRef(null);
  const callTimerRef = useRef(null);
  const vadAnimRef   = useRef(null);

  // ── State refs — source of truth inside ALL async/closure code ────────────
  const callActive     = useRef(false);
  const statusRef      = useRef('idle');
  const mutedRef       = useRef(false);
  // Interrupt callback — speak() sets this, VAD/keyword calls it
  const onInterruptRef = useRef(null);
  // Volume baseline during TTS playback — barge-in detects RISE above this
  const speakBaselineRef = useRef(0);

  // ── Web Speech for keyword detection ──────────────────────────────────────
  const recognitionRef = useRef(null);

  const msgEndRef  = useRef(null);
  const sessionId  = useRef(`s_${Date.now()}`);

  // ── helpers ────────────────────────────────────────────────────────────────
  const setStatus = (s) => { statusRef.current = s; setCallStatus(s); };
  const setMutedB = (v) => { mutedRef.current  = v; setIsMuted(v); };
  const addMsg    = (type, content) =>
    setMessages(p => [...p, { type, content }]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (mode === 'call') {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return () => clearInterval(callTimerRef.current);
  }, [mode]);

  useEffect(() => () => {
    killEverything();
    clearInterval(callTimerRef.current);
  }, []);

  const fmt = (s) =>
    `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  // ══════════════════════════════════════════════════════════════════════════
  // OPEN MIC — once per call, stays open
  // ══════════════════════════════════════════════════════════════════════════
  const openMic = async () => {
    if (micStream.current) return true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
          sampleRate: 48000,
        },
      });
    } catch (err) {
      addMsg('ai', err.name === 'NotAllowedError'
        ? 'Mic access denied — allow it in browser settings.'
        : 'No microphone found.');
      return false;
    }
    micStream.current = stream;
    const ctx = new AudioContext();
    micCtx.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;  // smaller = faster, enough for volume detection
    src.connect(analyser);
    micAnalyser.current = analyser;
    return true;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MASTER VAD LOOP
  // Runs the ENTIRE call from startCall() to endCall().
  // Never stops. Behaviour changes based on statusRef:
  //
  //  'listening'  → silence detection → sends when user stops talking
  //  'speaking'   → barge-in detection → interrupts TTS when user speaks
  //  'processing' → just animate the ring (can't do much here)
  //  'idle'       → just animate
  //
  // Key insight: spokenOnce lives OUTSIDE the loop so it persists across turns
  // ══════════════════════════════════════════════════════════════════════════
  const startVADLoop = () => {
    if (!micAnalyser.current) return;
    cancelAnimationFrame(vadAnimRef.current);

    const analyser = micAnalyser.current;
    const buf      = new Uint8Array(analyser.fftSize);
    let spokenOnce = false; // persists across the whole call

    const tick = () => {
      if (!callActive.current) { setVadLevel(0); return; }

      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const vol = Math.sqrt(sum / buf.length);
      setVadLevel(Math.min(vol * 6, 1));

      const st    = statusRef.current;
      const muted = mutedRef.current;

      // ── LISTENING: silence detection ─────────────────────────────────
      if (st === 'listening' && !muted) {
        if (vol > SILENCE_DB) {
          spokenOnce = true;
          clearTimeout(silTimerRef.current);
          clearTimeout(hangTimerRef.current);
          silTimerRef.current  = null;
          hangTimerRef.current = null;
        } else if (spokenOnce && !silTimerRef.current) {
          silTimerRef.current = setTimeout(async () => {
            if (!callActive.current || statusRef.current !== 'listening') return;
            cancelAnimationFrame(vadAnimRef.current);
            spokenOnce = false;
            const blob = await stopRecorder();
            if (callActive.current) {
              processBlob(blob);
              // Restart VAD immediately so barge-in works during processing
              startVADLoop();
            }
          }, SILENCE_MS);
        }

      // ── SPEAKING: barge-in detection ─────────────────────────────────
      // We measure rise ABOVE the ambient level during TTS playback.
      // speakBaselineRef is set just before audio starts playing.
      } else if (st === 'speaking' && !muted) {
        const rise = vol - speakBaselineRef.current;
        if (rise > BARGE_THRESHOLD) {
          if (!bargeTimerRef.current) {
            bargeTimerRef.current = setTimeout(() => {
              bargeTimerRef.current = null;
              if (statusRef.current !== 'speaking' || !callActive.current) return;
              console.log('🗣️ Barge-in!', { vol, baseline: speakBaselineRef.current, rise });
              const cb = onInterruptRef.current;
              onInterruptRef.current = null;
              cb?.('bargein');
            }, BARGE_SUSTAIN);
          }
        } else {
          if (bargeTimerRef.current) {
            clearTimeout(bargeTimerRef.current);
            bargeTimerRef.current = null;
          }
        }

      // ── OTHER: reset barge timer ──────────────────────────────────────
      } else {
        if (bargeTimerRef.current) {
          clearTimeout(bargeTimerRef.current);
          bargeTimerRef.current = null;
        }
      }

      vadAnimRef.current = requestAnimationFrame(tick);
    };

    vadAnimRef.current = requestAnimationFrame(tick);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // KEYWORD WATCHER — Web Speech API partial results, runs whole call
  // Catches "stop/ruko/wait" while AI is speaking, BEFORE silence
  // ══════════════════════════════════════════════════════════════════════════
  const startKeywordWatch = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const r          = new SR();
    r.continuous     = true;
    r.interimResults = true;
    r.lang           = 'hi-IN';

    r.onresult = (e) => {
      if (!callActive.current) return;
      const text = Array.from(e.results)
        .map(res => res[0].transcript.toLowerCase())
        .join(' ');

      // End-call — works during ANY phase, highest priority
      const endHit = isEndPhrase(text);
      if (endHit) {
        console.log('📵 End call keyword:', text);
        handleEndByVoice();
        return;
      }

      // Pause — only while AI is speaking
      if (statusRef.current !== 'speaking') return;
      const pauseHit = PAUSE_KEYWORDS.some(kw => text.includes(kw));
      if (pauseHit) {
        console.log('🛑 Pause keyword:', text);
        const cb = onInterruptRef.current;
        onInterruptRef.current = null;
        cb?.('keyword');
      }
    };

    r.onerror = () => {
      // Auto-restart on non-fatal errors
      try { r.stop(); setTimeout(() => { try { r.start(); } catch(_){} }, 300); } catch(_) {}
    };

    try { r.start(); recognitionRef.current = r; } catch(_) {}
  };

  const stopKeywordWatch = () => {
    try { recognitionRef.current?.stop(); } catch(_) {}
    recognitionRef.current = null;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RECORDER — start/stop on the shared micStream
  // ══════════════════════════════════════════════════════════════════════════
  const startRecorder = () => {
    if (!micStream.current || recorderRef.current) return;
    chunksRef.current = [];
    const rec = new MediaRecorder(micStream.current, { mimeType: 'audio/webm;codecs=opus' });
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.start(200);
    recorderRef.current = rec;
  };

  const stopRecorder = () => new Promise(resolve => {
    const rec    = recorderRef.current;
    const chunks = [...chunksRef.current];
    recorderRef.current = null;
    chunksRef.current   = [];

    if (!rec || rec.state === 'inactive') {
      resolve(chunks.length ? new Blob(chunks, { type: 'audio/webm' }) : null);
      return;
    }
    rec.onstop = () =>
      resolve(chunks.length ? new Blob(chunks, { type: 'audio/webm' }) : null);
    try { rec.stop(); } catch { resolve(null); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SPEAK
  // • Sets status to 'speaking' so VAD loop switches to barge-in mode
  // • Samples mic volume BEFORE playback to get a baseline
  // • Registers onInterruptRef so VAD/keyword can fire the interrupt
  // • Returns: 'ended' | 'bargein' | 'keyword'
  // ══════════════════════════════════════════════════════════════════════════
  const speak = async (text) => {
    if (!callActive.current) return 'ended';

    // Sample ambient/echo level before TTS starts — use this as baseline
    // so barge-in detects RISE above current noise floor, not absolute volume
    if (micAnalyser.current) {
      const buf = new Uint8Array(micAnalyser.current.fftSize);
      micAnalyser.current.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128; sum += v * v;
      }
      speakBaselineRef.current = Math.sqrt(sum / buf.length);
    }

    setStatus('speaking');
    setShowBadge('');

    let result = 'ended';
    try {
      const r = await fetch(`${API_BASE}/api/tts?text=${encodeURIComponent(text)}`);
      if (!r.ok) throw new Error('TTS');
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const aud  = new Audio(url);
      audioRef.current = aud;

      result = await new Promise((resolve) => {
        onInterruptRef.current = (reason) => {
          aud.pause();
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve(reason);
        };
        aud.onended = () => {
          onInterruptRef.current = null;
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve('ended');
        };
        aud.onerror = () => {
          onInterruptRef.current = null;
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve('ended');
        };
        aud.play().catch(() => resolve('ended'));
      });
    } catch {
      onInterruptRef.current = null;
    }

    clearTimeout(bargeTimerRef.current);
    bargeTimerRef.current = null;

    if (callActive.current && statusRef.current === 'speaking') {
      setStatus('idle');
    }
    return result;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // LISTEN — arms the recorder, starts hang timer
  // VAD loop already running, it handles the rest
  // ══════════════════════════════════════════════════════════════════════════
  const listen = () => {
    if (!callActive.current) return;

    clearTimeout(silTimerRef.current);
    clearTimeout(hangTimerRef.current);
    silTimerRef.current  = null;
    hangTimerRef.current = null;

    if (recorderRef.current) {
      try { recorderRef.current.stop(); } catch(_) {}
      recorderRef.current = null;
      chunksRef.current   = [];
    }

    setStatus('listening');
    setShowBadge('');
    startRecorder();

    // Auto-hangup if nobody speaks at all
    hangTimerRef.current = setTimeout(async () => {
      if (!callActive.current || statusRef.current !== 'listening') return;
      clearTimeout(silTimerRef.current);
      silTimerRef.current = null;
      await stopRecorder();
      addMsg('ai', "Still there? I didn't hear anything…");
      const r = await speak("Are you still there? I didn't hear anything.");
      if (!callActive.current) return;
      if (r === 'ended') {
        hangTimerRef.current = setTimeout(() => {
          if (callActive.current) endCall();
        }, HANGUP_MS2);
      } else {
        handleInterrupt(r);
      }
    }, HANGUP_MS);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLE INTERRUPT
  // ══════════════════════════════════════════════════════════════════════════
  const handleInterrupt = (reason) => {
    if (!callActive.current) return;
    clearTimeout(bargeTimerRef.current);
    bargeTimerRef.current = null;

    if (reason === 'bargein') {
      setShowBadge('interrupted');
      // User already speaking — start listening immediately
      // Don't add a message, just switch — it feels instant
      listen();
    } else if (reason === 'keyword') {
      setShowBadge('paused');
      addMsg('ai', '(paused — go ahead)');
      listen();
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PROCESS BLOB — STT → AI → speak → back to listen
  // ══════════════════════════════════════════════════════════════════════════
  const processBlob = async (blob) => {
    if (!callActive.current) return;

    if (!blob || blob.size < 3000) {
      const r = await speak("I didn't catch that — could you speak a bit louder?");
      if (callActive.current) r === 'ended' ? listen() : handleInterrupt(r);
      return;
    }

    setStatus('processing');

    try {
      // STT
      const fd = new FormData();
      fd.append('audio', blob, 'voice.webm');
      const sttR = await fetch(`${API_BASE}/api/stt`, { method: 'POST', body: fd });
      if (!sttR.ok) throw new Error('STT');
      const { transcript } = await sttR.json();
      const userText = transcript?.trim();

      if (!userText) {
        const r = await speak("Sorry, didn't catch that — could you repeat?");
        if (callActive.current) r === 'ended' ? listen() : handleInterrupt(r);
        return;
      }

      addMsg('user', userText);

      // ── END CALL CHECK — real Azure STT transcript, always reliable ──
      if (isEndPhrase(userText)) { handleEndByVoice(); return; }

      // AI
      const aiR = await fetch(`${API_BASE}/web/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.current, text: userText }),
      });
      if (!aiR.ok) throw new Error('AI');
      const { answer } = await aiR.json();
      const reply = answer?.trim() || "I don't have an answer for that right now.";

      addMsg('ai', reply);
      const r = await speak(reply);
      if (!callActive.current) return;
      r === 'ended' ? listen() : handleInterrupt(r);

    } catch (e) {
      console.error('[process]', e);
      const r = await speak("Something went wrong, go ahead.");
      if (callActive.current) r === 'ended' ? listen() : handleInterrupt(r);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // START / END CALL
  // ══════════════════════════════════════════════════════════════════════════
  const startCall = async () => {
    callActive.current = true;
    setMutedB(false);
    setShowBadge('');
    setMode('call');
    setStatus('idle');

    await new Promise(r => setTimeout(r, 150));
    if (!callActive.current) return;

    const ok = await openMic();
    if (!ok) { endCall(); return; }

    startVADLoop();      // master loop — runs whole call
    startKeywordWatch(); // keyword watcher — runs whole call

    addMsg('ai', 'Call connected. How can I help you?');
    const r = await speak('Call connected. How can I help you?');
    if (callActive.current) r === 'ended' ? listen() : handleInterrupt(r);
  };

  // ── Voice-triggered call end — says bye then hangs up ────────────────────
  const handleEndByVoice = async () => {
    if (!callActive.current) return;
    // Stop anything playing/recording immediately
    const cb = onInterruptRef.current;
    onInterruptRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    cb?.('keyword');

    setStatus('speaking');
    // Say a warm goodbye before ending
    const goodbyes = [
      "Sure, take care! Feel free to call again if you need help.",
      "Okay, goodbye! All the best for your admission.",
      "Sure! Bye bye, feel free to call anytime.",
    ];
    const bye = goodbyes[Math.floor(Math.random() * goodbyes.length)];
    addMsg('ai', bye);

    // Speak the goodbye — don't allow interruption here
    try {
      const r = await fetch(`${API_BASE}/api/tts?text=${encodeURIComponent(bye)}`);
      if (r.ok) {
        const blob = await r.blob();
        const url  = URL.createObjectURL(blob);
        const aud  = new Audio(url);
        await new Promise(res => {
          aud.onended = aud.onerror = () => { URL.revokeObjectURL(url); res(); };
          aud.play().catch(res);
        });
      }
    } catch(_) {}

    endCall();
  };

  const endCall = () => {
    killEverything();
    setStatus('ended');
    addMsg('system', '— Call ended —');
    setTimeout(() => { setMode('chat'); setStatus('idle'); }, 400);
  };

  const stopSpeaking = () => {
    const cb = onInterruptRef.current;
    onInterruptRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setShowBadge('paused');
    addMsg('ai', '(paused — go ahead)');
    if (callActive.current) {
      setStatus('idle');
      cb?.('keyword');
      setTimeout(() => { if (callActive.current) listen(); }, 60);
    }
  };

  const killEverything = () => {
    callActive.current     = false;
    onInterruptRef.current = null;

    cancelAnimationFrame(vadAnimRef.current);
    clearTimeout(silTimerRef.current);
    clearTimeout(hangTimerRef.current);
    clearTimeout(bargeTimerRef.current);
    silTimerRef.current   = null;
    hangTimerRef.current  = null;
    bargeTimerRef.current = null;

    stopKeywordWatch();

    try { recorderRef.current?.stop(); } catch(_) {}
    recorderRef.current = null;
    chunksRef.current   = [];

    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    micStream.current?.getTracks().forEach(t => t.stop());
    micStream.current  = null;
    try { micCtx.current?.close(); } catch(_) {}
    micCtx.current     = null;
    micAnalyser.current = null;

    setVadLevel(0);
    setShowBadge('');
  };

  // ══════════════════════════════════════════════════════════════════════════
  // CHAT MODE
  // ══════════════════════════════════════════════════════════════════════════
  const sendChat = async (text) => {
    const t = text?.trim();
    if (!t || chatLoading) return;
    addMsg('user', t);
    setChatInput('');
    setChatLoading(true);
    try {
      const r = await fetch(`${API_BASE}/web/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.current, text: t }),
      });
      const { answer } = await r.json();
      addMsg('ai', answer?.trim() || "Sorry, I don't have an answer right now.");
    } catch {
      addMsg('ai', "Couldn't reach the assistant. Is the server running?");
    } finally {
      setChatLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className={cn('bm', isDarkMode && 'dark')} onClick={e => e.stopPropagation()}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,400&family=Syne:wght@700&display=swap');
        .bm{width:100%;max-width:680px;height:88vh;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;font-family:'DM Sans',sans-serif;background:#f7f6f3;color:#1a1a18;box-shadow:0 28px 72px rgba(0,0,0,.18);}
        .bm.dark{background:#111110;color:#eeede8;}
        .bm-hd{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;background:#fff;border-bottom:1px solid rgba(0,0,0,.07);flex-shrink:0;}
        .dark .bm-hd{background:#1a1917;border-color:rgba(255,255,255,.06);}
        .bm-logo{display:flex;align-items:center;gap:10px;}
        .bm-logo-icon{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:18px;}
        .bm-logo-name{font-family:'Syne',sans-serif;font-size:15px;line-height:1.2;}
        .bm-logo-sub{font-size:11px;opacity:.45;}
        .bm-hd-btns{display:flex;gap:4px;}
        .bm-btn-icon{background:none;border:none;cursor:pointer;color:inherit;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;opacity:.55;transition:opacity .15s,background .15s;font-size:15px;}
        .bm-btn-icon:hover{opacity:1;background:rgba(0,0,0,.06);}
        .dark .bm-btn-icon:hover{background:rgba(255,255,255,.08);}
        .bm-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;}
        .bm-msgs.call{max-height:28vh;flex:none;}
        .bm-msgs::-webkit-scrollbar{width:3px;}
        .bm-msgs::-webkit-scrollbar-thumb{background:rgba(0,0,0,.12);border-radius:2px;}
        .dark .bm-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);}
        .bm-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;opacity:.38;padding:40px;}
        .bm-empty-icon{font-size:38px;}
        .bm-empty-title{font-family:'Syne',sans-serif;font-size:16px;}
        .bm-empty-sub{font-size:13px;line-height:1.5;max-width:260px;}
        .bm-row{display:flex;align-items:flex-end;gap:7px;animation:bm-pop .17s ease;}
        .bm-row.user{flex-direction:row-reverse;}
        @keyframes bm-pop{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        .bm-av{width:26px;height:26px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;}
        .bm-av.user{background:#e4e2de;color:#555;}
        .dark .bm-av.user{background:#2a2927;color:#999;}
        .bm-bub{max-width:74%;padding:9px 13px;border-radius:16px;font-size:14px;line-height:1.55;word-break:break-word;}
        .bm-bub.ai{background:#fff;border:1px solid rgba(0,0,0,.07);border-bottom-left-radius:4px;color:#1a1a18;}
        .dark .bm-bub.ai{background:#1e1d1b;border-color:rgba(255,255,255,.07);color:#eeede8;}
        .bm-bub.user{background:#4f46e5;color:#fff;border-bottom-right-radius:4px;}
        .bm-bub.system{background:transparent;border:none;opacity:.35;font-size:12px;text-align:center;width:100%;padding:2px 0;}
        .bm-input-bar{display:flex;align-items:flex-end;gap:7px;padding:11px 15px;border-top:1px solid rgba(0,0,0,.07);background:#fff;flex-shrink:0;}
        .dark .bm-input-bar{background:#1a1917;border-color:rgba(255,255,255,.06);}
        .bm-ta{flex:1;resize:none;border:1.5px solid rgba(0,0,0,.1);border-radius:12px;padding:8px 13px;font-family:'DM Sans',sans-serif;font-size:14px;line-height:1.5;outline:none;background:#f3f2ef;color:inherit;max-height:110px;transition:border-color .15s;}
        .bm-ta:focus{border-color:#4f46e5;}
        .dark .bm-ta{background:#111110;border-color:rgba(255,255,255,.1);}
        .dark .bm-ta:focus{border-color:#818cf8;}
        .bm-send{width:36px;height:36px;border-radius:10px;background:#4f46e5;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;transition:transform .12s,opacity .15s;}
        .bm-send:disabled{opacity:.35;cursor:not-allowed;}
        .bm-send:not(:disabled):hover{transform:scale(1.07);}
        .bm-call-btn{display:flex;align-items:center;gap:5px;padding:7px 13px;border-radius:10px;background:#16a34a;color:#fff;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;flex-shrink:0;transition:transform .12s;}
        .bm-call-btn:hover{transform:scale(1.04);}
        .bm-dots span{display:inline-block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.4;margin:0 2px;animation:dot 1.2s ease-in-out infinite;}
        .bm-dots span:nth-child(2){animation-delay:.2s}
        .bm-dots span:nth-child(3){animation-delay:.4s}
        @keyframes dot{0%,80%,100%{transform:scale(1);opacity:.4}40%{transform:scale(1.35);opacity:1}}
        .bm-call{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding-bottom:16px;position:relative;overflow:hidden;}
        .bm-call-glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 42%,rgba(79,70,229,.09) 0%,transparent 68%);}
        .dark .bm-call-glow{background:radial-gradient(ellipse at 50% 42%,rgba(129,140,248,.12) 0%,transparent 68%);}
        .bm-call-info{text-align:center;margin-bottom:28px;z-index:1;}
        .bm-call-name{font-family:'Syne',sans-serif;font-size:21px;margin-bottom:3px;}
        .bm-call-stat{font-size:12px;opacity:.45;letter-spacing:.3px;}
        .bm-call-time{font-size:12px;opacity:.35;margin-top:2px;font-variant-numeric:tabular-nums;}
        .bm-badge{display:inline-block;margin-top:5px;font-size:11px;padding:2px 10px;border-radius:10px;background:rgba(234,179,8,.15);color:#a16207;}
        .dark .bm-badge{color:#fbbf24;background:rgba(234,179,8,.12);}
        .bm-ring{position:relative;width:128px;height:128px;display:flex;align-items:center;justify-content:center;z-index:1;margin-bottom:32px;}
        .bm-pulse{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(79,70,229,.3);animation:pulse 1.8s ease-out infinite;}
        .bm-pulse:nth-child(2){animation-delay:.6s}
        .bm-pulse:nth-child(3){animation-delay:1.2s}
        @keyframes pulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.65);opacity:0}}
        .bm-ring.speaking .bm-pulse{border-color:rgba(22,163,74,.4);animation-duration:1.1s;}
        .bm-ring.processing .bm-pulse{border-color:rgba(202,138,4,.4);animation-duration:.85s;}
        .bm-ring.muted .bm-pulse{animation-play-state:paused;opacity:.15;}
        .bm-ring.interrupted .bm-pulse{border-color:rgba(234,179,8,.5);animation-duration:.6s;}
        .bm-ring-center{width:78px;height:78px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 8px 28px rgba(79,70,229,.35);transition:transform .08s,background .3s,box-shadow .3s;position:relative;z-index:2;}
        .bm-ring.speaking .bm-ring-center{background:linear-gradient(135deg,#16a34a,#15803d);box-shadow:0 8px 28px rgba(22,163,74,.35);}
        .bm-ring.processing .bm-ring-center{background:linear-gradient(135deg,#ca8a04,#a16207);box-shadow:0 8px 28px rgba(202,138,4,.3);}
        .bm-ring.muted .bm-ring-center{background:#6b7280;box-shadow:none;}
        .bm-ring.interrupted .bm-ring-center{background:linear-gradient(135deg,#d97706,#b45309);box-shadow:0 8px 28px rgba(217,119,6,.3);}
        .bm-ctrls{display:flex;align-items:center;gap:24px;z-index:1;}
        .bm-ctrl{display:flex;flex-direction:column;align-items:center;gap:5px;background:none;border:none;cursor:pointer;color:inherit;}
        .bm-ctrl-icon{width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:transform .12s;}
        .bm-ctrl:hover .bm-ctrl-icon{transform:scale(1.09);}
        .bm-ctrl-lbl{font-size:11px;opacity:.45;font-family:'DM Sans',sans-serif;}
        .bm-ctrl.mute .bm-ctrl-icon{background:rgba(0,0,0,.08);}
        .dark .bm-ctrl.mute .bm-ctrl-icon{background:rgba(255,255,255,.1);}
        .bm-ctrl.mute.on .bm-ctrl-icon{background:#4f46e5;color:#fff;}
        .bm-ctrl.stop .bm-ctrl-icon{background:rgba(0,0,0,.08);}
        .dark .bm-ctrl.stop .bm-ctrl-icon{background:rgba(255,255,255,.1);}
        .bm-ctrl.end .bm-ctrl-icon{background:#dc2626;color:#fff;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin 1s linear infinite;}
      `}</style>

      {/* HEADER */}
      <div className="bm-hd">
        <div className="bm-logo">
          <div className="bm-logo-icon">🎓</div>
          <div>
            <div className="bm-logo-name">BMSCE AI</div>
            <div className="bm-logo-sub">College Assistant</div>
          </div>
        </div>
        <div className="bm-hd-btns">
          <button className="bm-btn-icon" onClick={toggleDarkMode}>{isDarkMode?'☀️':'🌙'}</button>
          <button className="bm-btn-icon" onClick={onClose}><X size={15}/></button>
        </div>
      </div>

      {/* CHAT */}
      {mode==='chat'&&(<>
        <div className="bm-msgs">
          {messages.length===0?(
            <div className="bm-empty">
              <div className="bm-empty-icon">💬</div>
              <div className="bm-empty-title">Ask me anything about BMSCE</div>
              <div className="bm-empty-sub">Admissions, fees, departments, placements — type or press Call</div>
            </div>
          ):messages.map((m,i)=>{
            if(m.type==='system') return <div key={i} className="bm-bub system">{m.content}</div>;
            return(
              <div key={i} className={cn('bm-row',m.type)}>
                <div className={cn('bm-av',m.type)}>{m.type==='ai'?'🎓':'U'}</div>
                <div className={cn('bm-bub',m.type)}>{m.content}</div>
              </div>
            );
          })}
          {chatLoading&&(
            <div className="bm-row">
              <div className="bm-av">🎓</div>
              <div className="bm-bub ai"><div className="bm-dots"><span/><span/><span/></div></div>
            </div>
          )}
          <div ref={msgEndRef}/>
        </div>
        <div className="bm-input-bar">
          <textarea className="bm-ta" rows={1}
            placeholder="Ask about admissions, fees, placements…"
            value={chatInput} onChange={e=>setChatInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat(chatInput);}}}
            onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,110)+'px';}}
          />
          <button className="bm-send" disabled={!chatInput.trim()||chatLoading} onClick={()=>sendChat(chatInput)}>
            <Send size={14}/>
          </button>
          <button className="bm-call-btn" onClick={startCall}>
            <Phone size={13}/> Call
          </button>
        </div>
      </>)}

      {/* CALL */}
      {mode==='call'&&(<>
        <div className="bm-msgs call">
          {messages.map((m,i)=>{
            if(m.type==='system') return <div key={i} className="bm-bub system">{m.content}</div>;
            return(
              <div key={i} className={cn('bm-row',m.type)}>
                <div className={cn('bm-av',m.type)}>{m.type==='ai'?'🎓':'U'}</div>
                <div className={cn('bm-bub',m.type)}>{m.content}</div>
              </div>
            );
          })}
          <div ref={msgEndRef}/>
        </div>

        <div className="bm-call">
          <div className="bm-call-glow"/>
          <div className="bm-call-info">
            <div className="bm-call-name">BMSCE AI</div>
            <div className="bm-call-stat">
              {callStatus==='listening'  &&'Listening…'}
              {callStatus==='processing' &&'Thinking…'}
              {callStatus==='speaking'   &&'Speaking…'}
              {(callStatus==='idle'||callStatus==='ended')&&'Connected'}
            </div>
            {showBadge==='interrupted'&&<div className="bm-badge">interrupted — go ahead</div>}
            {showBadge==='paused'     &&<div className="bm-badge">paused — go ahead</div>}
            <div className="bm-call-time">{fmt(callDuration)}</div>
          </div>

          <div className={cn('bm-ring',
            callStatus==='speaking'  &&'speaking',
            callStatus==='processing'&&'processing',
            isMuted&&'muted',
            showBadge&&callStatus==='listening'&&'interrupted',
          )}>
            {(callStatus==='listening'||callStatus==='speaking')&&!isMuted&&(<>
              <div className="bm-pulse"/>
              <div className="bm-pulse"/>
              <div className="bm-pulse"/>
            </>)}
            <div className="bm-ring-center" style={{transform:`scale(${1+vadLevel*0.12})`}}>
              {callStatus==='processing'
                ?<Loader2 size={26} className="spin"/>
                :isMuted?<MicOff size={26}/>:<Mic size={26}/>
              }
            </div>
          </div>

          <div className="bm-ctrls">
            <button className={cn('bm-ctrl mute',isMuted&&'on')} onClick={()=>setMutedB(!mutedRef.current)}>
              <div className="bm-ctrl-icon">{isMuted?<MicOff size={19}/>:<Mic size={19}/>}</div>
              <span className="bm-ctrl-lbl">{isMuted?'Unmute':'Mute'}</span>
            </button>
            {callStatus==='speaking'&&(
              <button className="bm-ctrl stop" onClick={stopSpeaking}>
                <div className="bm-ctrl-icon"><Square size={17}/></div>
                <span className="bm-ctrl-lbl">Stop</span>
              </button>
            )}
            <button className="bm-ctrl end" onClick={endCall}>
              <div className="bm-ctrl-icon"><PhoneOff size={21}/></div>
              <span className="bm-ctrl-lbl">End call</span>
            </button>
          </div>
        </div>
      </>)}
    </div>
  );
}