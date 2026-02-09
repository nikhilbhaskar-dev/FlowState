import React from 'react';
import { X, Minus, Plus } from 'lucide-react';

const FocusSettings = ({ isOpen, onClose, settings, updateSettings }) => {
  const set = (key, value) => {
    updateSettings({ ...settings, [key]: value });
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-transparent"
          onClick={onClose}
        />
      )}

    
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-[400px] bg-[#0F131C] border-l border-white/5 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        
      
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-xl font-semibold text-white">Focus Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto h-[calc(100vh-80px)]">
          
      
          <div>
            <label className="text-sm text-gray-400 mb-3 block">Timer Type</label>
            <div className="bg-[#1E2330] p-1 rounded-xl flex">
              <button 
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${settings.mode === 'timer' ? 'bg-gray-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                onClick={() => set('mode', 'timer')}
              >
                Timer
              </button>
              <button 
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${settings.mode === 'stopwatch' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                onClick={() => set('mode', 'stopwatch')}
              >
                Stopwatch
              </button>
            </div>
          </div>

          <SettingCard 
            label="Focus Duration" 
            value={settings.focusDuration} 
            setValue={(v) => set('focusDuration', v)}
            color="border-green-500"
            step={5} 
          />

          
          <SettingCard 
            label="Break Duration" 
            subLabel="Regular breaks between focus sessions"
            value={settings.breakDuration} 
            setValue={(v) => set('breakDuration', v)}
            color="border-blue-500"
            step={1}
          />

       
          <SettingCard 
            label="Iterations" 
            value={settings.iterations} 
            setValue={(v) => set('iterations', v)}
            color="border-purple-500"
            step={1}
          />

          <div className="bg-[#1E2330] rounded-xl p-4 border border-white/5 border-l-4 border-l-indigo-500 flex items-center justify-between">
            <div>
              <div className="text-white font-medium">Long Break</div>
              <div className="text-xs text-gray-500 mt-1">Extended breaks every 4 iterations</div>
            </div>
            <button 
              onClick={() => set('longBreakEnabled', !settings.longBreakEnabled)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.longBreakEnabled ? 'bg-indigo-500' : 'bg-gray-700'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.longBreakEnabled ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          <div className="bg-[#151922] rounded-xl p-4 border border-white/5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Total Time:</span>
              <span className="text-white font-medium">
                {settings.focusDuration * settings.iterations + settings.breakDuration * Math.max(0, settings.iterations - 1)} min
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Session Ends:</span>
              <span className="text-white font-medium">
                {new Date(Date.now() + (settings.focusDuration * settings.iterations + settings.breakDuration * Math.max(0, settings.iterations - 1)) * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Session Preview</h3>
            <div className="bg-[#151922] rounded-xl p-4 border border-white/5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-xs font-bold">1</div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-400">Focus</span>
                    <span className="text-xs text-gray-500">{settings.focusDuration}m</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-full rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const SettingCard = ({ label, subLabel, value, setValue, color, step = 1 }) => (
  <div className={`bg-[#1E2330] rounded-xl p-4 border border-white/5 border-l-4 ${color} flex items-center justify-between`}>
    <div>
      <div className="text-white font-medium">{label}</div>
      {subLabel && <div className="text-xs text-gray-500 mt-1">{subLabel}</div>}
    </div>
    
    <div className="flex items-center gap-3 bg-[#151922] rounded-lg p-1 border border-white/5">
      <button 
        onClick={() => setValue(Math.max(0, value - step))}
        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
      >
        <Minus size={14} />
      </button>
      
      <span className="w-8 text-center text-sm font-medium text-white">
        {value}
      </span>
      
      <button 
        onClick={() => setValue(value + step)}
        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  </div>
);

export default FocusSettings;