import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Settings, CheckSquare, Tag, Volume2, Square, Check, VolumeX, AlertCircle } from 'lucide-react';
import FocusSettings from '../components/FocusSettings';
import TagManager from '../components/TagManager';

// Firebase Imports
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const FINISH_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3";

const Focus = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- 1. INITIALIZE STATE ---
  const [settings, setSettings] = useState(() => {
      const saved = localStorage.getItem('focusSettings');
      return saved ? JSON.parse(saved) : {
          mode: 'timer',
          focusDuration: 25, 
          breakDuration: 5,
          iterations: 1,
          longBreakEnabled: false
      };
  });

  const [isActive, setIsActive] = useState(() => {
      const saved = localStorage.getItem('timerState');
      return saved ? JSON.parse(saved).isActive : false;
  });

  const [timeLeft, setTimeLeft] = useState(() => {
      const saved = localStorage.getItem('timerState');
      if (saved) {
          const { timeLeft, lastUpdated, isActive: wasActive } = JSON.parse(saved);
          if (wasActive) {
              const now = Date.now();
              const elapsedSeconds = Math.floor((now - lastUpdated) / 1000);
              return Math.max(0, timeLeft - elapsedSeconds);
          }
          return timeLeft;
      }
      return settings.focusDuration * 60;
  });

  // State
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  
  // NEW: State for Tag Warning Popup
  const [showTagWarning, setShowTagWarning] = useState(false);

  const tagMenuRef = useRef(null);
  
  const audioRef = useRef(new Audio(FINISH_SOUND_URL));

  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);

  // --- 2. PERSIST STATE ---
  useEffect(() => {
      localStorage.setItem('timerState', JSON.stringify({
          timeLeft,
          isActive,
          lastUpdated: Date.now()
      }));
  }, [timeLeft, isActive]);

  // --- 3. AUTH & SYNC ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.tags) setTags(data.tags);
            if (data.settings) {
                setSettings((prev) => {
                    const newSettings = data.settings;
                    const isAtStart = timeLeft === prev.focusDuration * 60;
                    if (!isActive && isAtStart) {
                        setTimeLeft(newSettings.focusDuration * 60);
                    }
                    return newSettings;
                });
            }
          } else {
            setDoc(userDocRef, { settings, tags }, { merge: true });
          }
        });
        return () => unsubscribeSnapshot();
      } else {
        const savedTags = localStorage.getItem('userTags');
        if (savedTags) setTags(JSON.parse(savedTags));
      }
    });
    return () => unsubscribeAuth();
  }, []); 

  // --- 4. SESSION SAVING LOGIC ---
  const saveSession = async (completed = false) => {
    if (!user) return; 

    const totalSeconds = settings.focusDuration * 60;
    const elapsedSeconds = totalSeconds - timeLeft;
    const durationMinutes = elapsedSeconds / 60;

    if (completed) {
        localStorage.removeItem('timerState');
    }

    if (durationMinutes <= 0) return;

    try {
      await addDoc(collection(db, 'users', user.uid, 'sessions'), {
        createdAt: serverTimestamp(),
        duration: durationMinutes,
        tag: selectedTag || null,
        completed: completed,
        mode: settings.mode
      });
    } catch (e) {
      console.error("Error saving session:", e);
    }
  };

  const updateSettings = async (newSettings) => {
    setSettings(newSettings); 
    if (!isActive) {
        setTimeLeft(newSettings.focusDuration * 60);
    }
    
    if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { settings: newSettings }, { merge: true });
    }
    localStorage.setItem('focusSettings', JSON.stringify(newSettings));
  };

  const updateTags = async (newTags) => {
    setTags(newTags); 
    if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { tags: newTags }, { merge: true });
    }
    localStorage.setItem('userTags', JSON.stringify(newTags));
  };

  // --- 5. TIMER LOGIC ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target)) {
        setShowTagMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      saveSession(true);
      if (soundEnabled) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.log("Audio play blocked", e));
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, soundEnabled]);

  const toggleTimer = () => {
    // --- FORCE TAG SELECTION WITH CUSTOM POPUP ---
    if (!isActive && !selectedTag) {
        setShowTagWarning(true); // Trigger the nice popup
        return; 
    }

    if (timeLeft > 0) setIsActive(!isActive);
  };

  const endSession = () => {
    saveSession(false);
    setIsActive(false);
    setTimeLeft(settings.focusDuration * 60);
    localStorage.removeItem('timerState'); 
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const hasStarted = timeLeft !== settings.focusDuration * 60;

  // --- 6. PROGRESS RING ---
  const radius = 190; 
  const circumference = 2 * Math.PI * radius;
  const totalSeconds = settings.focusDuration * 60;
  const progress = totalSeconds > 0 ? timeLeft / totalSeconds : 0;
  const strokeDashoffset = circumference - (progress * circumference);

  return (
    <div className="h-full w-full relative overflow-hidden flex flex-col items-center justify-center gap-6">
      
      {/* 1. DIGITAL FONT */}
      <style>
        {`
          @import url('https://fonts.cdnfonts.com/css/digital-7-mono');
          .font-digital {
            font-family: 'Digital-7 Mono', monospace;
            font-variant-numeric: tabular-nums; 
          }
        `}
      </style>

      {/* --- CUSTOM WARNING POPUP --- */}
      {showTagWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1E2330] border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center transform scale-100 transition-all">
                <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/20">
                    <Tag className="text-yellow-500" size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Tag Required</h3>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                    Please select a tag to start your session! This helps in tracking your focus distribution accurately.
                </p>
                <button 
                    onClick={() => setShowTagWarning(false)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    Got it
                </button>
            </div>
        </div>
      )}

      {loading && <div className="absolute top-4 right-4 text-xs text-gray-500 animate-pulse">Syncing...</div>}

      <FocusSettings 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        settings={settings}
        updateSettings={updateSettings} 
      />

      <TagManager 
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
        tags={tags}
        setTags={updateTags} 
      />

      {/* Tag Selector */}
      <div className="w-80 relative" ref={tagMenuRef}>
        <button 
          onClick={() => setShowTagMenu(!showTagMenu)}
          className={`w-full bg-[#1E2330] border ${selectedTag ? 'border-white/20' : 'border-white/10'} rounded-xl p-3 flex items-center justify-between transition-all hover:bg-[#252b3b]`}
        >
          <div className="flex items-center gap-3">
            {selectedTag ? (
               <>
                 <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: selectedTag.color, shadowColor: selectedTag.color }} />
                 <span className="text-sm font-medium text-white">{selectedTag.name}</span>
               </>
            ) : (
               <>
                 <Tag size={16} className="text-gray-500" />
                 <span className="text-sm font-medium text-gray-400">Add a tag</span>
               </>
            )}
          </div>
          <span className="text-xs text-gray-500">▼</span>
        </button>

        {showTagMenu && (
          <div className="absolute top-full mt-2 left-0 w-full bg-[#1E2330] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                {tags.length === 0 && <div className="p-4 text-xs text-gray-500 text-center">No tags found</div>}
                {tags.map(tag => (
                    <button 
                        key={tag.id}
                        onClick={() => { setSelectedTag(tag); setShowTagMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                    >
                        <Tag size={14} style={{ color: tag.color }} />
                        <span className="text-sm text-gray-300 flex-1 text-left">{tag.name}</span>
                        {selectedTag?.id === tag.id && <Check size={14} className="text-white" />}
                    </button>
                ))}
            </div>
            
            <button 
                onClick={() => { setShowTagManager(true); setShowTagMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-[#151922] hover:bg-white/5 text-gray-400 hover:text-white transition-colors border-t border-white/10"
            >
                <Settings size={14} />
                <span className="text-xs font-medium">Manage Tags</span>
            </button>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex gap-2 mb-2">
        <div className="w-4 h-4 rounded-full border-2 border-green-500 flex items-center justify-center">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
      </div>

      {/* TIMER CIRCLE */}
      <div className="relative mb-6">
        <div className="w-[400px] h-[400px] rounded-full bg-[#152329] flex items-center justify-center relative shadow-2xl shadow-black/50">
            
            {/* SVG Ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90 transform pointer-events-none" viewBox="0 0 400 400">
              <circle 
                cx="200" cy="200" r={radius} 
                stroke="#1E2330" strokeWidth="2" fill="none" 
              />
              <circle
                cx="200" cy="200" r={radius}
                stroke="#4ADE80" strokeWidth="2"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
                style={{ filter: "drop-shadow(0 0 6px rgba(74, 222, 128, 0.7))" }}
              />
            </svg>

            <div className="text-center z-10">
                <div className="text-[#4ADE80] text-lg font-medium mb-1 tracking-wide">
                    {settings.mode === 'timer' ? 'Focus' : 'Stopwatch'}
                </div>
                
                {/* FIXED FONT SIZE: Always 8xl */}
                <div className="text-8xl text-[#86EFAC] font-digital leading-none pb-4 tracking-widest">
                    {formatTime(timeLeft)}
                </div>

                {selectedTag && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 border border-white/5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedTag.color }}></div>
                        <span className="text-xs text-gray-300">{selectedTag.name}</span>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button 
            onClick={toggleTimer}
            disabled={timeLeft === 0}
            className={`h-12 px-8 rounded-full flex items-center gap-2 font-semibold text-base transition-all shadow-lg 
            ${timeLeft === 0 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-[#379E58] hover:bg-[#2fb563] text-white active:scale-95 shadow-green-900/20'
            }`}
        >
            {isActive ? <Pause fill="white" size={18} /> : <Play fill="white" size={18} />}
            {isActive ? "Pause Session" : "Start Focus Session"}
        </button>

        <div className={`transition-all duration-300 ease-in-out ${hasStarted ? 'w-12 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
             <button 
                onClick={endSession}
                className="h-12 w-12 bg-[#1E2330] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-white/5 transition-all"
                title="End Session"
            >
                <Square size={16} fill="currentColor" />
            </button>
        </div>
      </div>

      {/* Secondary Actions */}
      <div className="flex gap-3 mt-4">
        <ActionButton 
            icon={<Settings size={16} />} 
            label="Configure" 
            onClick={() => setShowSettings(true)} 
        />
        
        <ActionButton 
            icon={soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />} 
            label={soundEnabled ? "Sound On" : "Muted"} 
            onClick={() => setSoundEnabled(!soundEnabled)}
            active={soundEnabled}
        />
        
        <ActionButton icon={<CheckSquare size={16} />} label="Todo" />
      </div>

    </div>
  );
};

const ActionButton = ({ icon, label, onClick, active }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-xs font-medium transition-all
      ${active 
        ? 'bg-green-500/10 border-green-500/30 text-green-400' 
        : 'bg-[#1E2330] border-white/10 text-gray-400 hover:text-white hover:bg-[#252b3b]'
      }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default Focus;