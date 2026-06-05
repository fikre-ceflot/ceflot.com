import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const APK_SRC_DIR = path.join(ROOT_DIR, 'Ceflot Site');
const WEB_SRC_DIR = path.join(APK_SRC_DIR, 'web-src');

// Recreate directory helper
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Copy file helper
function copyFile(src: string, dest: string) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${path.relative(ROOT_DIR, src)} -> ${path.relative(ROOT_DIR, dest)}`);
}

// Write file helper
function writeFile(dest: string, content: string) {
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, content.trim() + '\n', 'utf8');
  console.log(`Created: ${path.relative(ROOT_DIR, dest)}`);
}

// APK Streamlined App code
const streamlinedAppCode = `
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Project, UserProfile } from './types';
import { SiteApp } from './components/SiteApp';
import { CeflotLogo, CeflotBackgroundFlare } from './components/Logo';
import { LogOut, LayoutDashboard, Briefcase, KeyRound, Mail, AlertCircle, Loader2 } from 'lucide-react';

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
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setProjects([]);
    setActiveProject(null);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-sm font-mono text-slate-400 uppercase tracking-widest">Loading Ceflot Site App...</p>
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

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-xs font-mono uppercase text-slate-400 hover:text-slate-200 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
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
      />
    </div>
  );
}
`;

async function compileAndStageAssets() {
  console.log('--- Staging Android Assets & Standalone Web App ---');
  
  // 1. Create native Android structures
  ensureDir(APK_SRC_DIR);
  ensureDir(path.join(APK_SRC_DIR, 'app/src/main/assets/public'));
  
  // 2. Temporarily swap src/App.tsx for compilation
  const originalAppPath = path.join(ROOT_DIR, 'src/App.tsx');
  const backupAppPath = path.join(ROOT_DIR, 'src/App.bak.tsx');
  
  console.log('Swapping App.tsx temporarily...');
  fs.copyFileSync(originalAppPath, backupAppPath);
  fs.writeFileSync(originalAppPath, streamlinedAppCode, 'utf8');

  // 3. Run Web App Compilation
  try {
    console.log('Compiling the streamlined mobile web app via Vite...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('Vite compilation succeeded!');
  } catch (err) {
    console.error('Vite compilation failed! Restoring App.tsx and exiting.', err);
    fs.copyFileSync(backupAppPath, originalAppPath);
    fs.unlinkSync(backupAppPath);
    process.exit(1);
  }

  // 4. Copy completed build assets from /dist into Android Assets public directory
  const distDir = path.join(ROOT_DIR, 'dist');
  const androidPublicDir = path.join(APK_SRC_DIR, 'app/src/main/assets/public');
  
  // Recursive directory copy
  function copyRecursiveSync(src: string, dest: string) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats && stats.isDirectory();
    if (isDirectory) {
      ensureDir(dest);
      fs.readdirSync(src).forEach((childItemName) => {
        copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  console.log('Deploying compiled assets to Android assets folder...');
  copyRecursiveSync(distDir, androidPublicDir);

  // 5. Restore original App.tsx
  console.log('Restoring original App.tsx for web environment...');
  fs.copyFileSync(backupAppPath, originalAppPath);
  fs.unlinkSync(backupAppPath);
  console.log('Original App.tsx restored successfully!');

  // 6. Build the complete web-src folder for the user (editable source code repository)
  console.log('Creating web-src source folder inside Ceflot Site...');
  ensureDir(WEB_SRC_DIR);
  ensureDir(path.join(WEB_SRC_DIR, 'src'));
  ensureDir(path.join(WEB_SRC_DIR, 'src/components'));
  ensureDir(path.join(WEB_SRC_DIR, 'src/lib'));
  ensureDir(path.join(WEB_SRC_DIR, 'src/services'));

  // Copy web structure
  writeFile(path.join(WEB_SRC_DIR, 'src/App.tsx'), streamlinedAppCode);
  copyFile(path.join(ROOT_DIR, 'src/main.tsx'), path.join(WEB_SRC_DIR, 'src/main.tsx'));
  copyFile(path.join(ROOT_DIR, 'src/index.css'), path.join(WEB_SRC_DIR, 'src/index.css'));
  ensureDir(path.join(WEB_SRC_DIR, 'src/types'));
  copyFile(path.join(ROOT_DIR, 'src/types/index.ts'), path.join(WEB_SRC_DIR, 'src/types/index.ts'));
  copyFile(path.join(ROOT_DIR, 'src/vite-env.d.ts'), path.join(WEB_SRC_DIR, 'src/vite-env.d.ts'));
  copyFile(path.join(ROOT_DIR, 'src/lib/supabase.ts'), path.join(WEB_SRC_DIR, 'src/lib/supabase.ts'));
  copyFile(path.join(ROOT_DIR, 'src/lib/utils.ts'), path.join(WEB_SRC_DIR, 'src/lib/utils.ts'));
  copyFile(path.join(ROOT_DIR, 'src/lib/constants.ts'), path.join(WEB_SRC_DIR, 'src/lib/constants.ts'));
  copyFile(path.join(ROOT_DIR, 'src/components/SiteApp.tsx'), path.join(WEB_SRC_DIR, 'src/components/SiteApp.tsx'));
  copyFile(path.join(ROOT_DIR, 'src/components/Logo.tsx'), path.join(WEB_SRC_DIR, 'src/components/Logo.tsx'));
  copyFile(path.join(ROOT_DIR, 'src/components/ResourcePickerModal.tsx'), path.join(WEB_SRC_DIR, 'src/components/ResourcePickerModal.tsx'));
  copyFile(path.join(ROOT_DIR, 'src/services/recalculateProgress.ts'), path.join(WEB_SRC_DIR, 'src/services/recalculateProgress.ts'));
  
  // Public files
  ensureDir(path.join(WEB_SRC_DIR, 'public'));
  if (fs.existsSync(path.join(ROOT_DIR, 'public'))) {
    copyRecursiveSync(path.join(ROOT_DIR, 'public'), path.join(WEB_SRC_DIR, 'public'));
  }

  // Web config files
  copyFile(path.join(ROOT_DIR, 'index.html'), path.join(WEB_SRC_DIR, 'index.html'));
  copyFile(path.join(ROOT_DIR, 'tsconfig.json'), path.join(WEB_SRC_DIR, 'tsconfig.json'));
  copyFile(path.join(ROOT_DIR, 'vite.config.ts'), path.join(WEB_SRC_DIR, 'vite.config.ts'));
  
  // Environment file with parameters loaded from current process
  const currentSupabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const currentSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  
  const envContent = `
