// ═══════════════════════════════════════════════════════════════════════
//  FOCUS ENGINE — Application Logic
//  Complete refactored JavaScript with all functionality
// ═══════════════════════════════════════════════════════════════════════

const App = (() => {

  // ─── Constants ─────────────────────────────────────────────────────────
  
  const SUBJECT_COLORS = {
    'Quant':    '#6366f1',
    'LR':       '#f59e0b',
    'AR':       '#10b981',
    'VA':       '#ec4899',
    'Practice': '#8b5cf6',
    'Other':    '#6b7294',
  };

  const QUOTES = [
    "Start small. Momentum beats motivation.",
    "Clarity follows action, not overthinking.",
    "Fog is temporary. Motion clears it.",
    "Consistency compounds silently.",
    "Start before your mind negotiates.",
    "Even a 10-minute session keeps the day alive.",
    "Progress, not perfection — that's the standard.",
    "The work doesn't care how you feel. Do it anyway.",
    "Small progress rebuilds sharpness.",
    "One task at a time. That's how mountains move.",
    "Your effort today is tomorrow's advantage.",
    "A focused hour is worth more than a distracted day.",
    "Resume gently. No pressure.",
    "Finish strong. Even partial completion counts.",
    "Every expert was once a beginner.",
    "Consistent effort, compounding results.",
    "Motion before emotion. Action before clarity.",
    "The hardest part is starting. You're already close.",
    "Day winding down — every completed task counts.",
    "Steady progress — the surest path forward.",
    "Your future self thanks you for today's effort.",
    "Discipline weighs ounces. Regret weighs tons.",
    "You don't need motivation. You need momentum.",
    "Small decisions compound into massive results.",
    "The path appears by walking it.",
    "Results come from repetition, not intensity.",
    "Trust the process. Trust your effort.",
    "Every session is a vote for who you're becoming.",
    "Action is the foundational key to all success.",
    "Start where you are. Use what you have.",
    "Excellence is not a destination. It's a habit.",
    "Your only limit is consistency.",
    "The best time was yesterday. The next best is now.",
    "Slow progress is still progress.",
    "Don't wait for perfect conditions. Start imperfect.",
    "Compound interest applies to knowledge too.",
    "Every pro was once an amateur who didn't quit.",
    "The secret is there is no secret. Just work.",
    "Clarity comes from engagement, not thought.",
    "Your brain will thank you for pushing through fog.",
    "Momentum restores clarity faster than thinking.",
    "The doing is the understanding.",
    "Execution beats strategy every time.",
    "Today's discomfort is tomorrow's strength.",
    "You're one session away from a better day.",
    "The cave you fear to enter holds the treasure.",
    "Mastery is repetition plus reflection.",
    "Your current self is temporary. Keep building.",
    "Results lag behind effort. Trust the lag.",
    "The only bad session is the one you skipped.",
  ];

  const NOTIFICATION_MESSAGES = {
    dailyActivation: [
      "Start small. Momentum restores clarity.",
      "Your targets are waiting. One focused sprint is enough.",
      "Consistency compounds silently.",
      "A fresh day. A fresh start. Begin now.",
    ],
    inactivity: [
      "Even a 10-minute session keeps the day alive.",
      "Resume gently. No pressure.",
      "Pick up where you left off — it's never too late.",
      "The hardest part is starting. You're already close.",
    ],
    brainFog: [
      "Fog is temporary. Motion clears it.",
      "Start before your mind negotiates.",
      "Small progress rebuilds sharpness.",
      "Clarity follows action, not overthinking.",
    ],
    evening: [
      "Day closing soon. One final sprint can still win today.",
      "Finish strong. Even partial completion counts.",
      "Review what you covered today — reinforcement matters.",
      "Day winding down — every completed task counts.",
    ],
    personal: [
      "Quick check — anything you want to wrap up?",
      "You logged pending personal tasks today.",
    ],
  };

  // ─── State ─────────────────────────────────────────────────────────────
  
  let state = {
    days: [],
    tasks: [],
    sessions: [],
    personalTasks: [],
    settings: {
      dayEndTime: '23:00',
      dayStartTime: '06:00',
      notifications: {
        study: false,
        brainFog: false,
        evening: false,
        personal: false,
      },
      sound: true,
      theme: 'focus',
      supabase: null,
    },
    currentDayId: null,
    reassignTaskId: null,
    selectedSubject: null,
    pushSubscription: null,
  };

  let session = {
    active: false,
    paused: false,
    taskId: null,
    subject: '',
    topic: '',
    startTime: null,
    pausedAt: null,
    elapsed: 0,
    timerRef: null,
  };

  let deferredInstallPrompt = null;
  let clockRef = null;

  // ─── LocalStorage ──────────────────────────────────────────────────────
  
  const DB = {
    save() {
      localStorage.setItem('fe_state', JSON.stringify({
        days: state.days,
        tasks: state.tasks,
        sessions: state.sessions,
        personalTasks: state.personalTasks,
        settings: state.settings,
        pushSubscription: state.pushSubscription,
      }));
    },
    load() {
      try {
        const saved = JSON.parse(localStorage.getItem('fe_state') || '{}');
        if (saved.days) state.days = saved.days;
        if (saved.tasks) state.tasks = saved.tasks;
        if (saved.sessions) state.sessions = saved.sessions;
        if (saved.personalTasks) state.personalTasks = saved.personalTasks;
        if (saved.settings) state.settings = Object.assign(state.settings, saved.settings);
        if (saved.pushSubscription) state.pushSubscription = saved.pushSubscription;
      } catch(e) {
        console.warn('DB load failed', e);
      }
    }
  };

  // ─── Supabase Integration (FIXED: Structured Results) ─────────────────
  
  const Supa = {
    client: null,
    
    async init(url, key) {
      if (!url || !key) return { success: false, error: 'Missing credentials' };
      try {
        const { createClient } = await import(`https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm`);
        Supa.client = createClient(url, key);
        return { success: true };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async syncDays() {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { data, error } = await Supa.client
          .from('study_days')
          .select('*')
          .order('created_at');
        
        if (error) throw error;
        
        state.days = data || [];
        DB.save();
        return { success: true, data, count: data?.length || 0 };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async syncTasks() {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { data, error } = await Supa.client
          .from('study_tasks')
          .select('*')
          .order('created_at');
        
        if (error) throw error;
        
        state.tasks = data || [];
        DB.save();
        return { success: true, data, count: data?.length || 0 };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async syncSessions() {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { data, error } = await Supa.client
          .from('focus_sessions')
          .select('*')
          .order('created_at');
        
        if (error) throw error;
        
        state.sessions = data || [];
        DB.save();
        return { success: true, data, count: data?.length || 0 };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async syncPersonalTasks() {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { data, error } = await Supa.client
          .from('personal_tasks')
          .select('*')
          .order('created_at');
        
        if (error) throw error;
        
        state.personalTasks = data || [];
        DB.save();
        return { success: true, data, count: data?.length || 0 };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async insertDay(day) {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { data, error } = await Supa.client
          .from('study_days')
          .insert(day)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async insertTask(task) {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { data, error } = await Supa.client
          .from('study_tasks')
          .insert(task)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async updateTask(id, updates) {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { data, error } = await Supa.client
          .from('study_tasks')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async updateDay(id, updates) {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { data, error } = await Supa.client
          .from('study_days')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async deleteTask(id) {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { error } = await Supa.client
          .from('study_tasks')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        return { success: true };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async deleteDay(id) {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { error } = await Supa.client
          .from('study_days')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        return { success: true };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async insertSession(s) {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { data, error } = await Supa.client
          .from('focus_sessions')
          .insert(s)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async insertPersonalTask(task) {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { data, error } = await Supa.client
          .from('personal_tasks')
          .insert(task)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async updatePersonalTask(id, updates) {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { data, error } = await Supa.client
          .from('personal_tasks')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async deletePersonalTask(id) {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const { error } = await Supa.client
          .from('personal_tasks')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        return { success: true };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
    
    async savePushSubscription(subscription) {
      if (!Supa.client) return { success: false, error: 'Not connected' };
      try {
        const subJson = subscription.toJSON();
        const { endpoint, keys } = subJson;
        
        const { data, error } = await Supa.client
          .from('push_subscriptions')
          .upsert({
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            user_id: 'anonymous',
          }, {
            onConflict: 'endpoint'
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data };
      } catch(err) {
        return { success: false, error: err.message };
      }
    },
  };

  // ─── Utilities ─────────────────────────────────────────────────────────
  
  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : 
      Math.random().toString(36).slice(2) + Date.now();
  }

  // FIXED: Pure local date string
  function todayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function fmtTime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function fmtMins(m) {
    if (m < 60) return `${m}m`;
    const h = Math.floor(m/60), rem = m%60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  }

  function toast(msg, type='') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { 
      el.style.opacity='0'; 
      el.style.transform='translateY(-8px)'; 
      el.style.transition='all 0.3s ease'; 
      setTimeout(()=>el.remove(), 300); 
    }, 2800);
  }

  function openSheet(id) {
    document.getElementById('sheetBackdrop').classList.add('active');
    document.getElementById(id).classList.add('active');
  }

  function closeSheet() {
    document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active'));
    document.getElementById('sheetBackdrop').classList.remove('active');
    state.currentDayId = null;
    state.reassignTaskId = null;
  }

  // ─── Tab Switching ─────────────────────────────────────────────────────
  
  function switchTab(name, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    if (btn) btn.classList.add('active');
    
    if (name === 'home')     renderHome();
    if (name === 'plan')     renderPlan();
    if (name === 'backlog')  renderBacklog();
    if (name === 'progress') renderProgress();
    if (name === 'personal') renderPersonal();
    if (name === 'settings') renderSettings();
    
    document.getElementById('tabContent').scrollTop = 0;
  }

  // ─── Clock & Ring ──────────────────────────────────────────────────────
  
  function startClock() {
    updateClock();
    clearInterval(clockRef);
    clockRef = setInterval(updateClock, 1000);
  }

  function updateClock() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();

    document.getElementById('liveTime').textContent =
      `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

    document.getElementById('liveDate').textContent =
      now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });

    const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('greeting').textContent = g;

    const [eh, em] = (state.settings.dayEndTime || '23:00').split(':').map(Number);
    const [sh, sm] = (state.settings.dayStartTime || '06:00').split(':').map(Number);
    const endSecs   = eh * 3600 + em * 60;
    const startSecs = sh * 3600 + sm * 60;
    const nowSecs   = h * 3600 + m * 60 + now.getSeconds();

    let remaining = endSecs - nowSecs;
    if (remaining < 0) remaining = 0;

    const totalDay = endSecs - startSecs;
    const progress = Math.max(0, Math.min(1, 1 - remaining / totalDay));

    const circumference = 2 * Math.PI * 74;
    const ring = document.getElementById('ringProgress');
    ring.setAttribute('stroke-dasharray', circumference);
    ring.setAttribute('stroke-dashoffset', circumference * (1 - progress));

    const hue = Math.round(240 - progress * 160);
    ring.style.stroke = `hsl(${hue}, 80%, 65%)`;

    const remH = Math.floor(remaining / 3600);
    const remM = Math.floor((remaining % 3600) / 60);
    document.getElementById('ringValue').textContent = `${remH}h ${remM}m`;
    document.getElementById('ringEnd').textContent = `ends at ${state.settings.dayEndTime}`;
  }

  // ─── Motivational Quote Engine ─────────────────────────────────────────
  
  function loadRandomQuote() {
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    document.getElementById('quoteText').textContent = quote;
  }

  // ─── Home Rendering ────────────────────────────────────────────────────
  
  function renderHome() {
    const today = todayStr();
    const todayDay = state.days.find(d => d.date === today);
    const label = todayDay ? todayDay.label : 'No plan for today';
    document.getElementById('todayDayLabel').textContent = label;

    const todayTasks = todayDay
      ? state.tasks.filter(t => t.day_id === todayDay.id)
      : [];

    const total = todayTasks.length;
    const done  = todayTasks.filter(t => t.status === 'completed').length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

    document.getElementById('completionPct').textContent  = `${pct}%`;
    document.getElementById('completionFill').style.width = `${pct}%`;
    document.getElementById('completionStat').textContent = `${done} / ${total} tasks`;

    const subjectMap = {};
    todayTasks.forEach(t => {
      if (!subjectMap[t.subject]) subjectMap[t.subject] = { tasks: [], done: 0, total: 0 };
      subjectMap[t.subject].tasks.push(t);
      subjectMap[t.subject].total += t.estimated_minutes || 0;
      if (t.status === 'completed') subjectMap[t.subject].done += t.estimated_minutes || 0;
    });

    const list = document.getElementById('subjectList');

    if (Object.keys(subjectMap).length === 0) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">
          <svg width="24" height="24" fill="none" stroke="#5a5a7a" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
        </div>
        <div class="empty-title">No tasks for today</div>
        <div class="empty-sub">Head to Plan tab to set up today's study targets.</div>
      </div>`;
      return;
    }

    list.innerHTML = Object.entries(subjectMap).map(([subj, data]) => {
      const color = SUBJECT_COLORS[subj] || SUBJECT_COLORS.Other;
      const topics = data.tasks.map(t => t.topic).join(', ');
      const remaining = data.total - data.done;
      const pct = data.total > 0 ? (data.done / data.total) * 100 : 0;
      const allDone = remaining <= 0;

      return `<div class="subject-card">
        <div class="subject-card-top">
          <div class="subject-info">
            <div class="subject-name-row">
              <div class="subject-dot" style="background:${color}"></div>
              <div>
                <div class="subject-name">${subj}</div>
                <div class="subject-topics">${topics}</div>
              </div>
            </div>
          </div>
          <div class="subject-time ${allDone ? 'done' : ''}">
            ${allDone ? '✓ Done' : fmtMins(remaining)}
          </div>
        </div>
        <div class="subject-progress">
          <div class="subject-progress-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
    }).join('');
  }

  // ─── Plan Rendering ────────────────────────────────────────────────────
  
  function renderPlan() {
    const list = document.getElementById('daysList');
    if (state.days.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">
          <svg width="24" height="24" fill="none" stroke="#5a5a7a" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
        </div>
        <div class="empty-title">Plan is empty</div>
        <div class="empty-sub">Add study days or import a CSV plan to get started.</div>
      </div>`;
      return;
    }

    list.innerHTML = state.days.map((day, idx) => {
      const tasks = state.tasks.filter(t => t.day_id === day.id);
      const done  = tasks.filter(t => t.status === 'completed').length;
      const today = day.date === todayStr();

      return `<div class="day-card" id="daycard-${day.id}">
        <div class="day-card-header" onclick="App.toggleDayCard('${day.id}')">
          <div class="day-number-badge">${day.label || `Day ${idx+1}`}</div>
          <div class="day-info">
            <div class="day-label" contenteditable="false" data-day-id="${day.id}" data-field="label">${day.label}${today ? ' <span class="badge badge-indigo">Today</span>' : ''}</div>
            <div class="day-meta">${day.date || 'No date'} · ${tasks.length} tasks · ${done}/${tasks.length} done</div>
          </div>
          <div class="day-actions" onclick="event.stopPropagation()">
            <button class="btn-icon-sm" onclick="App.toggleEditDay('${day.id}')" title="Edit day label">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon-sm" onclick="App.deleteDay('${day.id}')" title="Delete day" style="color:var(--rose)">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
          <svg class="day-chevron" viewBox="0 0 24 24"><polyline points="9,18 15,12 9,6"/></svg>
        </div>
        <div class="day-tasks">
          ${tasks.map(task => renderTaskRow(task)).join('')}
          <div class="day-add-task" onclick="App.openAddTask('${day.id}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            Add task
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function renderTaskRow(task) {
    const color = SUBJECT_COLORS[task.subject] || SUBJECT_COLORS.Other;
    const done  = task.status === 'completed';
    return `<div class="task-item" data-task-id="${task.id}">
      <div class="task-check ${done ? 'done' : ''}" onclick="App.toggleTask('${task.id}')">
        ${done ? '<svg width="12" height="12" fill="none" stroke="white" stroke-width="3" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>' : ''}
      </div>
      <div class="task-info">
        <div class="task-subject" style="color:${color}">${task.subject}</div>
        <div class="task-topic" contenteditable="false" data-field="topic">${task.topic}</div>
      </div>
      <div class="task-time" contenteditable="false" data-field="minutes">${fmtMins(task.estimated_minutes || 0)}</div>
      <div class="task-actions">
        <button class="task-edit-btn" onclick="App.toggleEditTask('${task.id}')" title="Edit">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="task-delete" onclick="App.deleteTask('${task.id}')" title="Delete">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>`;
  }

  function toggleDayCard(dayId) {
    const card = document.getElementById(`daycard-${dayId}`);
    if (card) card.classList.toggle('expanded');
  }

  // ─── Backlog Rendering ─────────────────────────────────────────────────
  
  function renderBacklog() {
    const today = todayStr();
    const pending = state.tasks.filter(t => {
      if (t.status === 'completed') return false;
      const day = state.days.find(d => d.id === t.day_id);
      if (!day || !day.date) return false;
      return day.date < today;
    });

    document.getElementById('backlogCount').textContent = pending.length;
    const totalMins = pending.reduce((a, t) => a + (t.estimated_minutes || 0), 0);
    document.getElementById('backlogMins').textContent = totalMins;

    const daysOld = pending.reduce((max, t) => {
      const day = state.days.find(d => d.id === t.day_id);
      if (!day || !day.date) return max;
      const diff = Math.floor((new Date(today) - new Date(day.date)) / 86400000);
      return Math.max(max, diff);
    }, 0);
    document.getElementById('backlogDays').textContent = daysOld;

    const list = document.getElementById('pendingList');
    if (pending.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">
          <svg width="24" height="24" fill="none" stroke="#5a5a7a" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div class="empty-title">All clear</div>
        <div class="empty-sub">No pending units. Your flow is uninterrupted.</div>
      </div>`;
      return;
    }

    list.innerHTML = pending.map(t => {
      const color = SUBJECT_COLORS[t.subject] || SUBJECT_COLORS.Other;
      const day = state.days.find(d => d.id === t.day_id);
      return `<div class="pending-item">
        <div class="pending-dot" style="background:${color}"></div>
        <div class="pending-info">
          <div class="pending-subject" style="color:${color}">${t.subject}</div>
          <div class="pending-topic">${t.topic}</div>
          <div class="pending-origin">From ${day ? day.label : 'Unknown'}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <div class="pending-time">${fmtMins(t.estimated_minutes || 0)}</div>
          <button class="btn-reassign" onclick="App.openReassign('${t.id}')">Move</button>
        </div>
      </div>`;
    }).join('');
  }

  // ─── Progress Rendering ────────────────────────────────────────────────
  
  function renderProgress() {
    const today = new Date();
    const last7 = Array.from({length:7}, (_,i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6-i));
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    });

    const recent = state.sessions.filter(s => last7.includes(s.session_date));

    const activeDays = new Set(recent.map(s => s.session_date)).size;
    const consistency = Math.round((activeDays / 7) * 100);

    const totalSecs = recent.reduce((a,s) => a + (s.duration_seconds||0), 0);
    const totalMins = Math.floor(totalSecs / 60);

    document.getElementById('metricConsistency').textContent = `${consistency}%`;
    document.getElementById('metricConsistencySub').textContent = `${activeDays} of 7 days`;
    document.getElementById('metricTotal').textContent = totalMins >= 60 ? `${Math.floor(totalMins/60)}h` : `${totalMins}m`;
    document.getElementById('metricSessions').textContent = recent.length;
    document.getElementById('metricAvg').textContent = activeDays > 0 ? `${Math.round(totalMins/activeDays)}m` : '0m';

    const weekBars = document.getElementById('weekBars');
    weekBars.innerHTML = last7.map((date, i) => {
      const dayMins = state.sessions
        .filter(s => s.session_date === date)
        .reduce((a,s) => a + Math.floor((s.duration_seconds||0)/60), 0);
      const maxMins = 240;
      const pct = Math.min(100, Math.round((dayMins / maxMins) * 100));
      const d = new Date(date);
      const label = ['S','M','T','W','T','F','S'][d.getDay()];
      const isToday = date === todayStr();
      return `<div class="week-day-col">
        <div class="week-bar">
          <div class="week-bar-fill" style="height:${pct}%;${isToday?'background:linear-gradient(180deg,#f59e0b,rgba(245,158,11,0.5))':''}"></div>
        </div>
        <div class="week-day-label" style="${isToday?'color:var(--indigo);font-weight:600':''}">${label}</div>
      </div>`;
    }).join('');

    const subjectSecs = {};
    recent.forEach(s => {
      subjectSecs[s.subject] = (subjectSecs[s.subject]||0) + (s.duration_seconds||0);
    });

    const totalSubSecs = Object.values(subjectSecs).reduce((a,b)=>a+b, 0);
    const subDist = document.getElementById('subjectDist');

    if (totalSubSecs === 0) {
      subDist.innerHTML = '<div style="font-size:13px;color:var(--text-3);text-align:center;padding:10px 0">No sessions yet</div>';
    } else {
      subDist.innerHTML = Object.entries(subjectSecs)
        .sort(([,a],[,b]) => b-a)
        .map(([subj, secs]) => {
          const color = SUBJECT_COLORS[subj] || SUBJECT_COLORS.Other;
          const pct = Math.round((secs / totalSubSecs) * 100);
          return `<div class="dist-row">
            <div class="dist-subject">${subj}</div>
            <div class="dist-bar-wrap">
              <div class="dist-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <div class="dist-pct">${pct}%</div>
          </div>`;
        }).join('');
    }

    const enc = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    document.getElementById('encourageText').textContent = enc;

    const from = new Date(last7[0]).toLocaleDateString('en-IN', {day:'numeric',month:'short'});
    const to   = new Date(last7[6]).toLocaleDateString('en-IN', {day:'numeric',month:'short'});
    document.getElementById('progressRange').textContent = `${from} – ${to}`;
  }

  const ENCOURAGEMENTS = QUOTES;

  // ─── Personal Tasks Rendering ──────────────────────────────────────────
  
  function renderPersonal() {
    const list = document.getElementById('personalList');
    
    if (state.personalTasks.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">
          <svg width="24" height="24" fill="none" stroke="#5a5a7a" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
        </div>
        <div class="empty-title">No personal tasks</div>
        <div class="empty-sub">Add quick notes and to-dos here.</div>
      </div>`;
      return;
    }

    list.innerHTML = state.personalTasks.map(task => `
      <div class="personal-item">
        <div class="personal-check ${task.completed ? 'done' : ''}" onclick="App.togglePersonalTask('${task.id}')">
          ${task.completed ? '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>' : ''}
        </div>
        <div class="personal-text ${task.completed ? 'done' : ''}">${task.text}</div>
        <button class="personal-delete" onclick="App.deletePersonalTask('${task.id}')">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </button>
      </div>
    `).join('');
  }

  // ─── Settings Rendering ────────────────────────────────────────────────
  
  function renderSettings() {
    document.getElementById('settingEndTime').value   = state.settings.dayEndTime;
    document.getElementById('settingStartTime').value = state.settings.dayStartTime;

    const n = state.settings.notifications;
    setToggleState('toggleStudyNotif',    n.study);
    setToggleState('toggleBrainFog',      n.brainFog);
    setToggleState('toggleEvening',       n.evening);
    setToggleState('togglePersonalNotif', n.personal);
    setToggleState('toggleSound',         state.settings.sound);

    document.querySelectorAll('.theme-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.theme === state.settings.theme);
    });

    const sc = state.settings.supabase || {};
    if (sc.url) document.getElementById('sbUrl').value = sc.url;
  }

  function setToggleState(id, on) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', !!on);
  }

  // ─── Task Management ───────────────────────────────────────────────────
  
  function openAddTask(dayId) {
    state.currentDayId = dayId;
    state.selectedSubject = null;
    document.querySelectorAll('.subj-chip').forEach(c => c.classList.remove('active'));
    document.getElementById('inputTaskTopic').value = '';
    document.getElementById('inputTaskMins').value  = '';
    openSheet('sheetAddTask');
  }

  function selectSubject(btn) {
    document.querySelectorAll('.subj-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    state.selectedSubject = btn.dataset.subj;
  }

  function saveTask() {
    if (!state.currentDayId) { toast('No day selected','error'); return; }
    const subj  = state.selectedSubject;
    const topic = document.getElementById('inputTaskTopic').value.trim();
    const mins  = parseInt(document.getElementById('inputTaskMins').value) || 0;

    if (!subj)  { toast('Pick a subject', 'error'); return; }
    if (!topic) { toast('Enter a topic', 'error');  return; }

    const task = {
      id: uid(), day_id: state.currentDayId,
      subject: subj, topic, estimated_minutes: mins,
      status: 'pending', created_at: new Date().toISOString()
    };

    state.tasks.push(task);
    DB.save();
    Supa.insertTask(task);
    closeSheet();
    renderPlan();
    renderHome();
    toast('Task added', 'success');
  }

  function toggleTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    task.status = task.status === 'completed' ? 'pending' : 'completed';
    DB.save();
    Supa.updateTask(taskId, { status: task.status });
    renderPlan();
    renderHome();
  }

  function deleteTask(taskId) {
    if (!confirm('Delete this task?')) return;
    
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    DB.save();
    Supa.deleteTask(taskId);
    renderPlan();
    renderHome();
    renderBacklog();
    toast('Task removed');
  }

  function toggleEditTask(taskId) {
    const taskItem = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!taskItem) return;

    const topicEl = taskItem.querySelector('[data-field="topic"]');
    const minsEl  = taskItem.querySelector('[data-field="minutes"]');
    const editBtn = taskItem.querySelector('.task-edit-btn');

    const isEditing = topicEl.getAttribute('contenteditable') === 'true';

    if (isEditing) {
      const newTopic = topicEl.textContent.trim();
      const minsText = minsEl.textContent.trim();
      
      let newMins = 0;
      const hMatch = minsText.match(/(\d+)h/);
      const mMatch = minsText.match(/(\d+)m/);
      if (hMatch) newMins += parseInt(hMatch[1]) * 60;
      if (mMatch) newMins += parseInt(mMatch[1]);
      
      if (!newTopic || newMins <= 0) {
        toast('Invalid task data', 'error');
        return;
      }

      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        task.topic = newTopic;
        task.estimated_minutes = newMins;
        DB.save();
        Supa.updateTask(taskId, { topic: newTopic, estimated_minutes: newMins });
        toast('Task updated', 'success');
      }

      topicEl.setAttribute('contenteditable', 'false');
      minsEl.setAttribute('contenteditable', 'false');
      editBtn.classList.remove('editing');
      
      renderPlan();
      renderHome();
      renderBacklog();
    } else {
      topicEl.setAttribute('contenteditable', 'true');
      minsEl.setAttribute('contenteditable', 'true');
      editBtn.classList.add('editing');
      topicEl.focus();
      
      minsEl.addEventListener('focus', () => {
        const range = document.createRange();
        range.selectNodeContents(minsEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }, { once: true });
    }
  }

  // ─── Day Management ────────────────────────────────────────────────────
  
  function saveDay() {
    const label = document.getElementById('inputDayLabel').value.trim();
    const date  = document.getElementById('inputDayDate').value;
    if (!label) { toast('Enter a label', 'error'); return; }

    const day = { id: uid(), label, date: date || null, created_at: new Date().toISOString() };
    state.days.push(day);
    DB.save();
    Supa.insertDay(day);
    closeSheet();
    renderPlan();
    renderHome();
    toast('Day added', 'success');
  }

  function toggleEditDay(dayId) {
    const labelEl = document.querySelector(`[data-day-id="${dayId}"][data-field="label"]`);
    if (!labelEl) return;

    const isEditing = labelEl.getAttribute('contenteditable') === 'true';

    if (isEditing) {
      const newLabel = labelEl.textContent.trim();
      if (!newLabel) {
        toast('Day label cannot be empty', 'error');
        return;
      }

      const day = state.days.find(d => d.id === dayId);
      if (day) {
        day.label = newLabel;
        DB.save();
        Supa.updateDay(dayId, { label: newLabel });
        toast('Day label updated', 'success');
      }

      labelEl.setAttribute('contenteditable', 'false');
      renderPlan();
      renderHome();
    } else {
      const badgeEl = labelEl.querySelector('.badge');
      if (badgeEl) badgeEl.remove();
      
      labelEl.setAttribute('contenteditable', 'true');
      labelEl.focus();
      
      const range = document.createRange();
      range.selectNodeContents(labelEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function deleteDay(dayId) {
    const day = state.days.find(d => d.id === dayId);
    if (!day) return;

    const tasksCount = state.tasks.filter(t => t.day_id === dayId).length;
    
    if (!confirm(`Delete "${day.label}" and ${tasksCount} task(s)?`)) return;

    state.tasks = state.tasks.filter(t => t.day_id !== dayId);
    state.days = state.days.filter(d => d.id !== dayId);
    
    DB.save();
    Supa.deleteDay(dayId);
    
    renderPlan();
    renderHome();
    renderBacklog();
    toast('Day deleted', 'success');
  }

  // ─── Backlog Operations ────────────────────────────────────────────────
  
  function openReassign(taskId) {
    state.reassignTaskId = taskId;
    const container = document.getElementById('reassignDayList');
    container.innerHTML = state.days.map(day => {
      return `<div class="session-pick-item" onclick="App.reassignTask('${day.id}')">
        <div class="pick-info">
          <div class="pick-subj">${day.label}</div>
          <div style="font-size:12px;color:var(--text-3)">${day.date || 'No date'}</div>
        </div>
      </div>`;
    }).join('') || '<div style="padding:16px;color:var(--text-3);font-size:13px">No days available</div>';
    openSheet('sheetReassign');
  }

  function reassignTask(dayId) {
    const task = state.tasks.find(t => t.id === state.reassignTaskId);
    if (task) {
      task.day_id = dayId;
      DB.save();
      Supa.updateTask(task.id, { day_id: dayId });
    }
    closeSheet();
    renderBacklog();
    renderHome();
    toast('Task moved', 'success');
  }

  // ─── Focus Session ─────────────────────────────────────────────────────
  
  function startSessionFlow() {
    const today = todayStr();
    const todayDay = state.days.find(d => d.date === today);
    const pending = todayDay
      ? state.tasks.filter(t => t.day_id === todayDay.id && t.status === 'pending')
      : [];

    const backlog = state.tasks.filter(t => {
      if (t.status === 'completed') return false;
      const day = state.days.find(d => d.id === t.day_id);
      return day && day.date && day.date < today;
    });

    const allAvailable = [...pending, ...backlog];

    if (allAvailable.length === 0) {
      toast('No pending tasks — great job!', 'success');
      return;
    }

    const list = document.getElementById('sessionSubjectList');
    list.innerHTML = allAvailable.map(t => {
      const color = SUBJECT_COLORS[t.subject] || SUBJECT_COLORS.Other;
      const day = state.days.find(d => d.id === t.day_id);
      return `<div class="session-pick-item" onclick="App.startSession('${t.id}')">
        <div class="pick-dot" style="background:${color}"></div>
        <div class="pick-info">
          <div class="pick-subj" style="color:${color}">${t.subject}</div>
          <div class="pick-topic">${t.topic}</div>
          ${day && day.date !== today ? `<div style="font-size:11px;color:var(--text-3)">From ${day.label}</div>` : ''}
        </div>
        <div class="pick-time">${fmtMins(t.estimated_minutes||0)}</div>
      </div>`;
    }).join('');
    openSheet('sheetSessionPicker');
  }

  function startSession(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    closeSheet();

    session.active    = true;
    session.paused    = false;
    session.taskId    = taskId;
    session.subject   = task.subject;
    session.topic     = task.topic;
    session.startTime = Date.now();
    session.elapsed   = 0;

    document.getElementById('sessionSubject').textContent = task.subject;
    document.getElementById('sessionTopic').textContent   = task.topic;
    document.getElementById('sessionTimer').textContent   = '00:00';
    document.getElementById('sessionStatus').textContent  = 'RUNNING';
    document.getElementById('btnPauseSession').textContent = 'Pause';
    document.getElementById('sessionOverlay').classList.add('active');

    session.timerRef = setInterval(tickSession, 1000);
  }

  function tickSession() {
    if (!session.active || session.paused) return;
    session.elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    document.getElementById('sessionTimer').textContent = fmtTime(session.elapsed);
  }

  function pauseSession() {
    if (!session.active) return;
    if (!session.paused) {
      session.paused  = true;
      session.pausedAt = Date.now();
      document.getElementById('btnPauseSession').textContent = 'Resume';
      document.getElementById('sessionStatus').textContent  = 'PAUSED';
    } else {
      const pausedDuration = Date.now() - session.pausedAt;
      session.startTime += pausedDuration;
      session.paused   = false;
      session.pausedAt = null;
      document.getElementById('btnPauseSession').textContent = 'Pause';
      document.getElementById('sessionStatus').textContent  = 'RUNNING';
    }
  }

  function endSession() {
    if (!session.active) return;
    clearInterval(session.timerRef);

    const finalElapsed = session.elapsed;
    document.getElementById('sessionOverlay').classList.remove('active');

    if (finalElapsed < 10) {
      session.active = false;
      return;
    }

    const record = {
      id: uid(),
      subject: session.subject,
      topic: session.topic,
      duration_seconds: finalElapsed,
      session_date: todayStr(),
      created_at: new Date().toISOString(),
    };

    state.sessions.push(record);

    const task = state.tasks.find(t => t.id === session.taskId);
    if (task) {
      const sesMins = Math.floor(finalElapsed / 60);
      if (sesMins >= (task.estimated_minutes || 0) * 0.8) {
        task.status = 'completed';
        Supa.updateTask(task.id, { status: 'completed' });
      }
    }

    DB.save();
    Supa.insertSession(record);
    session.active = false;

    renderHome();
    renderProgress();
    renderBacklog();

    toast(`Session saved — ${fmtTime(finalElapsed)} focused`, 'success');

    if (state.settings.sound) playEndTone();
  }

  function playEndTone() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 528;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start(); osc.stop(ctx.currentTime + 1.2);
    } catch(e) {}
  }

  // ─── CSV Import (FIXED: Date Logic) ───────────────────────────────────
  
  async function handleCSVImport(file) {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
      toast('Please select a valid CSV file', 'error');
      return;
    }

    const proc = document.getElementById('csvProcessing');
    proc.classList.add('active');
    document.getElementById('csvStatus').textContent = 'Reading CSV…';

    try {
      const text = await file.text();
      document.getElementById('csvStatus').textContent = 'Parsing data…';
      
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_')
      });

      if (parsed.errors.length > 0) {
        proc.classList.remove('active');
        toast('CSV parsing error — check file format', 'error');
        return;
      }

      const rows = parsed.data;
      if (rows.length === 0) {
        proc.classList.remove('active');
        toast('CSV file is empty', 'error');
        return;
      }

      const requiredCols = ['day', 'subject', 'topic', 'estimated_minutes'];
      const firstRow = rows[0];
      const missing = requiredCols.filter(col => !(col in firstRow));
      
      if (missing.length > 0) {
        proc.classList.remove('active');
        toast(`Missing columns: ${missing.join(', ')}`, 'error');
        return;
      }

      document.getElementById('csvStatus').textContent = 'Validating data…';

      const errors = [];
      rows.forEach((row, idx) => {
        if (!row.day || !row.subject || !row.topic) {
          errors.push(`Row ${idx + 2}: Missing required field`);
        }
        const mins = parseInt(row.estimated_minutes);
        if (isNaN(mins) || mins <= 0) {
          errors.push(`Row ${idx + 2}: Invalid estimated_minutes`);
        }
      });

      if (errors.length > 0) {
        proc.classList.remove('active');
        toast('Validation failed', 'error');
        console.error('CSV errors:', errors);
        return;
      }

      document.getElementById('csvStatus').textContent = 'Importing schedule…';

      const dayGroups = {};
      rows.forEach(row => {
        const dayKey = row.day.trim();
        if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
        dayGroups[dayKey].push(row);
      });

      // FIXED: Pure local date calculation
      const baseDate = new Date();
      const dayKeys = Object.keys(dayGroups);
      
      let addedDays = 0, addedTasks = 0;

      for (let i = 0; i < dayKeys.length; i++) {
        const dayKey = dayKeys[i];
        const dayTasks = dayGroups[dayKey];
        
        // FIXED: Explicit local date construction
        const localDate = new Date();
        localDate.setDate(baseDate.getDate() + i);
        
        const y = localDate.getFullYear();
        const m = String(localDate.getMonth() + 1).padStart(2, '0');
        const d = String(localDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        const day = {
          id: uid(),
          label: dayKey,
          date: dateStr,
          created_at: new Date().toISOString()
        };

        state.days.push(day);
        const result = await Supa.insertDay(day);
        if (result.success) addedDays++;

        for (const row of dayTasks) {
          const task = {
            id: uid(),
            day_id: day.id,
            subject: row.subject.trim(),
            topic: row.topic.trim(),
            estimated_minutes: parseInt(row.estimated_minutes),
            status: 'pending',
            created_at: new Date().toISOString()
          };
          state.tasks.push(task);
          const taskResult = await Supa.insertTask(task);
          if (taskResult.success) addedTasks++;
        }
      }

      DB.save();
      proc.classList.remove('active');
      renderPlan();
      renderHome();
      toast(`Imported ${addedDays} days, ${addedTasks} tasks`, 'success');

    } catch (err) {
      console.error('CSV import error:', err);
      proc.classList.remove('active');
      toast('Import failed — check file format', 'error');
    }
  }

  // ─── Personal Tasks ────────────────────────────────────────────────────
  
  function addPersonalTask() {
    const input = document.getElementById('personalInput');
    const text = input.value.trim();
    
    if (!text) return;

    const task = {
      id: uid(),
      text,
      completed: false,
      date: todayStr(),
      created_at: new Date().toISOString(),
    };

    state.personalTasks.push(task);
    DB.save();
    Supa.insertPersonalTask(task);
    
    input.value = '';
    renderPersonal();
    toast('Personal task added');
  }

  function togglePersonalTask(id) {
    const task = state.personalTasks.find(t => t.id === id);
    if (!task) return;
    
    task.completed = !task.completed;
    DB.save();
    Supa.updatePersonalTask(id, { completed: task.completed });
    renderPersonal();
  }

  function deletePersonalTask(id) {
    if (!confirm('Delete this personal task?')) return;
    
    state.personalTasks = state.personalTasks.filter(t => t.id !== id);
    DB.save();
    Supa.deletePersonalTask(id);
    renderPersonal();
  }

  // ─── Push Notifications ────────────────────────────────────────────────
  
  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      toast('Notifications not supported', 'error');
      return false;
    }

    if (Notification.permission === 'granted') return true;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  async function subscribeToPushNotifications() {
    try {
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        toast('Notification permission denied', 'error');
        return { success: false, error: 'Permission denied' };
      }

      const registration = await navigator.serviceWorker.ready;
      
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        const vapidPublicKey = state.settings.supabase?.vapidPublicKey || '';
        
        if (!vapidPublicKey) {
          console.warn('VAPID key not configured');
          return { success: false, error: 'VAPID key not configured' };
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const result = await Supa.savePushSubscription(subscription);
      
      if (result.success) {
        state.pushSubscription = subscription.toJSON();
        DB.save();
        return { success: true, subscription };
      }

      return result;

    } catch (err) {
      console.error('Push subscription error:', err);
      return { success: false, error: err.message };
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // ─── Settings ──────────────────────────────────────────────────────────
  
  function toggleSetting(el) {
    el.classList.toggle('on');
    const id = el.id;
    const on = el.classList.contains('on');
    
    if (id === 'toggleStudyNotif')    state.settings.notifications.study = on;
    if (id === 'toggleBrainFog')      state.settings.notifications.brainFog = on;
    if (id === 'toggleEvening')       state.settings.notifications.evening = on;
    if (id === 'togglePersonalNotif') state.settings.notifications.personal = on;
    if (id === 'toggleSound')         state.settings.sound = on;
    
    DB.save();

    if (on && id !== 'toggleSound') {
      subscribeToPushNotifications();
    }
  }

  function setTheme(theme, btn) {
    state.settings.theme = theme;
    document.querySelectorAll('.theme-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.documentElement.dataset.theme = theme;
    DB.save();
  }

  async function saveSupabaseConfig() {
    const url = document.getElementById('sbUrl').value.trim();
    const key = document.getElementById('sbKey').value.trim();
    
    if (!url || !key) {
      showSupabaseStatus('Enter both URL and key', 'error');
      return;
    }

    showSupabaseStatus('Connecting...', 'info');

    const initResult = await Supa.init(url, key);
    
    if (!initResult.success) {
      showSupabaseStatus(`Connection failed: ${initResult.error}`, 'error');
      return;
    }

    state.settings.supabase = { url, key };
    DB.save();

    showSupabaseStatus('Connected! Syncing data...', 'info');

    const [daysResult, tasksResult, sessionsResult, personalResult] = await Promise.all([
      Supa.syncDays(),
      Supa.syncTasks(),
      Supa.syncSessions(),
      Supa.syncPersonalTasks(),
    ]);

    const totalSynced = 
      (daysResult.count || 0) + 
      (tasksResult.count || 0) + 
      (sessionsResult.count || 0) +
      (personalResult.count || 0);

    if (totalSynced === 0) {
      showSupabaseStatus('Already Synced', 'info');
    } else {
      showSupabaseStatus(`Sync Successful — ${totalSynced} items synced`, 'success');
    }

    renderHome();
    renderPlan();
    renderProgress();
    renderPersonal();
  }

  function showSupabaseStatus(message, type) {
    const statusEl = document.getElementById('supabaseStatus');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `supabase-status ${type}`;
    statusEl.style.display = 'block';
  }

  function handleInstall() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(c => {
        if (c.outcome === 'accepted') toast('App installed!', 'success');
        deferredInstallPrompt = null;
      });
    } else {
      toast('Open in Chrome and use "Add to Home Screen" from the menu', '');
    }
  }

  function clearData() {
    if (!confirm('Clear all local data? This cannot be undone.')) return;
    state.days = []; 
    state.tasks = []; 
    state.sessions = [];
    state.personalTasks = [];
    DB.save();
    renderHome(); 
    renderPlan(); 
    renderBacklog(); 
    renderProgress();
    renderPersonal();
    toast('Data cleared');
  }

  // ─── Init ──────────────────────────────────────────────────────────────
  
  function init() {
    DB.load();

    if (state.settings.theme) {
      document.documentElement.dataset.theme = state.settings.theme;
    }

    startClock();
    loadRandomQuote();
    renderHome();
    renderProgress();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(() => console.log('[FE] SW registered'))
        .catch(err => console.warn('[FE] SW error', err));
    }

    // Event bindings
    document.getElementById('btnStartSession').addEventListener('click', startSessionFlow);
    document.getElementById('btnEndSession').addEventListener('click', endSession);
    document.getElementById('btnPauseSession').addEventListener('click', pauseSession);
    
    document.getElementById('btnAddDay').addEventListener('click', () => {
      document.getElementById('inputDayLabel').value = '';
      document.getElementById('inputDayDate').value = todayStr();
      openSheet('sheetAddDay');
    });

    // FIXED: Home tab plus button
    document.getElementById('btnDayLabel').addEventListener('click', () => {
      const today = todayStr();
      const todayDay = state.days.find(d => d.date === today);
      if (todayDay) {
        toast('Today\'s plan is already set', 'info');
      } else {
        document.getElementById('inputDayDate').value = today;
        openSheet('sheetAddDay');
      }
    });

    document.getElementById('btnImportCSV').addEventListener('click', () => {
      document.getElementById('csvFileInput').click();
    });

    document.getElementById('csvFileInput').addEventListener('change', e => {
      if (e.target.files[0]) handleCSVImport(e.target.files[0]);
      e.target.value = '';
    });

    document.getElementById('btnAddPersonal').addEventListener('click', addPersonalTask);
    document.getElementById('personalInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') addPersonalTask();
    });

    document.getElementById('btnInstall').addEventListener('click', handleInstall);
    document.getElementById('btnClearData').addEventListener('click', clearData);

    ['settingEndTime', 'settingStartTime'].forEach(id => {
      document.getElementById(id).addEventListener('change', e => {
        if (id === 'settingEndTime')   state.settings.dayEndTime   = e.target.value;
        if (id === 'settingStartTime') state.settings.dayStartTime = e.target.value;
        DB.save();
      });
    });

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstallPrompt = e;
    });

    trySupabaseInit();
  }

  async function trySupabaseInit() {
    const sc = state.settings.supabase;
    if (sc && sc.url && sc.key) {
      const result = await Supa.init(sc.url, sc.key);
      if (result.success) {
        showSupabaseStatus('Reconnected to Supabase', 'success');
        Supa.syncDays();
        Supa.syncTasks();
        Supa.syncSessions();
        Supa.syncPersonalTasks();
      }
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────
  
  return {
    init,
    switchTab,
    toggleDayCard,
    openAddTask,
    selectSubject,
    saveTask,
    saveDay,
    toggleTask,
    deleteTask,
    deleteDay,
    toggleEditTask,
    toggleEditDay,
    startSession,
    startSessionFlow,
    pauseSession,
    endSession,
    openReassign,
    reassignTask,
    toggleSetting,
    setTheme,
    saveSupabaseConfig,
    clearData,
    handleInstall,
    closeSheet,
    addPersonalTask,
    togglePersonalTask,
    deletePersonalTask,
  };

})();

// ─── Boot ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', App.init);
