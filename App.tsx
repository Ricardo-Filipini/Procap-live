
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { Theme, User, AppData, View, ProcessingTask, AgentSettings, LiveAgentStatus } from './types';
import { INITIAL_APP_DATA, VIEWS, DEFAULT_AGENT_SETTINGS } from './constants';
import { getInitialData, createUser, updateUser as supabaseUpdateUser } from './services/supabaseClient';
import { LiveAgent } from './components/LiveAgent';
import { AgentSettingsModal } from './components/AgentSettingsModal';

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('procap_theme') as Theme | null;
    return savedTheme || 'light';
  });
  const defaultView = VIEWS.find(v => v.name === 'Questões') || VIEWS[0];
  const [activeView, setActiveView] = useState<View>(defaultView);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [appData, setAppData] = useState<AppData>(INITIAL_APP_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingTasks, setProcessingTasks] = useState<ProcessingTask[]>([]);
  const [xpToasts, setXpToasts] = useState<{ id: number; amount: number }[]>([]);
  const prevXpRef = useRef(currentUser?.xp);
  const [isLiveAgentActive, setIsLiveAgentActive] = useState(false);
  const [liveAgentStatus, setLiveAgentStatus] = useState<LiveAgentStatus>('inactive');
  const [isAgentSettingsOpen, setIsAgentSettingsOpen] = useState(false);
  // FIX: Made the 'term' property optional in the navTarget state type to match its usage and fix the type error.
  const [navTarget, setNavTarget] = useState<{viewName: string, term?: string, id?: string, subId?: string} | null>(null);
  const [screenContext, setScreenContext] = useState<string | null>(null);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(() => {
      const savedSettings = localStorage.getItem('procap_agent_settings');
      return savedSettings ? JSON.parse(savedSettings) : DEFAULT_AGENT_SETTINGS;
  });

  // Save agent settings to localStorage whenever they change
  useEffect(() => {
      localStorage.setItem('procap_agent_settings', JSON.stringify(agentSettings));
  }, [agentSettings]);

  // Load all data from Supabase on initial load
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getInitialData();
        if (data.error) {
            throw new Error(data.error);
        }
        setAppData(data.data);
        // Restore user session if available from localStorage
        const savedUserId = localStorage.getItem('procap_lastUserId');
        if (savedUserId) {
          const userToLogin = data.data.users.find(u => u.id === savedUserId);
          if (userToLogin) {
            setCurrentUser(userToLogin);
          } else {
            // Clear invalid ID if user is not found
            localStorage.removeItem('procap_lastUserId');
          }
        }
      } catch (error: any) {
        console.error("Error fetching initial data from Supabase", error);
        setError("Falha na conexão com o banco de dados. Por favor, recarregue a página e verifique sua conexão com a internet.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);
  
  const addXpToast = (amount: number) => {
    const newToast = { id: Date.now(), amount };
    setXpToasts(prev => [...prev, newToast]);
    setTimeout(() => {
        setXpToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, 4000); // Toast disappears after 4 seconds
  };
  
  useEffect(() => {
      const currentXp = currentUser?.xp;
      const prevXp = prevXpRef.current;
      if (typeof currentXp === 'number' && typeof prevXp === 'number' && currentXp > prevXp) {
          const amountGained = currentXp - prevXp;
          addXpToast(amountGained);
      }
      prevXpRef.current = currentXp;
  }, [currentUser?.xp]);


  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('procap_theme', theme);
  }, [theme]);

  const handleLogin = async (pseudonym: string, password?: string): Promise<string | null> => {
    // Admin Login (local)
    if (pseudonym.toLowerCase() === 'admin' && password === 'adminBCB200') {
        const adminUser: User = {
            id: 'admin_user',
            pseudonym: 'admin',
            password: 'adminBCB200',
            level: 99,
            xp: 9999,
            achievements: ['Acesso Total'],
            stats: { questionsAnswered: 0, correctAnswers: 0, topicPerformance: {}, streak: 0 }
        };
        setCurrentUser(adminUser);
        localStorage.setItem('procap_lastUserId', adminUser.id);
        return null; // Success
    }

    if (!password) {
        return "Por favor, insira uma senha.";
    }

    const existingUser = appData.users.find(u => u.pseudonym.toLowerCase() === pseudonym.toLowerCase());
    
    if (existingUser) {
        // User exists, check password for login
        if (existingUser.password === password) {
            setCurrentUser(existingUser);
            localStorage.setItem('procap_lastUserId', existingUser.id);
            return null; // Success
        } else {
            return "Falha no login. Este pseudônimo pode já estar em uso com uma senha diferente, ou a senha digitada está incorreta.";
        }
    } else {
        // User does not exist, register them
        const newUserPayload: Omit<User, 'id'> = {
            pseudonym,
            password,
            level: 1,
            xp: 0,
            achievements: [],
            stats: { questionsAnswered: 0, correctAnswers: 0, topicPerformance: {}, streak: 0 }
        };
        
        const { user: newUser, error: creationError } = await createUser(newUserPayload);
        
        if (creationError === 'duplicate') {
            return "Falha no login. Este pseudônimo já existe. Por favor, verifique sua senha.";
        } else if (newUser) {
          setAppData(prev => ({ ...prev, users: [...prev.users, newUser] }));
          setCurrentUser(newUser);
          localStorage.setItem('procap_lastUserId', newUser.id);
          return null; // Success
        } else {
          return "Ocorreu um erro durante o cadastro. Tente novamente.";
        }
    }
  };
  
  const handleLogout = () => {
      setCurrentUser(null);
      localStorage.removeItem('procap_lastUserId');
      setActiveView(defaultView);
  };
  
  const updateUser = async (updatedUser: User) => {
    const result = await supabaseUpdateUser(updatedUser);
    if (result) {
        setCurrentUser(result);
        setAppData(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === result.id ? result : u),
        }));
    } else {
        // Optionally handle error, e.g., show a notification
        console.error("Failed to update user in the database.");
    }
  };
  
  const handleToggleLiveAgent = () => {
      const willBeActive = !isLiveAgentActive;
      setIsLiveAgentActive(willBeActive);
      if (!willBeActive) {
          setLiveAgentStatus('inactive');
      }
  };

  if (isLoading) {
    return (
        <div className="w-full h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-foreground-light dark:text-foreground-dark">
            <div className="text-xl font-semibold">Carregando dados...</div>
        </div>
    );
  }
  
  if (error) {
    return (
        <div className="w-full h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-foreground-light dark:text-foreground-dark p-4">
            <div className="text-center bg-card-light dark:bg-card-dark p-8 rounded-lg shadow-lg border border-red-500/50">
                <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Erro de Conexão</h1>
                <p className="text-foreground-light dark:text-foreground-dark">{error}</p>
            </div>
        </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} users={appData.users} />;
  }

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark text-foreground-light dark:text-foreground-dark font-sans">
      <Sidebar
        currentUser={currentUser}
        activeView={activeView}
        setActiveView={setActiveView}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onLogout={handleLogout}
      />
      <main
        className={`flex-1 overflow-y-auto p-4 md:p-8 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-14' : 'ml-64'
        }`}
      >
        <MainContent 
          activeView={activeView} 
          setActiveView={setActiveView}
          appData={appData} 
          setAppData={setAppData}
          currentUser={currentUser}
          updateUser={updateUser}
          theme={theme} 
          setTheme={setTheme}
          processingTasks={processingTasks}
          setProcessingTasks={setProcessingTasks}
          onToggleLiveAgent={handleToggleLiveAgent}
          isLiveAgentActive={isLiveAgentActive}
          liveAgentStatus={liveAgentStatus}
          onToggleAgentSettings={() => setIsAgentSettingsOpen(true)}
          navTarget={navTarget}
          setNavTarget={setNavTarget}
          screenContext={screenContext}
          setScreenContext={setScreenContext}
        />
      </main>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {xpToasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => setXpToasts(prev => prev.filter(t => t.id !== toast.id))}
            className="bg-green-500 text-white font-bold py-2 px-4 rounded-full shadow-lg cursor-pointer animate-fade-in-up"
            style={{ minWidth: `${60 + toast.amount * 2}px`, minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            +{toast.amount} XP
          </div>
        ))}
      </div>
       <AgentSettingsModal
          isOpen={isAgentSettingsOpen}
          onClose={() => setIsAgentSettingsOpen(false)}
          settings={agentSettings}
          setSettings={setAgentSettings}
      />
      {isLiveAgentActive && (
          <LiveAgent
              appData={appData}
              currentUser={currentUser}
              setActiveView={setActiveView}
              setNavTarget={setNavTarget}
              agentSettings={agentSettings}
              screenContext={screenContext}
              setLiveAgentStatus={setLiveAgentStatus}
          />
      )}
    </div>
  );
};

