const { useState, useEffect, useCallback } = React;

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TodoApp = () => {
  const [currentUser, setCurrentUser] = useState(() => {
    return localStorage.getItem('hurley-tasks-user') || null;
  });
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [addingTaskTo, setAddingTaskTo] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [toast, setToast] = useState(null);
  const [syncStatus, setSyncStatus] = useState('syncing');
  const [loading, setLoading] = useState(true);
  const [userNameInput, setUserNameInput] = useState('');

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setSyncStatus('syncing');
      
      const [projectsRes, tasksRes] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: true }),
        supabase.from('tasks').select('*').order('created_at', { ascending: true })
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (tasksRes.error) throw tasksRes.error;

      setProjects(projectsRes.data || []);
      setTasks(tasksRes.data || []);
      setSyncStatus('online');
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setSyncStatus('offline');
      setLoading(false);
    }
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!currentUser) return;

    fetchData();

    // Subscribe to projects changes
    const projectsChannel = supabase
      .channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setProjects(prev => [...prev, payload.new]);
          if (payload.new.added_by !== currentUser) {
            showToast(`📁 ${payload.new.added_by} created "${payload.new.name}"`);
          }
        } else if (payload.eventType === 'UPDATE') {
          setProjects(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));
        } else if (payload.eventType === 'DELETE') {
          setProjects(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();

    // Subscribe to tasks changes
    const tasksChannel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTasks(prev => [...prev, payload.new]);
          if (payload.new.added_by !== currentUser) {
            showToast(`✨ ${payload.new.added_by} added a new task`);
          }
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(projectsChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [currentUser, fetchData]);

  const statusConfig = {
    active: { label: 'To Do', color: '#64748b', bg: '#f1f5f9', icon: '○' },
    priority: { label: 'Priority', color: '#dc2626', bg: '#fef2f2', icon: '🔥' },
    review: { label: 'Awaiting Review', color: '#6b7280', bg: '#f3f4f6', icon: '⏳' },
    done: { label: 'Done', color: '#16a34a', bg: '#f0fdf4', icon: '✓' }
  };

  const reviewers = ['Verma', 'Thor', 'Jerome'];

  const handleLogin = () => {
    if (!userNameInput.trim()) return;
    const name = userNameInput.trim();
    localStorage.setItem('hurley-tasks-user', name);
    setCurrentUser(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('hurley-tasks-user');
    setCurrentUser(null);
    setProjects([]);
    setTasks([]);
  };

  const toggleProject = async (projectId) => {
    if (editingProjectId === projectId) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    setProjects(projects.map(p => 
      p.id === projectId ? { ...p, expanded: !p.expanded } : p
    ));

    await supabase
      .from('projects')
      .update({ expanded: !project.expanded })
      .eq('id', projectId);
  };

  const startEditingProject = (project) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  const saveProjectName = async (projectId) => {
    if (!editingProjectName.trim()) {
      setEditingProjectId(null);
      return;
    }

    setProjects(projects.map(p => 
      p.id === projectId ? { ...p, name: editingProjectName.trim() } : p
    ));
    setEditingProjectId(null);

    await supabase
      .from('projects')
      .update({ name: editingProjectName.trim() })
      .eq('id', projectId);
  };

  const cycleStatus = async (projectId, taskId) => {
    const statusOrder = ['active', 'priority', 'review', 'done'];
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const currentIndex = statusOrder.indexOf(task.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    const updates = { 
      status: nextStatus,
      reviewer: nextStatus === 'review' ? 'Verma' : task.reviewer
    };

    setTasks(tasks.map(t => t.id === taskId ? { ...t, ...updates } : t));

    await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId);
  };

  const updateTaskNotes = async (taskId, notes) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, notes } : t));

    await supabase
      .from('tasks')
      .update({ notes })
      .eq('id', taskId);
  };

  const updateTaskReviewer = async (taskId, reviewer) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, reviewer } : t));

    await supabase
      .from('tasks')
      .update({ reviewer })
      .eq('id', taskId);
  };

  const addProject = async () => {
    if (!newProjectName.trim()) return;

    const newProject = {
      name: newProjectName,
      expanded: true,
      archived: false,
      added_by: currentUser
    };

    setNewProjectName('');

    const { data, error } = await supabase
      .from('projects')
      .insert([newProject])
      .select()
      .single();

    if (error) {
      console.error('Error adding project:', error);
      showToast('❌ Failed to add project');
    }
  };

  const addTask = async (projectId) => {
    if (!newTaskText.trim()) return;

    const newTask = {
      project_id: projectId,
      text: newTaskText,
      status: 'active',
      notes: '',
      added_by: currentUser,
      reviewer: null
    };

    setNewTaskText('');
    setAddingTaskTo(null);

    const { data, error } = await supabase
      .from('tasks')
      .insert([newTask])
      .select()
      .single();

    if (error) {
      console.error('Error adding task:', error);
      showToast('❌ Failed to add task');
    }
  };

  const deleteTask = async (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    if (selectedTask?.id === taskId) setSelectedTask(null);

    await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
  };

  const archiveProject = async (projectId) => {
    setProjects(projects.map(p => 
      p.id === projectId ? { ...p, archived: true, expanded: false } : p
    ));
    if (selectedTask?.project_id === projectId) setSelectedTask(null);

    await supabase
      .from('projects')
      .update({ archived: true, expanded: false })
      .eq('id', projectId);
  };

  const restoreProject = async (projectId) => {
    setProjects(projects.map(p => 
      p.id === projectId ? { ...p, archived: false } : p
    ));

    await supabase
      .from('projects')
      .update({ archived: false })
      .eq('id', projectId);
  };

  const deleteProject = async (projectId) => {
    if (!window.confirm('Permanently delete this project and all its tasks? This cannot be undone.')) return;

    setProjects(projects.filter(p => p.id !== projectId));
    setTasks(tasks.filter(t => t.project_id !== projectId));
    if (selectedTask?.project_id === projectId) setSelectedTask(null);

    await supabase.from('tasks').delete().eq('project_id', projectId);
    await supabase.from('projects').delete().eq('id', projectId);
  };

  const getProjectTasks = (projectId) => {
    return tasks.filter(t => t.project_id === projectId);
  };

  const getSelectedTaskData = () => {
    if (!selectedTask) return null;
    const task = tasks.find(t => t.id === selectedTask.id);
    if (!task) return null;
    const project = projects.find(p => p.id === task.project_id);
    return task ? { ...task, projectName: project?.name || 'Unknown' } : null;
  };

  const taskData = getSelectedTaskData();
  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);
  const displayedProjects = activeTab === 'active' ? activeProjects : archivedProjects;

  // Login screen
  if (!currentUser) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <h1 style={{
            fontFamily: "'Fredoka', sans-serif",
            fontSize: '32px',
            fontWeight: '600',
            color: '#1e293b',
            margin: '0 0 8px 0',
            textAlign: 'center'
          }}>
            ✨ Hurley's Tasks
          </h1>
          <p style={{
            color: '#64748b',
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            Enter your name to get started
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '700',
              color: '#64748b',
              marginBottom: '8px'
            }}>
              Your Name
            </label>
            <input
              className="input-field"
              style={{ width: '100%' }}
              placeholder="e.g., Hurley, Verma, Thor, Jerome..."
              value={userNameInput}
              onChange={(e) => setUserNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
          </div>

          <button 
            className="add-btn" 
            style={{ width: '100%', padding: '14px' }}
            onClick={handleLogin}
          >
            Enter Tasks →
          </button>

          <p style={{
            color: '#94a3b8',
            fontSize: '13px',
            textAlign: 'center',
            marginTop: '24px'
          }}>
            Everyone on your team sees the same tasks in real-time
          </p>
        </div>
      </div>
    );
  }

  // Loading screen
  if (loading) {
    return (
      <div className="setup-screen">
        <div className="setup-card" style={{ textAlign: 'center' }}>
          <h1 style={{
            fontFamily: "'Fredoka', sans-serif",
            fontSize: '32px',
            fontWeight: '600',
            color: '#1e293b',
            margin: '0 0 8px 0'
          }}>
            ✨ Hurley's Tasks
          </h1>
          <div className="loading-spinner"></div>
          <p style={{ color: '#64748b' }}>Loading your tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fdf6e3 0%, #fff8e7 50%, #f5f0e1 100%)',
      padding: '24px',
      display: 'flex',
      gap: '24px'
    }} className="main-container">
      {/* Main Content */}
      <div style={{ flex: 1, maxWidth: '700px' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h1 style={{
              fontFamily: "'Fredoka', sans-serif",
              fontSize: '42px',
              fontWeight: '600',
              color: '#1e293b',
              margin: '0',
              letterSpacing: '-1px'
            }}>
              ✨ Hurley's Tasks
            </h1>
            <span className="user-pill">
              👤 {currentUser}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className={`sync-indicator ${syncStatus}`}>
              <span className="pulse"></span>
              {syncStatus === 'online' ? 'Live' : syncStatus === 'syncing' ? 'Syncing...' : 'Offline'}
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid #e2e8f0',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#64748b',
                cursor: 'pointer'
              }}
            >
              Switch User
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '2px solid #e8e0d0'
        }}>
          <button 
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active ({activeProjects.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'archived' ? 'active' : ''}`}
            onClick={() => setActiveTab('archived')}
          >
            📦 Archived ({archivedProjects.length})
          </button>
        </div>

        {/* Status Legend */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          {Object.entries(statusConfig).map(([key, config]) => (
            <div key={key} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: config.bg,
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              color: config.color
            }}>
              <span>{config.icon}</span>
              <span>{config.label}</span>
            </div>
          ))}
        </div>

        {/* Add Project (only on active tab) */}
        {activeTab === 'active' && (
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '24px'
          }}>
            <input
              className="input-field"
              placeholder="New project name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addProject()}
            />
            <button className="add-btn" onClick={addProject}>
              + Project
            </button>
          </div>
        )}

        {/* Projects */}
        {displayedProjects.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#94a3b8'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {activeTab === 'active' ? '🚀' : '📦'}
            </div>
            <p style={{ margin: 0, fontWeight: '500' }}>
              {activeTab === 'active' 
                ? 'No active projects. Create one above!' 
                : 'No archived projects yet.'}
            </p>
          </div>
        ) : (
          displayedProjects.map(project => {
            const projectTasks = getProjectTasks(project.id);
            return (
              <div key={project.id} className={`project-card ${project.archived ? 'archived' : ''}`}>
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: project.expanded ? '12px' : '0'
                  }}
                >
                  <span 
                    onClick={() => toggleProject(project.id)}
                    style={{
                      fontSize: '20px',
                      transition: 'transform 0.2s ease',
                      transform: project.expanded ? 'rotate(90deg)' : 'rotate(0)',
                      cursor: 'pointer'
                    }}>▸</span>
                  
                  {editingProjectId === project.id ? (
                    <input
                      className="input-field"
                      style={{
                        flex: 1,
                        fontFamily: "'Fredoka', sans-serif",
                        fontSize: '20px',
                        fontWeight: '500',
                        padding: '4px 12px'
                      }}
                      value={editingProjectName}
                      onChange={(e) => setEditingProjectName(e.target.value)}
                      onBlur={() => saveProjectName(project.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveProjectName(project.id);
                        if (e.key === 'Escape') setEditingProjectId(null);
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <h2 
                      onClick={() => toggleProject(project.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!project.archived) startEditingProject(project);
                      }}
                      style={{
                        fontFamily: "'Fredoka', sans-serif",
                        fontSize: '20px',
                        fontWeight: '500',
                        color: '#334155',
                        margin: 0,
                        flex: 1,
                        cursor: 'pointer'
                      }}
                      title={project.archived ? '' : 'Double-click to rename'}
                    >
                      {project.name}
                      {project.archived && (
                        <span style={{
                          marginLeft: '10px',
                          fontSize: '12px',
                          color: '#9ca3af',
                          fontWeight: '400'
                        }}>archived</span>
                      )}
                    </h2>
                  )}

                  <span className="badge" style={{
                    background: '#e0f2fe',
                    color: '#0284c7'
                  }}>
                    {projectTasks.filter(t => t.status !== 'done').length} remaining
                  </span>
                  
                  {project.archived ? (
                    <>
                      <button
                        className="restore-btn"
                        onClick={() => restoreProject(project.id)}
                        title="Restore project"
                      >
                        ↩️ Restore
                      </button>
                      <button
                        className="archive-btn"
                        onClick={() => deleteProject(project.id)}
                        title="Delete permanently"
                        style={{ color: '#ef4444' }}
                      >
                        🗑️
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="archive-btn"
                        onClick={() => startEditingProject(project)}
                        title="Rename project"
                        style={{ fontSize: '14px' }}
                      >
                        ✏️
                      </button>
                      <button
                        className="archive-btn"
                        onClick={() => archiveProject(project.id)}
                        title="Archive project"
                      >
                        📦
                      </button>
                    </>
                  )}
                </div>

                {project.expanded && (
                  <>
                    {projectTasks.map(task => (
                      <div
                        key={task.id}
                        className="task-item"
                        style={{
                          background: statusConfig[task.status].bg,
                          border: `2px solid ${task.status === 'priority' ? '#fecaca' : 'transparent'}`,
                          opacity: task.status === 'done' ? 0.7 : 1
                        }}
                        onClick={() => setSelectedTask({ id: task.id, project_id: project.id })}
                      >
                        <button
                          className="status-btn"
                          style={{
                            background: task.status === 'done' 
                              ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                              : task.status === 'priority'
                              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                              : task.status === 'review'
                              ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                              : '#e2e8f0',
                            color: task.status === 'active' ? '#64748b' : 'white'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!project.archived) cycleStatus(project.id, task.id);
                          }}
                          disabled={project.archived}
                        >
                          {statusConfig[task.status].icon}
                        </button>
                        
                        <span style={{
                          flex: 1,
                          fontSize: '15px',
                          fontWeight: '500',
                          color: task.status === 'done' ? '#64748b' : '#334155',
                          textDecoration: task.status === 'done' ? 'line-through' : 'none'
                        }}>
                          {task.text}
                          {task.added_by && task.added_by !== 'Hurley' && (
                            <span className="external-badge">from {task.added_by}</span>
                          )}
                        </span>

                        {task.status === 'review' && !project.archived && (
                          <select
                            className="reviewer-select"
                            value={task.reviewer || 'Verma'}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateTaskReviewer(task.id, e.target.value)}
                          >
                            {reviewers.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        )}

                        {task.notes && (
                          <span style={{ fontSize: '16px' }} title="Has notes">📝</span>
                        )}

                        {!project.archived && (
                          <button
                            className="delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTask(task.id);
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add Task (only for non-archived) */}
                    {!project.archived && (
                      addingTaskTo === project.id ? (
                        <div style={{
                          display: 'flex',
                          gap: '10px',
                          marginTop: '12px',
                          padding: '0 4px'
                        }}>
                          <input
                            className="input-field"
                            placeholder="What needs to be done?"
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addTask(project.id)}
                            autoFocus
                          />
                          <button className="add-btn" onClick={() => addTask(project.id)}>
                            Add
                          </button>
                          <button 
                            className="cancel-btn"
                            onClick={() => {
                              setAddingTaskTo(null);
                              setNewTaskText('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="add-task-btn"
                          onClick={() => setAddingTaskTo(project.id)}
                        >
                          + Add task
                        </button>
                      )
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Notes Panel */}
      <div style={{ width: '340px' }} className="notes-panel-container">
        <div className="notes-panel">
          {taskData ? (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                flexWrap: 'wrap'
              }}>
                <span className="badge" style={{
                  background: statusConfig[taskData.status].bg,
                  color: statusConfig[taskData.status].color
                }}>
                  {statusConfig[taskData.status].label}
                </span>
                {taskData.status === 'review' && taskData.reviewer && (
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    → {taskData.reviewer}
                  </span>
                )}
                {taskData.added_by && (
                  <span className="external-badge">by {taskData.added_by}</span>
                )}
              </div>
              
              <h3 style={{
                fontFamily: "'Fredoka', sans-serif",
                fontSize: '18px',
                fontWeight: '500',
                color: '#334155',
                margin: '0 0 6px 0'
              }}>
                {taskData.text}
              </h3>
              
              <p style={{
                fontSize: '13px',
                color: '#94a3b8',
                margin: '0 0 20px 0'
              }}>
                {taskData.projectName}
              </p>

              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '700',
                color: '#64748b',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                📝 Notes
              </label>
              
              <textarea
                value={taskData.notes || ''}
                onChange={(e) => updateTaskNotes(taskData.id, e.target.value)}
                placeholder="Add notes, context, or reminders..."
              />

              <div style={{
                marginTop: '20px',
                padding: '14px',
                background: '#f0fdf4',
                borderRadius: '12px',
                fontSize: '13px',
                color: '#166534'
              }}>
                <strong>💡 Tip:</strong> Click the status button to cycle through: To Do → Priority → Review → Done
              </div>
            </>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#94a3b8'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <p style={{ margin: 0, fontWeight: '500' }}>
                Click on a task to view and edit notes
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<TodoApp />);
