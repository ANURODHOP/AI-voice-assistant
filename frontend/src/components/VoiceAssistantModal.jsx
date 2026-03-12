// src/components/VoiceAssistantModal.jsx
import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

const VoiceAssistantModal = ({ onClose, isDarkMode, toggleDarkMode }) => {
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState([]);
  const [statusText, setStatusText] = useState('Tap the mic to speak');

  // ─── Refs for audio ────────────────────────────────────────────────
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const currentAudioRef = useRef(null);
  const messagesEndRef = useRef(null);

  const sessionId = `session_${Date.now()}`;

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Status text logic
  useEffect(() => {
    if (isLoading) setStatusText('Processing…');
    else if (isListening) setStatusText('Listening… Speak now');
    else if (isSpeaking) setStatusText('Speaking…');
    else setStatusText('Tap the mic to speak');
  }, [isListening, isLoading, isSpeaking]);

  // ─── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      // Important: clean up all audio resources when modal closes
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      // Clean previous
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
      });

      streamRef.current = stream;

      const chunks = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.start(200);

      recorderRef.current = { recorder, chunks };

      setIsListening(true);

      // Silence detection
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);

      const checkVolume = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const volume = Math.sqrt(sum / data.length);

        if (volume < 0.02) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              if (isListening) toggleListening();
            }, 2000);
          }
        } else {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }

        if (isListening) requestAnimationFrame(checkVolume);
      };

      checkVolume();

      return true;
    } catch (err) {
      console.error('[MIC ERROR]', err);
      let msg = 'Microphone access denied or unavailable.';
      if (err.name === 'NotAllowedError') msg = 'Please allow microphone access in your browser.';
      if (err.name === 'NotFoundError') msg = 'No microphone detected on this device.';
      addMessage('ai', msg);
      return false;
    }
  };

  const stopRecording = async () => {
    return new Promise(resolve => {
      if (!recorderRef.current?.recorder) {
        resolve(null);
        return;
      }

      recorderRef.current.recorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }

        const blob = recorderRef.current.chunks.length > 0
          ? new Blob(recorderRef.current.chunks, { type: 'audio/webm' })
          : null;

        recorderRef.current = null;
        resolve(blob);
      };

      recorderRef.current.recorder.stop();
    });
  };

  const toggleListening = async () => {
    if (isLoading || isSpeaking) return;

    if (isListening) {
      setIsListening(false);
      setIsLoading(true);

      const blob = await stopRecording();

      if (!blob || blob.size < 6000) {
        addMessage('ai', "I didn't hear anything. Try speaking louder or closer.");
        setIsLoading(false);
        return;
      }

      await processVoice(blob);
    } else {
      const started = await startRecording();
      if (!started) setIsLoading(false);
    }
  };

  // ─── STT → AI → TTS chain ──────────────────────────────────────────
  const processVoice = async (blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'voice.webm');

      const sttRes = await fetch('http://localhost:3000/api/stt', {
        method: 'POST',
        body: formData,
      });

      if (!sttRes.ok) throw new Error(`STT failed: ${sttRes.status}`);

      const { transcript } = await sttRes.json();
      const text = transcript?.trim();

      if (!text) {
        addMessage('ai', "Sorry, I couldn't understand. Could you repeat?");
        setIsLoading(false);
        return;
      }

      addMessage('user', text);
      await sendToAI(text);
    } catch (err) {
      console.error('Voice processing failed:', err);
      addMessage('ai', 'Speech recognition failed. Is backend running?');
      setIsLoading(false);
    }
  };

  const sendToAI = async (text) => {
    try {
      const res = await fetch('http://localhost:3000/web/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, text }),
      });

      if (!res.ok) throw new Error(`AI failed: ${res.status}`);

      const { answer } = await res.json();
      const reply = answer?.trim() || "Sorry, I don't have an answer right now.";

      addMessage('ai', reply);
      await speak(reply);
    } catch (err) {
      console.error('AI error:', err);
      addMessage('ai', "Couldn't reach the assistant. Server issue?");
      setIsLoading(false);
    }
  };

  const speak = async (text) => {
    try {
      const res = await fetch(
        `http://localhost:3000/api/tts?text=${encodeURIComponent(text)}`
      );

      if (!res.ok) throw new Error('TTS failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      currentAudioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
        setIsLoading(false);
      };

      audio.onended = audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
      };

      await audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      addMessage('ai', "Sorry, I can't speak right now.");
      setIsLoading(false);
    }
  };

  const addMessage = (type, content) => {
    setMessages(prev => [...prev, { type, content }]);
  };

  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
  };

  return (
    <div
      className={cn(
        "w-full max-w-2xl h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden",
        isDarkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
      )}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-800">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🎓</div>
          <div>
            <h2 className="text-xl font-bold">BMSCE Voice AI</h2>
            <p className="text-sm opacity-70">Your College Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="px-4 py-1.5 text-sm font-medium rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 cursor-default select-none"
          >
            English • Hindi
          </span>


          <button onClick={toggleDarkMode} className="text-2xl p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            {isDarkMode ? '☀️' : '🌙'}
          </button>

          <button onClick={onClose} className="text-3xl font-bold opacity-70 hover:opacity-100 px-2">
            ×
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50/70 dark:bg-gray-950/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-7xl mb-6">👋</div>
            <h3 className="text-2xl font-semibold mb-4">Welcome to BMSCE AI</h3>
            <p className="text-lg opacity-80">Tap the microphone and ask anything about college!</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[82%] px-5 py-3.5 rounded-2xl mb-4 shadow-sm",
                msg.type === 'user'
                  ? 'ml-auto bg-indigo-600 text-white rounded-tr-none'
                  : 'mr-auto bg-gray-200 dark:bg-gray-700 rounded-tl-none'
              )}
            >
              {msg.content}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div className="p-6 border-t dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            {/* Pulse rings when listening */}
            {isListening && (
              <>
                <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                <div className="absolute inset-3 rounded-full bg-red-500/20 animate-ping-slow" />
              </>
            )}

            <button
              onClick={toggleListening}
              disabled={isLoading || isSpeaking}
              className={cn(
                "relative z-10 flex h-20 w-20 items-center justify-center rounded-full shadow-2xl transition-transform",
                isListening
                  ? "bg-gradient-to-br from-red-600 to-rose-700 scale-105"
                  : "bg-gradient-to-br from-indigo-600 to-purple-700 hover:scale-110 active:scale-95",
                (isLoading || isSpeaking) && "opacity-70 cursor-not-allowed"
              )}
            >
              {isListening ? (
                <MicOff className="h-10 w-10 text-white" strokeWidth={2.5} />
              ) : isLoading ? (
                <Loader2 className="h-10 w-10 text-white animate-spin" />
              ) : (
                <Mic className="h-10 w-10 text-white" strokeWidth={2.5} />
              )}
            </button>
          </div>

          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="px-5 py-2.5 bg-red-500/10 border border-red-400 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition"
            >
              Stop Speaking
            </button>
          )}

          <p className="text-sm font-medium opacity-75">{statusText}</p>
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistantModal;