import React, { useState, useEffect } from 'react';
import { 
  Clock, CheckCircle, Calendar as CalIcon, Flame, Trophy, 
  ChevronLeft, ChevronRight, Activity, Zap, Target, BarChart, Calendar, Tag 
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Link } from 'react-router-dom';

const Analyze = () => {
  const [activeTab, setActiveTab] = useState('Overview');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [allSessions, setAllSessions] = useState([]);

  // Stats
  const [todayStats, setTodayStats] = useState({ minutes: 0, sessions: 0 });
  const [lifetimeStats, setLifetimeStats] = useState({ minutes: 0, sessions: 0, days: 0 });
  const [streakStats, setStreakStats] = useState({ current: 0, best: 0 });
  const [dailyMap, setDailyMap] = useState({}); 
  const [currentDate, setCurrentDate] = useState(new Date()); 

  const [dayStats, setDayStats] = useState({
    totalMinutes: 0, sessions: 0, tagDistribution: [], timelineSessions: [] 
  });

  const [weekStats, setWeekStats] = useState({
    totalMinutes: 0, sessions: 0, prevTotalMinutes: 0, dailyData: [], tagDistribution: [] 
  });

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearStats, setYearStats] = useState({
    totalMinutes: 0, sessions: 0, activeDays: 0, avgSession: 0,
    bestDayMins: 0, bestMonthMins: 0, bestStreak: 0,
    tagDistribution: [], monthlyHeatmap: {} 
  });

  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null, title: '' });

  // --- HELPER: GET LOCAL DATE STRING (YYYY-MM-DD) ---
  const getLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const q = query(collection(db, 'users', currentUser.uid, 'sessions'), orderBy('createdAt', 'desc'));
        const unsubscribeData = onSnapshot(q, (snapshot) => {
          const fetchedSessions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : new Date() 
          }));
          
          setAllSessions(fetchedSessions);
          setLoading(false);
        });
        return () => unsubscribeData();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (allSessions.length > 0 || !loading) {
        processOverviewStats(allSessions);
        processWeekData(allSessions);
        processYearData(allSessions, selectedYear);
        processDayData(allSessions, currentDate);
    }
  }, [allSessions, selectedYear, currentDate, loading]);


  // ==========================================
  // DATA PROCESSING
  // ==========================================

  const processOverviewStats = (data) => {
    const todayStr = getLocalDateKey(new Date()); 
    const map = {};
    let totalMins = 0;
    let todayMins = 0;
    let todayCount = 0;

    data.forEach(session => {
        const dateStr = getLocalDateKey(session.createdAt);
        const mins = session.duration || 0;
        
        if (!map[dateStr]) map[dateStr] = 0;
        map[dateStr] += mins;
        
        totalMins += mins;

        if (dateStr === todayStr) {
            todayMins += mins;
            todayCount += 1;
        }
    });

    setDailyMap(map);
    setTodayStats({ minutes: Math.round(todayMins), sessions: todayCount });
    setLifetimeStats({
        minutes: Math.round(totalMins),
        sessions: data.length,
        days: Object.keys(map).length
    });
    calculateStreaks(map, setStreakStats);
  };

  const processDayData = (data, date) => {
      const startOfDay = new Date(date);
      startOfDay.setHours(0,0,0,0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23,59,59,999);

      const daySessions = data.filter(s => {
          const t = s.createdAt.getTime();
          return t >= startOfDay.getTime() && t <= endOfDay.getTime();
      });

      const totalMins = daySessions.reduce((acc, s) => acc + (s.duration || 0), 0);
      const tagMap = {};
      const timelineData = [];

      daySessions.forEach(s => {
          // --- FIX: ROBUST TAG CHECK ---
          const tagName = s.tag?.name || 'Untagged';
          const tagColor = s.tag?.color || '#3B82F6';
          
          if (!tagMap[tagName]) tagMap[tagName] = { name: tagName, color: tagColor, minutes: 0 };
          tagMap[tagName].minutes += s.duration;

          const startHour = s.createdAt.getHours() + s.createdAt.getMinutes() / 60;
          timelineData.push({
              startHour,
              duration: s.duration, 
              color: tagColor,
              timeLabel: s.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
      });

      setDayStats({
          totalMinutes: Math.round(totalMins),
          sessions: daySessions.length,
          tagDistribution: Object.values(tagMap).sort((a,b) => b.minutes - a.minutes),
          timelineSessions: timelineData
      });
  };

  const processWeekData = (data) => {
    const now = new Date();
    const day = now.getDay(); 
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
    
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfWeek.getDate() - 7);
    const endOfPrevWeek = new Date(endOfWeek);
    endOfPrevWeek.setDate(endOfWeek.getDate() - 7);

    let weekMins = 0;
    let weekSessionsCount = 0;
    let prevWeekMins = 0;
    const tagMap = {};
    const days = [];
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        days.push({
            date: d,
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            minutes: 0,
            sessions: 0
        });
    }

    data.forEach(s => {
        const t = s.createdAt.getTime();
        if (t >= startOfWeek.getTime() && t <= endOfWeek.getTime()) {
            weekMins += s.duration;
            weekSessionsCount += 1;
            
            const dayIndex = s.createdAt.getDay() === 0 ? 6 : s.createdAt.getDay() - 1;
            
            if (days[dayIndex]) {
                days[dayIndex].minutes += s.duration;
                days[dayIndex].sessions += 1;
            }

            // --- FIX: ROBUST TAG CHECK ---
            const tagName = s.tag?.name || 'Untagged';
            const tagColor = s.tag?.color || '#3B82F6';
            
            if (!tagMap[tagName]) tagMap[tagName] = { name: tagName, color: tagColor, minutes: 0 };
            tagMap[tagName].minutes += s.duration;
        }
        if (t >= startOfPrevWeek.getTime() && t <= endOfPrevWeek.getTime()) prevWeekMins += s.duration;
    });

    setWeekStats({
        totalMinutes: Math.round(weekMins),
        sessions: weekSessionsCount,
        prevTotalMinutes: Math.round(prevWeekMins),
        dailyData: days,
        tagDistribution: Object.values(tagMap).sort((a, b) => b.minutes - a.minutes)
    });
  };

  const processYearData = (data, year) => {
      const yearSessions = data.filter(s => s.createdAt.getFullYear() === year);
      const totalMins = yearSessions.reduce((acc, s) => acc + (s.duration || 0), 0);
      const sessionsCount = yearSessions.length;
      
      const dayMap = {}; 
      const monthMap = {}; 
      const tagMap = {};
      
      yearSessions.forEach(s => {
          const dStr = getLocalDateKey(s.createdAt);
          
          if (!dayMap[dStr]) dayMap[dStr] = { minutes: 0, sessions: 0, tags: {} };
          
          dayMap[dStr].minutes += s.duration;
          dayMap[dStr].sessions += 1;

          const m = s.createdAt.getMonth();
          monthMap[m] = (monthMap[m] || 0) + s.duration;

          // --- FIX: ROBUST TAG CHECK ---
          const tagName = s.tag?.name || 'Untagged';
          const tagColor = s.tag?.color || '#3B82F6';

          if (!tagMap[tagName]) tagMap[tagName] = { name: tagName, color: tagColor, minutes: 0 };
          tagMap[tagName].minutes += s.duration;

          if (!dayMap[dStr].tags[tagName]) dayMap[dStr].tags[tagName] = { minutes: 0, color: tagColor };
          dayMap[dStr].tags[tagName].minutes += s.duration;
      });

      const activeDays = Object.keys(dayMap).length;
      const bestDayMins = Math.max(0, ...Object.values(dayMap).map(d => d.minutes));
      const bestMonthMins = Math.max(0, ...Object.values(monthMap));
      const avgSession = sessionsCount > 0 ? totalMins / sessionsCount : 0;
      
      let currentStreak = 0;
      let maxStreak = 0;
      if (Object.keys(dayMap).length > 0) {
          const start = new Date(year, 0, 1);
          const end = new Date(year, 11, 31);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const iso = getLocalDateKey(d);
              const dayData = dayMap[iso];
              if (dayData && dayData.minutes >= 5) {
                  currentStreak++;
                  if (currentStreak > maxStreak) maxStreak = currentStreak;
              } else {
                  currentStreak = 0;
              }
          }
      }

      setYearStats({
          totalMinutes: totalMins,
          sessions: sessionsCount,
          activeDays,
          avgSession,
          bestDayMins,
          bestMonthMins,
          bestStreak: maxStreak,
          tagDistribution: Object.values(tagMap).sort((a, b) => b.minutes - a.minutes),
          monthlyHeatmap: dayMap 
      });
  };

  const calculateStreaks = (map, setFn) => {
    const dates = Object.keys(map).sort(); 
    if (dates.length === 0) return;
    
    let current = 0;
    let best = 0;
    
    let d = new Date();
    while (true) {
        const dStr = getLocalDateKey(d);
        if ((map[dStr] || 0) >= 5) {
            current++;
            d.setDate(d.getDate() - 1);
        } else {
            const todayStr = getLocalDateKey(new Date());
            if (dStr === todayStr && current === 0) {
                 d.setDate(d.getDate() - 1);
                 continue;
            }
            break;
        }
    }

    const activeDays = dates.filter(d => map[d] >= 5).map(d => new Date(d).getTime());
    if (activeDays.length > 0) {
        let count = 1;
        best = 1;
        for (let i = 0; i < activeDays.length - 1; i++) {
            const diffTime = Math.abs(activeDays[i+1] - activeDays[i]);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays === 1) {
                count++;
            } else {
                count = 1;
            }
            if (count > best) best = count;
        }
    }
    setFn({ current, best });
  };

  // --- UI HELPERS ---
  const formatTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };
  
  const formatHours = (mins) => (mins / 60).toFixed(1) + 'h';

  const handleMouseEnter = (e, title, data) => {
    if (!data) return;
    const rect = e.target.getBoundingClientRect();
    setTooltip({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        data: data,
        title: title
    });
  };

  const handleMouseLeave = () => setTooltip({ ...tooltip, visible: false });

  // --- COMPONENTS ---
  const getCalendarDays = () => { 
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    
    for (let i = 0; i < firstDayOfMonth; i++) days.push(<div key={`empty-${i}`} className="h-10 w-10" />);
    
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        const dateStr = getLocalDateKey(d);
        
        const mins = dailyMap[dateStr] || 0;
        let bgClass = 'bg-[#1E2330] text-gray-400 border border-white/5';
        if (mins > 0) bgClass = 'bg-green-900/40 text-green-400 border border-green-500/30';
        if (mins >= 30) bgClass = 'bg-green-600/60 text-white border border-green-400/50';
        if (mins >= 60) bgClass = 'bg-[#4ADE80] text-black font-bold border-none shadow-[0_0_10px_rgba(74,222,128,0.4)]';
        
        const isToday = dateStr === getLocalDateKey(new Date());
        
        days.push(<div key={i} title={`${mins} mins`} className={`h-10 w-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all cursor-default relative ${bgClass} ${isToday ? 'ring-2 ring-white' : ''}`}>{i}</div>);
    }
    return days;
  };

  const getOverviewMonthStats = () => { 
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    let totalMins = 0;
    let daysFocused = 0;
    Object.entries(dailyMap).forEach(([date, mins]) => {
        const d = new Date(date);
        if (d.getFullYear() === year && d.getMonth() === month) {
            totalMins += mins;
            if (mins > 0) daysFocused++;
        }
    });
    return { totalMins, daysFocused };
  };
  const overviewMonthStats = getOverviewMonthStats();

  const DonutChart = ({ data, total, strokeWidth = 32 }) => { 
    if (total === 0) return (<div className="relative w-40 h-40 flex items-center justify-center"><div className="w-full h-full rounded-full border-[12px] border-[#1E2330]" /><span className="absolute text-xs text-gray-500">No data</span></div>);
    let accumulatedPercent = 0;
    const size = 160;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    return (
        <div className="relative flex items-center justify-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                {data.map((item, i) => {
                    const percent = item.minutes / total;
                    const strokeDasharray = `${percent * circumference} ${circumference}`;
                    const strokeDashoffset = -accumulatedPercent * circumference;
                    accumulatedPercent += percent;
                    return (<circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke={item.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />);
                })}
            </svg>
            <div className="absolute text-center"><div className="text-xl font-bold text-white">{formatHours(total)}</div></div>
        </div>
    );
  };

  const MiniMonthGrid = ({ monthIndex, year, dataMap }) => { 
      const firstDay = new Date(year, monthIndex, 1).getDay();
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const days = [];
      for (let i = 0; i < firstDay; i++) days.push(<div key={`e-${i}`} />);
      for (let i = 1; i <= daysInMonth; i++) {
          const d = new Date(year, monthIndex, i);
          const dateStr = getLocalDateKey(d);
          
          const dayData = dataMap[dateStr];
          const mins = dayData?.minutes || 0;
          let colorClass = 'bg-[#1E2330]';
          if (mins > 0) colorClass = 'bg-green-900/60 hover:bg-green-800 transition-colors cursor-pointer';
          if (mins > 30) colorClass = 'bg-green-600 hover:bg-green-500 transition-colors cursor-pointer';
          if (mins > 60) colorClass = 'bg-[#4ADE80] hover:bg-green-300 transition-colors cursor-pointer';
          
          days.push(
            <div 
                key={i} 
                className={`w-3.5 h-3.5 rounded-sm ${colorClass}`} 
                onMouseEnter={(e) => handleMouseEnter(e, d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }), dayData)} 
                onMouseLeave={handleMouseLeave} 
            />
          );
      }
      return (<div className="flex flex-col gap-3 min-w-[80px]"><span className="text-xs text-gray-400 font-medium">{new Date(year, monthIndex).toLocaleString('default', { month: 'short' })}</span><div className="grid grid-cols-7 gap-1.5">{days}</div></div>);
  };


  return (
    <div className="h-full flex flex-col p-8 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar relative">
      
      {/* GLOBAL TOOLTIP */}
      {tooltip.visible && tooltip.data && (
        <div 
            className="fixed z-50 bg-[#0F131C] border border-white/10 rounded-xl shadow-2xl p-4 w-64 pointer-events-none transform -translate-x-1/2 -translate-y-full"
            style={{ top: tooltip.y, left: tooltip.x }}
        >
            <div className="text-sm font-bold text-white mb-3 pb-2 border-b border-white/10">{tooltip.title}</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white/5 rounded-lg p-2 text-center"><div className="text-[10px] text-gray-500 uppercase">Time</div><div className="text-lg font-bold text-blue-400">{formatTime(tooltip.data.minutes)}</div></div>
                <div className="bg-white/5 rounded-lg p-2 text-center"><div className="text-[10px] text-gray-500 uppercase">Sessions</div><div className="text-lg font-bold text-purple-400">{tooltip.data.sessions}</div></div>
            </div>
            {tooltip.data.tags && Object.keys(tooltip.data.tags).length > 0 && (
                <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 uppercase mb-1">By Tag</div>
                    {Object.entries(tooltip.data.tags).map(([tagName, tagData]) => (
                        <div key={tagName} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: tagData.color }}></div><span className="text-gray-300">{tagName}</span></div>
                            <span className="text-gray-500">{formatTime(tagData.minutes)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Analytics</h1>
        </div>
        <div className="bg-[#151922] p-1 rounded-xl inline-flex self-start border border-white/5">
          {['Overview', 'Day', 'Week', 'Year'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-[#1E2330] text-blue-400 shadow-sm border border-blue-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>{tab}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 animate-pulse">Loading data...</div>
      ) : (
        <>
        {/* OVERVIEW */}
        {activeTab === 'Overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-6">
                  <div className="bg-[#151922] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-16 translate-x-16 pointer-events-none"/>
                      <div className="flex items-center gap-2 mb-6"><Clock className="text-blue-400" size={20} /><h3 className="text-lg font-bold text-white">Today's Focus</h3></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 text-center"><div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Focus Time</div><div className="text-2xl font-bold text-blue-400">{formatTime(todayStats.minutes)}</div></div>
                          <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 text-center"><div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Sessions</div><div className="text-2xl font-bold text-indigo-400">{todayStats.sessions}</div></div>
                      </div>
                  </div>
                  <div className="bg-[#151922] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -translate-y-16 translate-x-16 pointer-events-none"/>
                      <div className="flex items-center gap-2 mb-2"><Flame className="text-orange-400" size={20} /><h3 className="text-lg font-bold text-white">Streaks</h3></div>
                      <p className="text-xs text-gray-500 mb-6 flex items-center gap-2"><Activity size={12} />{todayStats.minutes >= 5 ? "Streak active for today!" : `${5 - todayStats.minutes} more mins needed to maintain streak.`}</p>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-4 text-center"><div className="text-orange-500 mb-2 flex justify-center"><Flame size={20} /></div><div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Current</div><div className="text-xl font-bold text-white">{streakStats.current} days</div></div>
                          <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4 text-center"><div className="text-yellow-500 mb-2 flex justify-center"><Trophy size={20} /></div><div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Best</div><div className="text-xl font-bold text-white">{streakStats.best} days</div></div>
                      </div>
                  </div>
              </div>
              <div className="lg:col-span-2 bg-[#151922] border border-white/2 rounded-2xl p-6 flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none"/>
                  <div className="flex items-center justify-between mb-8">
                      <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white"><ChevronLeft size={20} /></button>
                      <h2 className="text-xl font-bold text-white">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                      <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white"><ChevronRight size={20} /></button>
                  </div>
                  <div className="flex-1">
                      <div className="grid grid-cols-7 gap-2 mb-2 text-center">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (<div key={d} className="text-xs font-medium text-gray-500 uppercase tracking-wider">{d}</div>))}</div>
                      <div className="grid grid-cols-7 gap-2 justify-items-center">{getCalendarDays()}</div>
                  </div>
                  <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/5 pt-6">
                       <div className="bg-green-500/5 rounded-lg p-3 text-center border border-green-500/10"><div className="text-xs text-green-400 mb-1">Days Focused</div><div className="text-lg font-bold text-white">{overviewMonthStats.daysFocused} of {new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0).getDate()}</div></div>
                       <div className="bg-green-500/5 rounded-lg p-3 text-center border border-green-500/10"><div className="text-xs text-green-400 mb-1">Total Focus</div><div className="text-lg font-bold text-white">{formatTime(overviewMonthStats.totalMins)}</div></div>
                       <div className="bg-green-500/5 rounded-lg p-3 text-center border border-green-500/10"><div className="text-xs text-green-400 mb-1">Avg / Day</div><div className="text-lg font-bold text-white">{overviewMonthStats.daysFocused > 0 ? formatTime(overviewMonthStats.totalMins / overviewMonthStats.daysFocused) : '0m'}</div></div>
                  </div>
              </div>
            </div>
            <div className="bg-[#151922] border border-white/5 rounded-2xl p-8 relative overflow-hidden">
               <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"/>
               <div className="flex items-center gap-2 mb-2 relative z-10"><Trophy className="text-purple-400" size={20} /><h3 className="text-lg font-bold text-white">Lifetime Focus</h3></div>
               <p className="text-sm text-gray-500 mb-6 relative z-10">Your total focus achievements since you started using FlowState.</p>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                   <div className="bg-[#1E2330] rounded-xl p-6 text-center border-b-4 border-purple-500"><div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-400"><Clock size={20} /></div><div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Focus Time</div><div className="text-2xl font-bold text-white">{formatTime(lifetimeStats.minutes)}</div></div>
                   <div className="bg-[#1E2330] rounded-xl p-6 text-center border-b-4 border-indigo-500"><div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-400"><CheckCircle size={20} /></div><div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Sessions</div><div className="text-2xl font-bold text-white">{lifetimeStats.sessions}</div></div>
                   <div className="bg-[#1E2330] rounded-xl p-6 text-center border-b-4 border-pink-500"><div className="w-10 h-10 bg-pink-500/10 rounded-full flex items-center justify-center mx-auto mb-3 text-pink-400"><CalIcon size={20} /></div><div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Focus Days</div><div className="text-2xl font-bold text-white">{lifetimeStats.days}</div></div>
               </div>
            </div>
          </div>
        )}

        {/* VIEW 2: DAY */}
        {activeTab === 'Day' && (
          <div className="space-y-6">
             <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-white">{currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                    <div className="flex gap-1">
                        <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)))} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"><ChevronLeft size={20}/></button>
                        <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)))} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"><ChevronRight size={20}/></button>
                    </div>
                 </div>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="flex flex-col gap-6">
                     <div className="bg-[#151922] border border-white/5 rounded-2xl p-6 relative">
                         <div className="flex items-center gap-2 mb-6"><Clock className="text-blue-400" size={20} /><h3 className="text-lg font-bold text-white">Focus Time</h3></div>
                         <div className="text-center"><div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Minutes</div><div className="text-4xl font-bold text-white">{formatTime(dayStats.totalMinutes)}</div></div>
                     </div>
                     <div className="bg-[#151922] border border-white/5 rounded-2xl p-6 relative">
                         <div className="flex items-center gap-2 mb-6"><BarChart className="text-blue-400" size={20} /><h3 className="text-lg font-bold text-white">Focus Sessions</h3></div>
                         <div className="text-center"><div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Sessions</div><div className="text-4xl font-bold text-white">{dayStats.sessions}</div></div>
                     </div>
                 </div>
                 <div className="lg:col-span-2 bg-[#151922] border border-white/5 rounded-2xl p-6 flex flex-col">
                     <div className="flex items-center gap-2 mb-6"><Tag className="text-blue-400" size={20} /><h3 className="text-lg font-bold text-white">Focus Time by Tag</h3></div>
                     <div className="text-xs text-gray-400 mb-6">See how you spent your focus time across different tags</div>
                     <div className="flex-1 flex items-center justify-center">
                         {dayStats.tagDistribution.length > 0 ? (
                             <div className="w-full space-y-4">
                                 {dayStats.tagDistribution.map((tag, i) => (
                                     <div key={i} className="flex items-center gap-4"><div className="flex items-center gap-2 w-32"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} /><span className="text-sm text-gray-300 truncate">{tag.name}</span></div><div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(tag.minutes / dayStats.totalMinutes) * 100}%`, backgroundColor: tag.color }} /></div><span className="text-sm font-bold text-white w-16 text-right">{formatTime(tag.minutes)}</span></div>
                                 ))}
                             </div>
                         ) : (<div className="text-center py-12"><Tag size={48} className="mx-auto text-gray-600 mb-4 opacity-50" /><p className="text-gray-400 text-sm">No focus sessions for this day.</p><Link to="/" className="text-blue-400 text-xs hover:underline mt-2 inline-block">Go here to start one →</Link></div>)}
                     </div>
                 </div>
             </div>
             <div className="bg-[#151922] border border-white/5 rounded-2xl p-8">
                 <div className="flex items-center gap-2 mb-8"><Calendar className="text-blue-400" size={20} /><h3 className="text-lg font-bold text-white">Daily Timeline</h3></div>
                 <div className="relative h-24 mt-8">
                     <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 -translate-y-1/2" />
                     {[0, 3, 6, 9, 12, 15, 18, 21, 24].map(hour => (
                         <div key={hour} className="absolute top-1/2 -translate-y-1/2 h-4 w-px bg-white/10" style={{ left: `${(hour / 24) * 100}%` }}><div className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-500">{hour === 0 || hour === 24 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour-12} PM` : `${hour} AM`}</div></div>
                     ))}
                     {dayStats.timelineSessions.map((s, i) => (
                         <div key={i} className="absolute top-1/2 -translate-y-1/2 h-8 rounded-md hover:scale-y-125 transition-transform cursor-pointer group" style={{ left: `${(s.startHour / 24) * 100}%`, width: `${(s.duration / 60 / 24) * 100}%`, backgroundColor: s.color, minWidth: '4px' }}>
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">{s.timeLabel} ({formatTime(s.duration)})</div>
                         </div>
                     ))}
                 </div>
                 <div className="flex justify-center mt-8"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-xs text-gray-500">Sessions</span></div></div>
             </div>
          </div>
        )}

        {/* VIEW 3: WEEK */}
        {activeTab === 'Week' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-[#151922] border border-white/5 rounded-2xl p-8 flex flex-col justify-center relative overflow-hidden">
                    <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4"><h3 className="text-lg font-bold text-white">Weekly Summary</h3></div>
                    <div className="space-y-8">
                        <div><div className="text-sm text-gray-400 mb-1">Focus Time</div><div className="text-4xl font-bold text-white mb-2">{formatTime(weekStats.totalMinutes)}</div><div className="text-xs text-gray-500">Previous: {formatTime(weekStats.prevTotalMinutes)}</div></div>
                        <div><div className="text-sm text-gray-400 mb-1">Sessions</div><div className="text-4xl font-bold text-white">{weekStats.sessions}</div></div>
                    </div>
                </div>
                <div className="lg:col-span-2 bg-[#151922] border border-white/5 rounded-2xl p-8 flex items-center justify-around relative">
                    <DonutChart data={weekStats.tagDistribution} total={weekStats.totalMinutes} />
                    <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                        {weekStats.tagDistribution.map((tag, i) => (
                            <div key={i} className="flex items-center gap-3 min-w-[150px]"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} /><div className="flex-1"><div className="text-sm text-gray-200">{tag.name}</div><div className="text-xs text-gray-500">{formatTime(tag.minutes)}</div></div></div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="bg-[#151922] border border-white/5 rounded-2xl p-8 relative">
                <div className="flex items-center gap-2 mb-6"><BarChart className="text-blue-400" size={20} /><h3 className="text-lg font-bold text-white">Daily Focus Activity</h3></div>
                <div className="h-64 flex items-end justify-between gap-4">
                    {weekStats.dailyData.map((day, i) => {
                        const maxVal = Math.max(120, ...weekStats.dailyData.map(d => d.minutes));
                        const heightPercent = maxVal > 0 ? (day.minutes / maxVal) * 100 : 0;
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-3 h-full justify-end group cursor-pointer">
                                <div 
                                    className="w-full max-w-[40px] bg-[#1E2330] rounded-t-lg relative flex items-end overflow-hidden flex-1 hover:bg-[#252b3b] transition-colors"
                                    onMouseEnter={(e) => handleMouseEnter(e, `${day.dayName}, ${day.dateLabel}`, day)}
                                    onMouseLeave={handleMouseLeave}
                                >
                                    <div className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-500 relative" style={{ height: `${heightPercent}%` }}>
                                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                                <div className="text-center"><div className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">{day.dayName}</div><div className="text-[10px] text-gray-600 group-hover:text-gray-500">{day.dateLabel}</div></div>
                            </div>
                        );
                    })}
                </div>
                <div className="absolute bottom-[3.5rem] left-8 right-8 h-px bg-white/5 -z-10" />
            </div>
          </div>
        )}

        {/* VIEW 4: YEAR */}
        {activeTab === 'Year' && (
          <div className="space-y-6">
             <div className="flex items-center justify-between">
                 <h2 className="text-xl font-bold text-white">Yearly Analytics</h2>
                 <div className="flex items-center gap-2 bg-[#1E2330] rounded-lg p-1 border border-white/10">
                    <button onClick={() => setSelectedYear(y => y-1)} className="p-1 text-gray-400 hover:text-white"><ChevronLeft size={16}/></button>
                    <span className="px-2 text-sm font-bold text-white">{selectedYear}</span>
                    <button onClick={() => setSelectedYear(y => y+1)} className="p-1 text-gray-400 hover:text-white"><ChevronRight size={16}/></button>
                 </div>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-[#151922] border border-white/5 rounded-2xl p-6">
                     <div className="grid grid-cols-2 gap-y-8 gap-x-8">
                        <div className="flex items-center gap-4"><div className="p-3 bg-blue-500/10 rounded-full text-blue-500"><Clock size={20} /></div><div><div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Focus Time</div><div className="text-xl font-bold text-white">{formatHours(yearStats.totalMinutes)}</div></div></div>
                        <div className="flex items-center gap-4"><div className="p-3 bg-purple-500/10 rounded-full text-purple-500"><CheckCircle size={20} /></div><div><div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Sessions</div><div className="text-xl font-bold text-white">{yearStats.sessions}</div></div></div>
                        <div className="flex items-center gap-4"><div className="p-3 bg-green-500/10 rounded-full text-green-500"><Calendar size={20} /></div><div><div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Focus Days</div><div className="text-xl font-bold text-white">{yearStats.activeDays}</div></div></div>
                        <div className="flex items-center gap-4"><div className="p-3 bg-indigo-500/10 rounded-full text-indigo-500"><Trophy size={20} /></div><div><div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Avg Session</div><div className="text-xl font-bold text-white">{formatHours(yearStats.avgSession)}</div></div></div>
                        <div className="flex items-center gap-4"><div className="p-3 bg-yellow-500/10 rounded-full text-yellow-500"><Zap size={20} /></div><div><div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Best Day</div><div className="text-xl font-bold text-white">{formatHours(yearStats.bestDayMins)}</div></div></div>
                        <div className="flex items-center gap-4"><div className="p-3 bg-orange-500/10 rounded-full text-orange-500"><Target size={20} /></div><div><div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Best Month</div><div className="text-xl font-bold text-white">{formatHours(yearStats.bestMonthMins)}</div></div></div>
                        <div className="flex items-center gap-4"><div className="p-3 bg-red-500/10 rounded-full text-red-500"><BarChart size={20} /></div><div><div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Best Week</div><div className="text-xl font-bold text-white">-</div></div></div>
                        <div className="flex items-center gap-4"><div className="p-3 bg-pink-500/10 rounded-full text-pink-500"><Flame size={20} /></div><div><div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Best Streak</div><div className="text-xl font-bold text-white">{yearStats.bestStreak} days</div></div></div>
                     </div>
                 </div>
                 <div className="bg-[#151922] border border-white/5 rounded-2xl p-6 flex items-center justify-around">
                     <DonutChart data={yearStats.tagDistribution} total={yearStats.totalMinutes} strokeWidth={32} />
                     <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                         {yearStats.tagDistribution.length === 0 && <div className="text-sm text-gray-500">No data</div>}
                         {yearStats.tagDistribution.map((tag, i) => (
                             <div key={i} className="flex items-center gap-3 min-w-[120px]"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} /><div className="flex-1"><div className="text-sm text-gray-200">{tag.name}</div><div className="text-xs text-gray-500">{formatHours(tag.minutes)} ({Math.round((tag.minutes/yearStats.totalMinutes)*100)}%)</div></div></div>
                         ))}
                     </div>
                 </div>
             </div>
             <div className="bg-[#151922] border border-white/5 rounded-2xl p-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                     {Array.from({ length: 12 }).map((_, i) => (
                         <div key={i} className="flex justify-center"><MiniMonthGrid monthIndex={i} year={selectedYear} dataMap={yearStats.monthlyHeatmap} /></div>
                     ))}
                 </div>
             </div>
          </div>
        )}
        </>
      )}
    </div>
  );
};

export default Analyze;