import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Target, BarChart2, LogOut, ChevronRight, LogIn, Flame } from 'lucide-react';
import { auth, googleProvider, db } from '../firebase'; 
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'; 

const Sidebar = () => {
  const [user, setUser] = useState(null);
  const [dailyStats, setDailyStats] = useState({}); 
  const [currentStreak, setCurrentStreak] = useState(0);

  // --- 1. TIMEZONE FIX HELPER ---
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
        const sessionsRef = collection(db, 'users', currentUser.uid, 'sessions');
        const q = query(sessionsRef, orderBy('createdAt', 'desc'));

        const unsubscribeSessions = onSnapshot(q, (snapshot) => {
           const stats = {};
           
           snapshot.docs.forEach(doc => {
              const data = doc.data();
              if (!data.createdAt) return;
              
              const date = getLocalDateKey(data.createdAt.toDate());
              
              if (!stats[date]) stats[date] = 0;
              stats[date] += data.duration || 0;
           });

           setDailyStats(stats);
           calculateStreak(stats);
        });

        return () => unsubscribeSessions();
      } else {
        setDailyStats({});
        setCurrentStreak(0);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const calculateStreak = (stats) => {
    let streak = 0;
    const today = new Date();
    const todayStr = getLocalDateKey(today);
    
    if ((stats[todayStr] || 0) >= 5) {
        streak++;
    }

    for (let i = 1; i < 365; i++) {
        const prevDate = new Date();
        prevDate.setDate(today.getDate() - i);
        const dateStr = getLocalDateKey(prevDate);

        if ((stats[dateStr] || 0) >= 5) {
            streak++;
        } else {
            if (i === 1 && streak === 0) continue; 
            break; 
        }
    }
    setCurrentStreak(streak);
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const navItems = [
    { name: 'Focus', path: '/', icon: <Target size={20} /> },
    { name: 'Analyze', path: '/analyze', icon: <BarChart2 size={20} /> },
  ];

  const renderCalendarDays = () => {
    const days = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(<div key={`empty-${i}`} className="h-6 w-6" />);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
        const dateObj = new Date(currentYear, currentMonth, i);
        const dateStr = getLocalDateKey(dateObj);
        
        const minutes = dailyStats[dateStr] || 0;
        const isActive = minutes >= 5; 
        const isToday = i === today.getDate();
        
        // --- UPDATED STYLING LOGIC ---
        let classes = "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-medium transition-all cursor-default ";
        
        if (isActive) {
            // Active Day (Green)
            classes += "bg-green-500/20 text-green-400 border border-green-500/30 ";
        } else {
            // Inactive Day (Gray)
            classes += "text-gray-600 hover:bg-white/5 ";
        }

        // Today Override (Add White Border)
        if (isToday) {
            classes += "ring-1 ring-white text-white font-bold "; // Replaced bg-white with ring-white
        }

        days.push(
            <div 
                key={i}
                title={`${minutes.toFixed(0)} mins focused`}
                className={classes}
            >
                {i}
            </div>
        );
    }
    return days;
  };

  return (
    <div className="w-72 h-full bg-[#0F131C] border-r border-white/5 flex flex-col p-5 relative overflow-hidden">
      
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />

      {/* 1. Logo */}
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="w-8 h-8 bg-gradient-to-tr from-green-400 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-green-900/20">
            <Target className="text-black" size={18} strokeWidth={3} />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">FlowState</h1>
      </div>

      <nav className="space-y-2 mb-8">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 border border-transparent ${
                isActive 
                  ? 'bg-[#151922] text-green-400 border-white/5 shadow-sm' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <div className="flex items-center gap-3">
                {item.icon}
                <span className="font-medium">{item.name}</span>
            </div>
            <ChevronRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-gray-500" />
          </NavLink>
        ))}
      </nav>

      <div className="px-1">
        <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2">
                <Flame className="text-orange-500 fill-orange-500/20" size={14} />
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Streak</h3>
            </div>
            <span className="text-xs font-bold text-white bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                {currentStreak} <span className="text-sm leading-none">🔥</span>
            </span>
        </div>
        
        <div className="bg-[#151922] border border-white/5 rounded-2xl p-4 shadow-inner">
            <div className="grid grid-cols-7 gap-1">
                {['S','M','T','W','T','F','S'].map(d => (
                    <div key={d} className="text-center text-[9px] text-gray-500 mb-2">{d}</div>
                ))}
                {renderCalendarDays()}
            </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="pt-4 border-t border-white/5">
        {user ? (
          <div className="bg-[#151922] border border-white/5 rounded-xl p-3 flex items-center gap-3 shadow-lg group hover:border-white/10 transition-all">
            <img 
              src={user.photoURL} 
              alt="Profile" 
              className="w-10 h-10 rounded-full border-2 border-[#0F131C]"
            />
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-semibold text-white truncate">{user.displayName}</div>
              <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
            </div>
            <button 
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Sign out"
            >
                <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="w-full relative group overflow-hidden bg-white hover:bg-gray-100 text-gray-900 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-white/5 flex items-center justify-center gap-3"
          >
            <div className="flex items-center justify-center gap-3">
                 <LogIn size={18} className="text-blue-500" />
                 <span>Sign in</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;