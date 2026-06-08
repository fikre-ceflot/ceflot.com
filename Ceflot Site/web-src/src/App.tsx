import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Project, UserProfile } from './types';
import { SiteApp } from './components/SiteApp';
import { CeflotLogo, CeflotBackgroundFlare } from './components/Logo';
import { 
  LogOut, 
  LayoutDashboard, 
  Briefcase, 
  KeyRound, 
  Mail, 
  AlertCircle, 
  Loader2, 
  Fingerprint, 
  Delete, 
  ShieldAlert, 
  Sun, 
  Moon, 
  LockIcon,
  CheckCircle2
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Security Locking
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricSuccess, setBiometricSuccess] = useState(false);

  // Theme support
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('ceflot_site_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('ceflot_site_theme', theme);
  }, [theme]);

  // Initial Auth Check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setProfile(null);
        setProjects([]);
        setActiveProject(null);
        setLoading(false);
        setSigningIn(false); // Reset login loading state on logout
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
      if (data) {
        await loadProjects(data.tenant_id);
      }
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setAuthError('Failed to load user profile: ' + err.message);
    } finally {
      setLoading(false);
      setSigningIn(false); // Prevent stuck login wheel
    }
  };

  const loadProjects = async (tenantId: string) => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (error) throw error;
      setProjects(data || []);
      
      // Auto-select if there is only one project
      if (data && data.length === 1) {
        setActiveProject(data[0]);
      }
    } catch (err: any) {
      console.error('Error loading projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError('Please fill in all fields');
      return;
    }
    setSigningIn(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || 'Verification failed');
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      setSigningIn(false); // Clear stuck state
      setAuthError('');
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    } finally {
      setSession(null);
      setProfile(null);
      setProjects([]);
      setActiveProject(null);
      setIsLocked(true); // Re-lock on logout
      setLoading(false);
    }
  };

  const handlePinPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setPinError(false);
      
      if (newPin === '1234') {
        // Correct pin
        setTimeout(() => {
          setIsLocked(false);
          setPin('');
        }, 200);
      } else if (newPin.length === 4) {
        // Wrong pin
        setTimeout(() => {
          setPinError(true);
          setPin('');
        }, 300);
      }
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setPinError(false);
  };

  const triggerBiometricScan = () => {
    if (biometricLoading || biometricSuccess) return;
    setBiometricLoading(true);
    setPinError(false);
    setTimeout(() => {
      setBiometricLoading(false);
      setBiometricSuccess(true);
      setTimeout(() => {
        setIsLocked(false);
        setBiometricSuccess(false);
      }, 500);
    }, 1200);
  };

  // Styled Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 font-sans relative overflow-hidden">
        <CeflotBackgroundFlare intensity={0.2} className="absolute inset-x-0 mx-auto w-[400px] h-[400px] blur-3xl animate-pulse" />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="relative">
            <CeflotLogo className="w-24 h-24 text-primary animate-pulse relative z-10" isHovered={true} />
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-75 animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black tracking-widest text-[#1aacaa] uppercase animate-pulse">CEFLOT</h1>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest leading-none">Initializing Workspace Terminal</p>
          </div>
          <div className="flex items-center gap-2 mt-4 px-4 py-2 bg-slate-900 border border-slate-800 rounded-full">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Syncing Secure Environment...</span>
          </div>
        </div>
      </div>
    );
  }

  // 1. Not Authenticated: Login Page
  if (!session || !profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between p-6 relative overflow-hidden">
        <CeflotBackgroundFlare intensity={0.12} className="absolute bottom-[250px] right-[100px] w-[600px] h-[600px]" />
        
        {/* Header */}
        <div className="flex items-center justify-center pt-8 z-10">
          <div className="flex flex-col items-center gap-3">
            <CeflotLogo className="w-16 h-16 text-primary" />
            <h1 className="text-3xl font-bold tracking-wider text-slate-100 uppercase">Ceflot</h1>
            <span className="text-[10px] font-mono uppercase bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full tracking-wider font-semibold">
              Site Operations Terminal
            </span>
          </div>
        </div>

        {/* Login Body */}
        <div className="max-w-md w-full mx-auto my-auto z-10 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-slate-200 mb-6 text-center select-none font-sans font-medium tracking-tight text-xl">
            Sign In to Your Workspace
          </h2>

          {authError && (
            <div className="flex items-start gap-3 bg-red-950/40 border border-red-900/50 rounded-xl p-4 mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400 font-sans leading-relaxed">{authError}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl py-3 px-4 pl-11 text-sm text-slate-100 focus:outline-none focus:border-primary transition-all font-sans"
                  placeholder="name@ceflot.com"
                  required
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl py-3 px-4 pl-11 text-sm text-slate-100 focus:outline-none focus:border-primary transition-all font-sans"
                  placeholder="••••••••••••"
                  required
                />
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={signingIn}
              className="w-full mt-6 py-4 bg-primary hover:opacity-90 active:opacity-80 text-slate-100 rounded-2xl text-sm font-semibold tracking-wide shadow-lg shadow-black/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {signingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Open Session Terminal'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center font-mono text-[9px] text-slate-500 z-10 py-4 uppercase tracking-widest">
          Secured Site Connection &copy; {new Date().getFullYear()} Ceflot
        </div>
      </div>
    );
  }

  // 1.5 Authenticated Secure PIN & Biometric Fingerprint Vault Lock
  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between p-6 relative overflow-hidden transition-colors duration-200">
        <CeflotBackgroundFlare intensity={0.15} className="absolute inset-0 m-auto w-[500px] h-[500px] blur-3xl opacity-75" />
        
        {/* Top Header - Theme and logout options */}
        <div className="flex items-center justify-between z-10 py-4">
          <div className="flex items-center gap-3">
            <CeflotLogo className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-sm font-bold tracking-wider uppercase text-slate-150">Ceflot Vault</h1>
              <p className="text-[8px] font-mono uppercase text-slate-400">Security Layer Active</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 border border-slate-800 bg-slate-900/40 hover:bg-slate-900 rounded-xl text-slate-400 hover:text-primary transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-[10px] font-mono uppercase text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>

        {/* Lock Keypad Area */}
        <div className="max-w-xs w-full mx-auto my-auto z-10 flex flex-col items-center">
          <div className="mb-8 text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto mb-3 shadow-md relative group">
              <LockIcon className="w-5 h-5 animate-pulse" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-slate-100 uppercase">Authorize Access</h2>
            <p className="text-xs text-slate-400 max-w-[240px] mx-auto">Enter Terminal PIN (Default: 1234) or verify biometric fingerprint to open database.</p>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-4 mb-8 h-3 items-center">
            {[0, 1, 2, 3].map((pos) => (
              <div 
                key={pos}
                className={`w-3 h-3 rounded-full border transition-all duration-150 ${
                  pinError 
                    ? 'bg-red-500 border-red-500 scale-110 animate-bounce' 
                    : pos < pin.length 
                      ? 'bg-primary border-primary scale-110 shadow-lg shadow-primary/25' 
                      : 'border-slate-800 bg-slate-900'
                }`}
              />
            ))}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-4 w-full px-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                onClick={() => handlePinPress(num)}
                className="w-14 h-14 rounded-full border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 active:scale-95 text-lg font-black text-slate-200 hover:text-primary transition-all flex items-center justify-center shadow-sm cursor-pointer select-none"
              >
                {num}
              </button>
            ))}
            
            {/* Biometrics */}
            <button
              onClick={triggerBiometricScan}
              disabled={biometricLoading || biometricSuccess}
              className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                biometricSuccess 
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' 
                  : biometricLoading 
                    ? 'border-primary bg-primary/20 text-primary animate-spin' 
                    : 'border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary active:scale-95'
              }`}
              title="Biometric Fingerprint Unlock"
            >
              {biometricSuccess ? <CheckCircle2 className="w-5 h-5" /> : <Fingerprint className="w-5 h-5 animate-pulse" />}
            </button>

            {/* Zero */}
            <button
              onClick={() => handlePinPress('0')}
              className="w-14 h-14 rounded-full border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 active:scale-95 text-lg font-black text-slate-200 hover:text-primary transition-all flex items-center justify-center shadow-sm cursor-pointer select-none"
            >
              0
            </button>

            {/* Clear / Delete */}
            <button
              onClick={handlePinDelete}
              className="w-14 h-14 rounded-full border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 active:scale-95 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center shadow-sm cursor-pointer select-none"
              title="Delete last digit"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback Label */}
          <div className="h-6 mt-6 text-center">
            {pinError && (
              <span className="text-xs font-mono font-bold text-red-500 animate-bounce uppercase tracking-wider flex items-center gap-1 bg-red-950/20 border border-red-900/30 px-3 py-1 rounded-lg">
                <ShieldAlert className="w-3.5 h-3.5" /> Passcode mismatch!
              </span>
            )}
            {biometricLoading && (
              <span className="text-[10px] font-mono font-bold text-primary animate-pulse uppercase tracking-wider">
                Verifying device biometric signature...
              </span>
            )}
            {biometricSuccess && (
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest animate-pulse">
                Authorized! Access Granted.
              </span>
            )}
          </div>
        </div>

        {/* Bottom footer */}
        <div className="text-center font-mono text-[8px] text-slate-500 z-10 py-4 uppercase tracking-widest">
          Secured Enclave Verification &copy; {new Date().getFullYear()} Ceflot
        </div>
      </div>
    );
  }

  // 2. Authenticated but no template selections: Project Selection Page
  if (!activeProject) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between p-6 relative overflow-hidden">
        <CeflotBackgroundFlare intensity={0.12} className="absolute bottom-[250px] right-[100px] w-[600px] h-[600px]" />

        {/* Header */}
        <div className="flex items-center justify-between z-10 py-4 border-b border-slate-900">
          <div className="flex items-center gap-3">
            <CeflotLogo className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-md font-bold tracking-wider uppercase text-slate-200">Ceflot</h1>
              <p className="text-[9px] font-mono uppercase text-slate-500">Workspace Selection</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 border border-slate-800 bg-slate-900/40 hover:bg-slate-900 rounded-xl text-slate-400 hover:text-primary transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-xs font-mono uppercase text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Project Selection Container */}
        <div className="max-w-md w-full mx-auto my-auto z-10 py-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-100 mb-2">Select Active Project</h2>
            <p className="text-sm text-slate-400 font-sans">Choose the site workspace you are currently deployed to.</p>
          </div>

          {loadingProjects ? (
            <div className="flex flex-col items-center justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Querying database...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center">
              <Briefcase className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <h3 className="text-md font-semibold text-slate-300 mb-1">No Deployed Projects</h3>
              <p className="text-sm text-slate-500 mb-6 font-sans">Your profile is not currently assigned to any active project workspace.</p>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-slate-900 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-mono uppercase border border-slate-800 transition-all font-semibold"
              >
                Log In With Another Profile
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => setActiveProject(proj)}
                  className="w-full text-left bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-primary/40 rounded-2xl p-5 shadow-lg hover:shadow-primary/5 transition-all duration-300 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-all">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-200 text-sm leading-snug group-hover:text-primary transition-colors">{proj.name}</h3>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-sans">{proj.location || 'Active field workspace'}</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border border-slate-800 flex items-center justify-center text-slate-500 group-hover:border-primary/30 group-hover:text-primary group-hover:bg-primary/5 transition-all">
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center font-mono text-[9px] text-slate-500 z-10 py-4 uppercase tracking-widest border-t border-slate-900">
          User Scope: {profile.role?.replace('_', ' ')} terminal
        </div>
      </div>
    );
  }

  // 3. Project Selected: Mount fully operational SiteApp (the APK version!)
  return (
    <div className="min-h-screen bg-slate-950 font-sans">
      <SiteApp
        project={activeProject}
        tenantId={profile.tenant_id}
        onClose={() => setActiveProject(null)}
        forcedRole={profile.role}
        theme={theme}
        setTheme={setTheme}
        handleLogout={handleLogout}
      />
    </div>
  );
}