VITE_SUPABASE_URL=${currentSupabaseUrl}
VITE_SUPABASE_ANON_KEY=${currentSupabaseAnonKey}
`;
  writeFile(path.join(WEB_SRC_DIR, '.env'), envContent);
  writeFile(path.join(WEB_SRC_DIR, '.env.production'), envContent);
  writeFile(path.join(APK_SRC_DIR, 'local.properties'), `# Supabase Local Connection Properties
supabase.url=${currentSupabaseUrl}
supabase.anon_key=${currentSupabaseAnonKey}
`);

  // Web package config (scaled down to just what's needed for the web app build)
  const webPkg = {
    name: "ceflot-site-mobile-web",
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: {
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview"
    },
    dependencies: {
      "@supabase/supabase-js": "^2.45.0",
      "clsx": "^2.1.1",
      "lucide-react": "^0.546.0",
      "motion": "^12.38.0",
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "tailwind-merge": "^3.5.0"
    },
    devDependencies: {
      "@tailwindcss/vite": "^4.1.14",
      "@vitejs/plugin-react": "^5.0.4",
      "@types/node": "^22.14.0",
      "@types/react": "^19.2.14",
      "@types/react-dom": "^19.2.3",
      "autoprefixer": "^10.4.21",
      "tailwindcss": "^4.1.14",
      "typescript": "~5.8.2",
      "vite": "^6.2.0"
    }
  };
  writeFile(path.join(WEB_SRC_DIR, 'package.json'), JSON.stringify(webPkg, null, 2));

  console.log(' Staging completed successfully!');
}

compileAndStageAssets().catch(err => {
  console.error('Fatal staging error in compileAndStageAssets():', err);
});