const LoginScreen: React.FC<{ onLogin: (pseudonym: string, password?: string) => Promise<string | null>; users: User[] }> = ({ onLogin, users }) => {
  const [pseudonym, setPseudonym] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudonym.trim() || !password.trim()) {
        setError("Por favor, preencha o pseudônimo e a senha.");
        return;
    }
    setIsSubmitting(true);
    const loginError = await onLogin(pseudonym.trim(), password);
    setError(loginError);
    setIsSubmitting(false);
  };
  
  const userExists = users.some(u => u.pseudonym.toLowerCase() === pseudonym.trim().toLowerCase());

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    if (error) setError(null);
  };

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-sm p-8 bg-card-light dark:bg-card-dark rounded-xl shadow-lg border border-border-light dark:border-border-dark">
        <h1 className="text-3xl font-bold text-center text-primary-light dark:text-primary-dark mb-2">Procap - G200</h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-6">Plataforma de Estudos</p>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-400 text-red-700 dark:text-red-300 rounded-md text-sm text-center">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1" htmlFor="pseudonym">
              Pseudônimo
            </label>
            <input
              id="pseudonym"
              type="text"
              value={pseudonym}
              onChange={handleInputChange(setPseudonym)}
              className="w-full px-3 py-2 bg-background-light dark:bg-background-dark text-foreground-light dark:text-foreground-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark"
              placeholder="Seu nome de usuário"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={handleInputChange(setPassword)}
              className="w-full px-3 py-2 bg-background-light dark:bg-background-dark text-foreground-light dark:text-foreground-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark"
              placeholder="********"
              required
              disabled={isSubmitting}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary-light hover:bg-indigo-700 dark:bg-primary-dark dark:hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Processando...' : (userExists ? 'Entrar' : 'Cadastrar e Entrar')}
          </button>
        </form>
      </div>
    </div>
  );
};


export default App;
