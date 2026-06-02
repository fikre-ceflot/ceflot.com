import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Shield, 
  ArrowRight, 
  Check, 
  Users, 
  Database, 
  Globe, 
  Layers, 
  BarChart3, 
  HardHat, 
  PhoneCall, 
  RefreshCw, 
  X, 
  Lock, 
  Mail, 
  Building, 
  ClipboardList,
  Eye,
  EyeOff,
  Briefcase,
  TrendingUp,
  Play,
  Maximize2,
  Cpu,
  Bookmark,
  DollarSign,
  Plus,
  Compass,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CeflotLogo } from './Logo';

interface LandingPageProps {
  onLoginSuccess: (session: any) => void;
  supabaseUrl?: string;
}

function AnimatedCounter({ target, suffix = '', prefix = '', duration = 1600 }: { target: number; suffix?: string; prefix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const [trigger, setTrigger] = useState(0);
  const elementRef = React.useRef<HTMLSpanElement>(null);

  // Re-trigger visual counting whenever the component scrolls into view
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTrigger((prev) => prev + 1);
          }
        });
      },
      { threshold: 0.1 }
    );

    const el = elementRef.current;
    if (el) {
      observer.observe(el);
    }

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [target]);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic for slick natural deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(easeProgress * target));
      
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);
    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [target, duration, trigger]);

  return (
    <span 
      ref={elementRef}
      onClick={(e) => {
        e.stopPropagation();
        setTrigger((prev) => prev + 1);
      }}
      onMouseEnter={() => {
        setTrigger((prev) => prev + 1);
      }}
      className="cursor-pointer select-none active:scale-95 transition-all duration-300 inline-block hover:brightness-125 relative group"
      title="Interactive metric - hover or click to calculate again!"
    >
      {prefix}{count}{suffix}
      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary/30 scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
    </span>
  );
}

export function LandingPage({ onLoginSuccess }: LandingPageProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  
  // Form values
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('47b5d23d-f030-4edd-9310-4760163cb184'); // Initial option from Sunshine or Dsquare
  const [isNewCompany, setIsNewCompany] = useState(false);
  const [customCompanyName, setCustomCompanyName] = useState('');
  
  // Statuses
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Scroll percent state to follow and animate the side logos from left and right
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollTop(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Interactive Bento Showcase state
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<'estimator' | 'sourcing' | 'ipc' | 'field' | 'risk'>('estimator');

  // Interactive Wow Factor Profit Sandbox states
  const [wowSites, setWowSites] = useState<number>(8); // default 8 active jobsites
  const [wowSmartDelivery, setWowSmartDelivery] = useState<boolean>(true); 
  const [wowSmartBilling, setWowSmartBilling] = useState<boolean>(true); 
  const [isCalculatedPulse, setIsCalculatedPulse] = useState<boolean>(false);

  useEffect(() => {
    setIsCalculatedPulse(true);
    const timer = setTimeout(() => setIsCalculatedPulse(false), 450);
    return () => clearTimeout(timer);
  }, [wowSites, wowSmartDelivery, wowSmartBilling]);

  // ROI Slider state suited for commercial multi-project builders
  const [portfolioSize, setPortfolioSize] = useState<number>(3500000); // Default $3.5M scale
  const [activeSites, setActiveSites] = useState<number>(4); // Describing multi-site challenges

  // Process video action simulator states
  const [activeProcessDemo, setActiveProcessDemo] = useState<'field-sync' | 'material-bid' | 'ipc-audit'>('field-sync');
  const [isPlayingDemo, setIsPlayingDemo] = useState(true);
  const [demoStep, setDemoStep] = useState(0);
  const [isLogoHovered, setIsLogoHovered] = useState(false);

  // Auto running demo timelines to simulate an active app usage action
  useEffect(() => {
    let timer: any;
    if (isPlayingDemo) {
      timer = setInterval(() => {
        setDemoStep((prev) => (prev + 1) % 4);
      }, 3500);
    }
    return () => clearInterval(timer);
  }, [isPlayingDemo, activeProcessDemo]);

  // Reset steps if we change process demo
  const switchProcessDemo = (demoId: 'field-sync' | 'material-bid' | 'ipc-audit') => {
    setActiveProcessDemo(demoId);
    setDemoStep(0);
    setIsPlayingDemo(true);
  };

  // ROI Calculator Math: tailored specifically for mid-market commercial scale
  const annualMaterialsCost = portfolioSize * 0.45; // Approx 45% is materials of construction budget
  const potentialWastageSavings = annualMaterialsCost * 0.048; // 4.8% material run wastage tracked by sourcing desk
  const administrativeHoursSaved = activeSites * 8 * 52; // 8 hrs per week per site saved on manual syncing
  const cashFlowAccelerationDays = 14.5; // Average days saved on IPC claim cycles
  const potentialClaimsLossAvoided = portfolioSize * 0.025; // Preempting variations disputes saves 2.5% of total value

  // Formatter info
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (authTab === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        if (data.session) {
          onLoginSuccess(data.session);
          setShowAuthModal(false);
        }
      } else {
        // Sign up logic
        if (!email.trim() || !password.trim()) {
          throw new Error('Please enter a valid email and password');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        // 1. Create supabase auth user
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;
        
        if (!signUpData.user) {
          throw new Error('Failed to create account. Please try again.');
        }

        let targetTenantId = companyName;

        // 2. If creating new company, insert custom tenant row
        if (isNewCompany) {
          if (!customCompanyName.trim()) {
            throw new Error('Please enter a valid company name');
          }
          const { data: newTenant, error: selectError } = await supabase
            .from('tenants')
            .insert([{ name: customCompanyName.trim() }])
            .select()
            .single();

          if (selectError) throw selectError;
          if (newTenant) {
            targetTenantId = newTenant.id;
          }
        }

        // 3. Create user profile row
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert([{
            id: signUpData.user.id,
            email: email,
            full_name: fullName.trim() || email.split('@')[0],
            tenant_id: targetTenantId,
            role: 'project_manager' // Default role assigned
          }]);

        if (profileError) {
          console.warn('Profile insert error, might exist or require setup:', profileError);
        }

        setSuccessMsg('Account registered successfully! Direct database link active. Logging you in...');
        
        // Auto sign in user immediately
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError) throw signInError;
        
        setTimeout(() => {
          if (signInData.session) {
            onLoginSuccess(signInData.session);
            setShowAuthModal(false);
          }
        }, 1500);
      }
    } catch (err: any) {
      console.error('Authentication Error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred during database transit.');
    } finally {
      setLoading(false);
    }
  };

  const openAuthWithTab = (tab: 'signin' | 'signup') => {
    setAuthTab(tab);
    setErrorMsg('');
    setSuccessMsg('');
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans overflow-x-hidden relative selection:bg-primary/30 selection:text-primary">
      
      {/* Giant Twisted Double-Infinity Scroll Path Tracer */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden h-[300vh]">
        <div className="sticky top-[18%] left-1/2 -translate-x-1/2 w-full max-w-5xl h-[600px] opacity-[0.06] lg:opacity-[0.11] flex items-center justify-center">
          <svg 
            id="bg-double-infinity-tracer"
            viewBox="0 0 182.65 116.39" 
            className="w-full h-full text-primary"
          >
            <defs>
              <linearGradient id="infinityGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1aacaa" />
                <stop offset="35%" stopColor="#1dd1cf" />
                <stop offset="65%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#158a88" />
              </linearGradient>
            </defs>
            
            {/* Background trace curve (Drawn fully using Ceflot's actual twisted logo vectors as guideline) */}
            <path 
              d="M170.09,27.17c-1.36-7.28-7.71-13.74-14.45-14.7-7.99-1.14-14.23,2.13-18.21,9.53-3.6,6.68-5.73,13.94-7.97,21.11-4.99,16-9.62,32.11-14.54,48.13-1.92,6.27-4.63,12.16-10.63,15.73-7.75,4.6-15.52,4.4-22.84-.7-7.2-5-9.87-12.25-8.51-20.81.59-3.67,1.86-7.13,3.48-10.48h-6.59c-1.2,2.85-2.23,5.76-2.87,8.85-3.74,18.1,11.87,35.87,31.63,32.03,10.49-2.04,17.34-8.78,20.59-18.66s20.54-66.22,24.03-73.16c1.95-3.88,6.48-6.12,10.49-5.64,4.84.58,8.84,4.19,10.17,9.17,1.18,4.46-.37,9.31-3.91,11.98-1.68,1.27-3.5,2.31-5.55,2.92-4.04,1.21-8.14,2.02-12.38,2.69l-1.97,6.41c5.72-.87,11.42-1.87,16.95-3.64,9.61-3.08,14.82-11.49,13.08-20.76ZM182.53,27.51c-1.89-21.82-25.56-34.41-44.27-23.52-7.39,4.3-11.58,11.1-14.5,18.85-3.05,8.12-5.8,16.33-8.24,24.65-.53,1.81-2.73,1.89-4.67,1.99-1.53.08-24.18.79-24.93.81-3.64.09-7.27.15-10.91.31-1.41.06-1.73-.45-1.33-1.71,2.11-6.71,4.1-13.46,6.37-20.11,1.18-3.46,3.69-5.75,7.53-5.95,3.48-.18,6,1.56,7.9,4.55,1.06,1.97,1.28,4.16.85,6.47-.66,3.61-2.25,6.72-4.17,9.65h6.95c.95-1.84,1.75-3.76,2.42-5.73,2.09-6.16,1.27-11.91-3.24-16.73-5.69-6.08-18.04-7.16-23.27,4.38-2.99,6.59-4.51,13.67-6.63,20.55-4.86,15.77-9.29,31.69-16.41,46.66-2.49,5.22-6.01,9.66-11.31,12.29-11.54,5.73-25.14,1.36-31.33-9.96-6.27-11.47-2.59-25.02,8.86-31.8,2.09-1.35,4.63-2.37,7.36-2.92,6.52-1.33,13.1-2.07,19.71-2.59l1.9-6.2c-6.26.38-12.51.91-18.71,1.99-4.87.85-9.69,1.96-13.35,4.37C.33,66.75-4.38,85.02,4.44,99.05c6.45,10.26,16.11,15.5,28.3,14.54,11.38-.89,19.21-7.48,24.26-17.47,2.19-4.33,4.06-8.82,5.66-13.41,1.39-3.96,2.81-7.91,4.24-11.86.05-.16.11-.32.17-.48.59-1.63,2.02-2.26,4.74-2.28,1.45-.01,31.91-.3,35.3-.44,1.63-.07,2.23.57,1.72,2.18-2.22,7.02-4.03,14.17-6.61,21.07-.9,2.39-2.42,4.38-4.54,5.82-2.83,1.39-5.61,1.63-8.36-.07-2.96-1.85-4.65-4.49-4.54-8.04.09-3.31,1.38-6.28,2.81-9.21.75-1.55,1.62-3.01,2.56-4.42h-6.89c-.39.66-.75,1.33-1.09,2.02-1.52,3.06-2.89,6.15-3.31,9.6-.99,7.97,3.57,15.03,10.96,16.88,7.57,1.89,15.06-2.09,17.78-9.76,3.74-10.54,6.63-21.34,9.87-32.03,4.14-13.63,7.96-27.37,13.65-40.49,4.34-9.99,13.81-15.92,24.08-14.93,10.09.98,18.49,8.76,20.82,19.28,2.18,9.83-2.67,20.49-11.68,25.66-5.67,3.25-12.05,4.18-18.29,5.48-2.64.55-5.31.99-7.99,1.39l-1.96,6.4c7.88-1.11,15.73-2.42,23.44-4.55,14.83-4.09,24.29-17.33,22.99-32.42ZM109.7,61.66c-5.42.2-10.84.3-16.26.42-6.8.14-13.6.3-20.39.35-1.02.01-2.87.14-2.95-.74-.1-1.15.15-2.31.62-3.45.42-1.03,1.39-1.75,2.49-1.77,0,0,.01,0,.02,0,12.22-.29,24.44-.61,36.66-.81.9,0,2.79.05,2.78,1.18-.01,2.43-1.32,4.76-2.97,4.82ZM110.4,16.63c-7.56-11.7-22.41-15.72-34.29-9.38-7.49,4.01-11.69,10.54-14.15,18.35-2.4,7.65-13.73,44.56-14.2,45.8-2.29,5.96-4.28,12.04-7.47,17.62-2.51,4.4-7.51,6.97-11.95,6.17-4.53-.82-8.67-5.09-9.56-9.88-.85-4.6,1.25-9.16,5.33-11.56,1.33-.82,2.8-1.28,4.28-1.67,4.3-1.12,8.68-1.67,13.08-2.06l1.88-6.12c-6.35.42-12.67,1.05-18.78,2.98-7.69,2.42-12.78,10.03-12.1,17.89.74,8.42,7.04,15.04,15.17,16.31,7.82,1.22,13.55-1.99,17.37-8.41,4.43-7.47,7.32-15.67,9.92-23.94,4.54-14.44,8.87-28.95,13.62-43.32,3.68-11.13,14.64-17.29,24.51-14.29,11.29,3.43,17.26,13.17,15.14,24.79-.48,2.65-1.27,5.18-2.37,7.59h6.51c3.52-9.1,3.74-18.09-1.94-26.87Z" 
              fill="none" 
              stroke="rgba(26, 172, 170, 0.12)" 
              strokeWidth="1.2" 
              strokeLinecap="round"
              strokeDasharray="4, 4"
            />

            {/* Foreground live-scrolled solid tracer (Traces exact company logo outline dynamically) */}
            <motion.path 
              d="M170.09,27.17c-1.36-7.28-7.71-13.74-14.45-14.7-7.99-1.14-14.23,2.13-18.21,9.53-3.6,6.68-5.73,13.94-7.97,21.11-4.99,16-9.62,32.11-14.54,48.13-1.92,6.27-4.63,12.16-10.63,15.73-7.75,4.6-15.52,4.4-22.84-.7-7.2-5-9.87-12.25-8.51-20.81.59-3.67,1.86-7.13,3.48-10.48h-6.59c-1.2,2.85-2.23,5.76-2.87,8.85-3.74,18.1,11.87,35.87,31.63,32.03,10.49-2.04,17.34-8.78,20.59-18.66s20.54-66.22,24.03-73.16c1.95-3.88,6.48-6.12,10.49-5.64,4.84.58,8.84,4.19,10.17,9.17,1.18,4.46-.37,9.31-3.91,11.98-1.68,1.27-3.5,2.31-5.55,2.92-4.04,1.21-8.14,2.02-12.38,2.69l-1.97,6.41c5.72-.87,11.42-1.87,16.95-3.64,9.61-3.08,14.82-11.49,13.08-20.76ZM182.53,27.51c-1.89-21.82-25.56-34.41-44.27-23.52-7.39,4.3-11.58,11.1-14.5,18.85-3.05,8.12-5.8,16.33-8.24,24.65-.53,1.81-2.73,1.89-4.67,1.99-1.53.08-24.18.79-24.93.81-3.64.09-7.27.15-10.91.31-1.41.06-1.73-.45-1.33-1.71,2.11-6.71,4.1-13.46,6.37-20.11,1.18-3.46,3.69-5.75,7.53-5.95,3.48-.18,6,1.56,7.9,4.55,1.06,1.97,1.28,4.16.85,6.47-.66,3.61-2.25,6.72-4.17,9.65h6.95c.95-1.84,1.75-3.76,2.42-5.73,2.09-6.16,1.27-11.91-3.24-16.73-5.69-6.08-18.04-7.16-23.27,4.38-2.99,6.59-4.51,13.67-6.63,20.55-4.86,15.77-9.29,31.69-16.41,46.66-2.49,5.22-6.01,9.66-11.31,12.29-11.54,5.73-25.14,1.36-31.33-9.96-6.27-11.47-2.59-25.02,8.86-31.8,2.09-1.35,4.63-2.37,7.36-2.92,6.52-1.33,13.1-2.07,19.71-2.59l1.9-6.2c-6.26.38-12.51.91-18.71,1.99-4.87.85-9.69,1.96-13.35,4.37C.33,66.75-4.38,85.02,4.44,99.05c6.45,10.26,16.11,15.5,28.3,14.54,11.38-.89,19.21-7.48,24.26-17.47,2.19-4.33,4.06-8.82,5.66-13.41,1.39-3.96,2.81-7.91,4.24-11.86.05-.16.11-.32.17-.48.59-1.63,2.02-2.26,4.74-2.28,1.45-.01,31.91-.3,35.3-.44,1.63-.07,2.23.57,1.72,2.18-2.22,7.02-4.03,14.17-6.61,21.07-.9,2.39-2.42,4.38-4.54,5.82-2.83,1.39-5.61,1.63-8.36-.07-2.96-1.85-4.65-4.49-4.54-8.04.09-3.31,1.38-6.28,2.81-9.21.75-1.55,1.62-3.01,2.56-4.42h-6.89c-.39.66-.75,1.33-1.09,2.02-1.52,3.06-2.89,6.15-3.31,9.6-.99,7.97,3.57,15.03,10.96,16.88,7.57,1.89,15.06-2.09,17.78-9.76,3.74-10.54,6.63-21.34,9.87-32.03,4.14-13.63,7.96-27.37,13.65-40.49,4.34-9.99,13.81-15.92,24.08-14.93,10.09.98,18.49,8.76,20.82,19.28,2.18,9.83-2.67,20.49-11.68,25.66-5.67,3.25-12.05,4.18-18.29,5.48-2.64.55-5.31.99-7.99,1.39l-1.96,6.4c7.88-1.11,15.73-2.42,23.44-4.55,14.83-4.09,24.29-17.33,22.99-32.42ZM109.7,61.66c-5.42.2-10.84.3-16.26.42-6.8.14-13.6.3-20.39.35-1.02.01-2.87.14-2.95-.74-.1-1.15.15-2.31.62-3.45.42-1.03,1.39-1.75,2.49-1.77,0,0,.01,0,.02,0,12.22-.29,24.44-.61,36.66-.81.9,0,2.79.05,2.78,1.18-.01,2.43-1.32,4.76-2.97,4.82ZM110.4,16.63c-7.56-11.7-22.41-15.72-34.29-9.38-7.49,4.01-11.69,10.54-14.15,18.35-2.4,7.65-13.73,44.56-14.2,45.8-2.29,5.96-4.28,12.04-7.47,17.62-2.51,4.4-7.51,6.97-11.95,6.17-4.53-.82-8.67-5.09-9.56-9.88-.85-4.6,1.25-9.16,5.33-11.56,1.33-.82,2.8-1.28,4.28-1.67,4.3-1.12,8.68-1.67,13.08-2.06l1.88-6.12c-6.35.42-12.67,1.05-18.78,2.98-7.69,2.42-12.78,10.03-12.1,17.89.74,8.42,7.04,15.04,15.17,16.31,7.82,1.22,13.55-1.99,17.37-8.41,4.43-7.47,7.32-15.67,9.92-23.94,4.54-14.44,8.87-28.95,13.62-43.32,3.68-11.13,14.64-17.29,24.51-14.29,11.29,3.43,17.26,13.17,15.14,24.79-.48,2.65-1.27,5.18-2.37,7.59h6.51c3.52-9.1,3.74-18.09-1.94-26.87Z" 
              fill="none" 
              stroke="url(#infinityGlow)" 
              strokeWidth="2.5" 
              strokeLinecap="round"
              style={{
                pathLength: Math.min(1, scrollTop / 1200),
                filter: 'drop-shadow(0 0 16px rgba(26, 172, 170, 0.75))'
              }}
            />
          </svg>
        </div>
      </div>

      {/* Background Decorative Polygons */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[35%] right-1/4 w-[700px] h-[700px] bg-primary/5 rounded-full blur-[160px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[20%] left-1/3 w-[600px] h-[600px] bg-slate-900/40 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Navigation Row */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-900/60 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          {/* Animated Clean Logo Vector Holder */}
          <div className="relative group flex items-center gap-2">
            <div className="relative w-10 h-7 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-primary group-hover:border-primary/45 transition-colors">
              <CeflotLogo className="w-8 h-5 text-primary" color="#1aacaa" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white uppercase ml-1">Ceflot</span>
          </div>
          <span className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 bg-primary/10 border border-primary/20 rounded text-primary font-bold uppercase">CLOUD DELIVERY OS</span>
        </div>

        <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <a href="#digital-ops" className="hover:text-primary transition-colors">Smart Site</a>
          <a href="#demo-actions" className="hover:text-primary transition-colors">How It Works</a>
          <a href="#roi-engine" className="hover:text-primary transition-colors font-mono text-primary">ROI Engine</a>
          <a href="#mid-scale-value" className="hover:text-primary transition-colors">Benefits</a>
        </nav>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => openAuthWithTab('signin')}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            Sign In
          </button>
          <button 
            onClick={() => openAuthWithTab('signup')}
            className="px-4.5 py-2.5 text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary-hover hover:scale-[1.02] text-slate-950 rounded-xl shadow-lg shadow-primary/20 cursor-pointer active:scale-95 transition-all w-[110px]"
          >
            Get Access
          </button>
        </div>
      </header>

      {/* Target Focus Hero Header Section with centered big name and logo presentation */}
      <section className="relative pt-20 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        
        {/* BIG CENTERED NAME AND INTERACTIVE NAKED LOGO UNIT */}
        <div className="flex flex-col items-center justify-center mb-6 text-center select-none animate-fade-in group">
          <div 
            onMouseEnter={() => setIsLogoHovered(true)}
            onMouseLeave={() => setIsLogoHovered(false)}
            className="relative select-none cursor-pointer mb-5 z-10"
          >
            {/* Giant, naked vector logo without bounding boxes */}
            <div className="relative w-56 h-36 flex items-center justify-center">
              <CeflotLogo 
                className={`w-48 h-32 transition-all duration-700 ${
                  isLogoHovered || scrollTop > 15 
                    ? 'drop-shadow-[0_0_45px_rgba(26,172,170,0.45)] scale-105' 
                    : 'drop-shadow-[0_0_20px_rgba(26,172,170,0.15)]'
                }`} 
                color={isLogoHovered || scrollTop > 15 ? '#1aacaa' : '#158a88'}
                isHovered={isLogoHovered || scrollTop > 15}
              />
            </div>
          </div>

          <div className="text-6xl md:text-8xl font-black tracking-[0.22em] text-white uppercase leading-none pl-[0.22em]">
            Ceflot
          </div>
          <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.45em] text-primary font-extrabold mt-4 pl-[0.45em]">
            CLOUD DELIVERY OS
          </p>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent mt-4" />
        </div>

        {/* Active Monitor Tag */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-mono tracking-widest text-primary mb-8 uppercase z-10">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>Tailored for multi-site commercial & civil operations</span>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-8xl font-black tracking-tight text-white max-w-5xl leading-[1.05] mb-6 z-10 uppercase">
          UNIFY YOUR<br />
          <span className="bg-gradient-to-r from-primary via-teal-400 to-cyan-400" style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', color: 'transparent', display: 'inline' }}>multi-project</span><br />
          SITE OPERATIONS
        </h1>

        <p className="text-base md:text-lg text-slate-400 max-w-3xl leading-relaxed mb-10 z-10 text-center">
          The all-in-one construction intelligence platform — real-time site sync, automated IPC claims, material sourcing, and offline-first field reporting built for East Africa's infrastructure challenges.
        </p>

        {/* Sleek Hero Percentage Highlights - Spread widely across the screen with premium graphics */}
        <div className="w-full max-w-7xl px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-16 z-10 text-center relative">
          
          {/* Card 1: Material Overruns */}
          <div className="group relative flex flex-col justify-between p-6 bg-slate-950/65 border border-slate-900/90 hover:border-primary/40 rounded-2xl transition-all duration-300 hover:scale-[1.03] shadow-lg hover:shadow-primary/5 text-left">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl" />
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-primary/10 border border-primary/25 rounded-lg text-primary">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono tracking-wider font-extrabold uppercase px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">Materials</span>
            </div>
            <div className="mt-2">
              <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight block leading-none">
                <AnimatedCounter target={48} suffix="%" />
              </span>
              <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider block mt-1">REDUCTION</span>
              <span className="text-xs text-slate-300 font-semibold block leading-tight mt-2 min-h-[32px]">
                Reduction in material overruns
              </span>
            </div>
            {/* Custom Interactive Graphic */}
            <div className="mt-4 pt-3 border-t border-slate-900/60">
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                <span>SPILLAGE RATE</span>
                <span className="text-primary font-bold">-48%</span>
              </div>
              <div className="w-full bg-slate-900/90 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
                <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: '52%' }} />
              </div>
            </div>
          </div>

          {/* Card 2: IPC Claim Cycles */}
          <div className="group relative flex flex-col justify-between p-6 bg-slate-950/65 border border-slate-900/90 hover:border-cyan-400/40 rounded-2xl transition-all duration-300 hover:scale-[1.03] shadow-lg hover:shadow-cyan-400/5 text-left">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400/10 via-cyan-400/50 to-cyan-400/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl" />
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-cyan-400/10 border border-cyan-400/25 rounded-lg text-cyan-400">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono tracking-wider font-extrabold uppercase px-2 py-0.5 bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 rounded">Claims</span>
            </div>
            <div className="mt-2">
              <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight block leading-none">
                <AnimatedCounter target={65} suffix="%" />
              </span>
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider block mt-1">FASTER CYCLE</span>
              <span className="text-xs text-slate-300 font-semibold block leading-tight mt-2 min-h-[32px]">
                Faster IPC claim cycles
              </span>
            </div>
            {/* Custom Interactive Graphic */}
            <div className="mt-4 pt-3 border-t border-slate-900/60">
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                <span>VERIFICATION LAG</span>
                <span className="text-cyan-400 font-bold">-65%</span>
              </div>
              <div className="w-full bg-slate-900/90 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
                <div className="bg-cyan-400 h-full rounded-full transition-all duration-1000" style={{ width: '35%' }} />
              </div>
            </div>
          </div>

          {/* Card 3: Administrative Hours */}
          <div className="group relative flex flex-col justify-between p-6 bg-slate-950/65 border border-slate-900/90 hover:border-primary/40 rounded-2xl transition-all duration-300 hover:scale-[1.03] shadow-lg hover:shadow-primary/5 text-left">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl" />
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-primary/10 border border-primary/25 rounded-lg text-primary">
                <Zap className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono tracking-wider font-extrabold uppercase px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">Workload</span>
            </div>
            <div className="mt-2">
              <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight block leading-none">
                <AnimatedCounter target={75} suffix="%" />
              </span>
              <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider block mt-1">RECLAIM RATE</span>
              <span className="text-xs text-slate-300 font-semibold block leading-tight mt-2 min-h-[32px]">
                Weekly admin hours reclaimed
              </span>
            </div>
            {/* Custom Interactive Graphic */}
            <div className="mt-4 pt-3 border-t border-slate-900/60">
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                <span>STAFF BURDEN</span>
                <span className="text-primary font-bold">-75%</span>
              </div>
              <div className="w-full bg-slate-900/90 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
                <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: '25%' }} />
              </div>
            </div>
          </div>

          {/* Card 4: Record Accuracy */}
          <div className="group relative flex flex-col justify-between p-6 bg-slate-950/65 border border-slate-900/90 hover:border-cyan-400/40 rounded-2xl transition-all duration-300 hover:scale-[1.03] shadow-lg hover:shadow-cyan-400/5 text-left">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400/10 via-cyan-400/50 to-cyan-400/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl" />
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-cyan-400/10 border border-cyan-400/25 rounded-lg text-cyan-400">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono tracking-wider font-extrabold uppercase px-2 py-0.5 bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 rounded">Accuracy</span>
            </div>
            <div className="mt-2">
              <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight block leading-none">
                <AnimatedCounter target={99} suffix=".4%" />
              </span>
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider block mt-1">PRECISION RATE</span>
              <span className="text-xs text-slate-300 font-semibold block leading-tight mt-2 min-h-[32px]">
                Site-record accuracy rate
              </span>
            </div>
            {/* Custom Interactive Graphic */}
            <div className="mt-4 pt-3 border-t border-slate-900/60">
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                <span>AUDIT ERROR RATE</span>
                <span className="text-cyan-400 font-bold">0.6%</span>
              </div>
              <div className="w-full bg-slate-900/90 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
                <div className="bg-cyan-400 h-full rounded-full transition-all duration-1000" style={{ width: '99.4%' }} />
              </div>
            </div>
          </div>

          {/* Card 5: Subcontractor Approvals */}
          <div className="group relative flex flex-col justify-between p-6 bg-slate-950/65 border border-slate-900/90 hover:border-primary/40 rounded-2xl transition-all duration-300 hover:scale-[1.03] shadow-lg hover:shadow-primary/5 text-left">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl" />
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-primary/10 border border-primary/25 rounded-lg text-primary">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono tracking-wider font-extrabold uppercase px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">Approvals</span>
            </div>
            <div className="mt-2">
              <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight block leading-none">
                <AnimatedCounter target={300} suffix="%" />
              </span>
              <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider block mt-1">APPROVAL SPEED</span>
              <span className="text-xs text-slate-300 font-semibold block leading-tight mt-2 min-h-[32px]">
                Subcontractor approvals
              </span>
            </div>
            {/* Custom Interactive Graphic */}
            <div className="mt-4 pt-3 border-t border-slate-900/60">
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                <span>DECISION VELOCITY</span>
                <span className="text-primary font-bold">3.0x</span>
              </div>
              <div className="flex gap-1.5 justify-start items-end h-3 mt-1.5">
                <div className="h-2 w-full rounded-full bg-primary/20 border border-primary/30 animate-pulse" />
                <div className="h-2.5 w-full rounded-full bg-primary/50 border border-primary/50 animate-pulse" />
                <div className="h-3 w-full rounded-full bg-primary border border-primary" />
              </div>
            </div>
          </div>

        </div>

        {/* Hero Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md z-10 w-full mb-4">
          <button 
            onClick={() => openAuthWithTab('signup')}
            className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-hover text-slate-950 font-extrabold rounded-xl shadow-xl shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer transition-all text-sm uppercase tracking-wider active:scale-95"
          >
            <span>Request Access</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <a 
            href="#demo-actions" 
            className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors text-sm"
          >
            <Play className="w-4 h-4 text-primary" />
            <span>See Live Demo</span>
          </a>
        </div>

        {/* Real-time Ticking Simulator Feed Widget: Generic division labels with no tenant data */}
        <div className="mt-8 p-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl max-w-3xl w-full flex items-center justify-between text-left text-xs text-slate-400 font-mono gap-4 z-10">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-primary font-bold uppercase tracking-wider text-[10px]">LIVE JOBSITE UPDATES</span>
          </div>
          <p className="truncate leading-none text-[11px] text-slate-300">
            [Main Sector] Foundations finalized on budget · Materials optimized · Sourcing bids active
          </p>
          <span className="text-[10px] text-zinc-500 shrink-0 hidden sm:inline">REGIONAL OFFICE SYNCED</span>
        </div>

        {/* WOW FACTOR HOOK: INTERACTIVE PROFIT & WASTE SAVINGS SIMULATOR DESIGNED FOR LAYMAN VALUE */}
        <div className="mt-12 w-full max-w-5xl bg-slate-900/40 border border-slate-800/70 p-6 md:p-8 rounded-3xl relative overflow-hidden backdrop-blur-md z-10 text-left">
          {/* Subtle background glow effect */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.02] rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-cyan-500/[0.02] rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/60 pb-5 mb-6 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/25 rounded-md text-[10px] font-mono tracking-wider text-primary uppercase font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Margin Optimization Simulator
              </div>
              <h3 className="text-xl md:text-2xl font-extrabold text-white tracking-tight mt-2">
                Calculate Your Efficiency Lift
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                A rough, non-binding benchmark. Adjust your operation scale and toggle capabilities to see projected upside.
              </p>
            </div>
            
            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>DYNAMIC PERFORMANCE BENCHMARK</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* INPUT PANEL: Sliders & Modes */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-6 bg-slate-950/40 p-5 rounded-2xl border border-slate-850">
              
              {/* Slider Input */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Simulator Inputs: Active Jobsites
                  </label>
                  <span className="text-lg font-black font-mono text-primary bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">
                    {wowSites} Jobsites
                  </span>
                </div>
                
                <input 
                  type="range" 
                  min="2" 
                  max="40" 
                  step="1"
                  value={wowSites} 
                  onChange={(e) => setWowSites(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                
                {/* Easy Presets */}
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {[
                    { label: '4 sites', val: 4 },
                    { label: '10 sites', val: 10 },
                    { label: '20 sites', val: 20 },
                    { label: '35 sites', val: 35 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setWowSites(preset.val)}
                      className={`py-1.5 px-1 text-[9px] font-mono font-black uppercase rounded-md border transition-all text-center cursor-pointer ${
                        wowSites === preset.val 
                          ? 'bg-primary/10 border-primary/30 text-primary font-bold' 
                          : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-900">
                {/* Material Delivery Optimizations Toggle */}
                <div className="flex flex-col justify-between p-3.5 bg-slate-900/40 border border-slate-850 rounded-xl gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block tracking-wider">Smart Material Sourcing</span>
                    <p className="text-xs text-slate-300 font-bold mt-1">Price locking & stock control</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWowSmartDelivery(false)}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg border transition-all cursor-pointer ${
                        !wowSmartDelivery 
                          ? 'bg-red-950/20 border-red-900/40 text-red-400' 
                          : 'bg-slate-900/60 border-slate-850 text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      Disabled
                    </button>
                    <button
                      type="button"
                      onClick={() => setWowSmartDelivery(true)}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        wowSmartDelivery 
                          ? 'bg-primary/10 border-primary/20 text-primary shadow-sm shadow-primary/10 font-black' 
                          : 'bg-slate-900/60 border-slate-850 text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      <span>Enabled ✨</span>
                    </button>
                  </div>
                </div>

                {/* Subcontractor Claims & Verification Toggle */}
                <div className="flex flex-col justify-between p-3.5 bg-slate-900/40 border border-slate-850 rounded-xl gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block tracking-wider">Automated Invoice Processing</span>
                    <p className="text-xs text-slate-300 font-bold mt-1">Verification & EV sync</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWowSmartBilling(false)}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg border transition-all cursor-pointer ${
                        !wowSmartBilling 
                          ? 'bg-red-950/20 border-red-900/40 text-red-400' 
                          : 'bg-slate-900/60 border-slate-850 text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      Disabled
                    </button>
                    <button
                      type="button"
                      onClick={() => setWowSmartBilling(true)}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        wowSmartBilling 
                          ? 'bg-cyan-950/30 border-cyan-800/40 text-cyan-400 shadow-sm shadow-cyan-950/50 font-black' 
                          : 'bg-slate-900/60 border-slate-850 text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      <span>Enabled ✨</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Informative Layman Message Badge in bottom */}
              <div className="text-[11px] bg-slate-900/60 border border-slate-850 p-2.5 rounded-lg text-slate-400 font-sans flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full shrink-0" />
                <span>
                  {!wowSmartDelivery && !wowSmartBilling && "⚠️ Loose delivery logs and manual spreadsheet checking holds back multi-site profitability."}
                  {wowSmartDelivery && !wowSmartBilling && "💡 Price locks and waste control activated, but subcontractor claims still flow through manual spreadsheet trails."}
                  {!wowSmartDelivery && wowSmartBilling && "💡 Verification & EV sync running smoothly, but bulk material sourcing lacks real-time price locking limits."}
                  {wowSmartDelivery && wowSmartBilling && "🔥 Maximum Siting Harmony: Sourcing locks match invoice cycles dynamically, optimizing overall multi-site margin."}
                </span>
              </div>

            </div>

            {/* BENEFITS OUTPUT PANEL: Real marketing values in percent and direct values */}
            <div className={`lg:col-span-12 xl:col-span-5 rounded-2xl border p-5 flex flex-col justify-between transition-all duration-300 ${
              isCalculatedPulse 
                ? 'bg-primary/10 border-primary/40 scale-[1.01]' 
                : 'bg-slate-950/70 border-slate-800'
            }`}>
              
              {/* Total Savings Hero Spot */}
              <div className="text-center py-4 bg-slate-900/40 rounded-xl border border-slate-850/60 relative overflow-hidden">
                <p className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest leading-none">
                  Projected Outcome: Estimated Margin Improvement
                </p>
                
                <h4 className="text-3xl md:text-4xl font-extrabold text-primary font-mono tracking-tight my-2">
                  {wowSmartDelivery && wowSmartBilling 
                    ? `+${(9.1 + (wowSites - 8) * 0.08).toFixed(1)}% to +${(13.0 + (wowSites - 8) * 0.11).toFixed(1)}%` 
                    : wowSmartDelivery 
                      ? `+${(5.0 + (wowSites - 8) * 0.04).toFixed(1)}% to +${(7.5 + (wowSites - 8) * 0.07).toFixed(1)}%` 
                      : wowSmartBilling 
                        ? `+${(3.0 + (wowSites - 8) * 0.04).toFixed(1)}% to +${(4.5 + (wowSites - 8) * 0.05).toFixed(1)}%` 
                        : '0.00%'}
                </h4>
                
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] text-white">
                  <span className="font-bold text-primary">
                    Rough estimate based on East Africa averages
                  </span>
                </div>
              </div>

              {/* Individual Layman Outcomes Indicators */}
              <div className="flex flex-col gap-3.5 my-4">
                
                {/* Outcome 1: Concrete Wastage */}
                <div className="flex items-center gap-3 p-2 bg-slate-900/20 rounded-lg">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border uppercase font-mono text-[9px] font-black ${
                    wowSmartDelivery ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-slate-900/60 border-slate-850 text-slate-500'
                  }`}>
                    {wowSmartDelivery ? '-15%' : '0%'}
                  </div>
                  <div className="text-left leading-none">
                    <span className="text-[11px] font-bold text-slate-200 block">Bulk material waste reduction</span>
                    <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                      {wowSmartDelivery 
                        ? "Ordered aggregates match actual pour records." 
                        : "No tracking. Suppliers verify excess bulk surpluses manually."}
                    </span>
                  </div>
                </div>

                {/* Outcome 2: Delay Reduction */}
                <div className="flex items-center gap-3 p-2 bg-slate-900/20 rounded-lg">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border uppercase font-mono text-[9px] font-black ${
                    wowSmartBilling ? 'bg-cyan-950/40 border-cyan-500/20 text-cyan-400' : 'bg-slate-900/60 border-slate-850 text-slate-500'
                  }`}>
                    {wowSmartBilling ? '-65%' : '0%'}
                  </div>
                  <div className="text-left leading-none">
                    <span className="text-[11px] font-bold text-slate-200 block">Invoice delay reduction</span>
                    <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                      {wowSmartBilling 
                        ? "Claims processed on-site instantly." 
                        : "Subcontractor bids wait weeks for manual double checking processes."}
                    </span>
                  </div>
                </div>

                {/* Outcome 3: Admin Load Saved */}
                <div className="flex items-center gap-3 p-2 bg-slate-900/20 rounded-lg">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border bg-slate-950 border-slate-850 uppercase font-mono text-[9px] text-zinc-400 font-black">
                    {wowSmartBilling ? '28hr' : '8hr'}
                  </div>
                  <div className="text-left leading-none">
                    <span className="text-[11px] font-bold text-slate-200 block">Admin hours reclaimed weekly</span>
                    <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                      {wowSmartBilling 
                        ? "Auto checking blocks spreadsheet manual inputs." 
                        : "Admin staff spend vital hours compiling multi-project excel books."}
                    </span>
                  </div>
                </div>

              </div>

              {/* Simulated pilot action call button */}
              <button
                type="button"
                onClick={() => openAuthWithTab('signup')}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-slate-950 font-black rounded-xl text-center text-xs uppercase tracking-widest transition-colors shadow-lg shadow-primary/10 cursor-pointer active:scale-95"
              >
                Start Your Pilot
              </button>

            </div>
          </div>
        </div>

        {/* AVANT-GARDE TOP VISUAL RUNWAY: HIGH END REAL TIME SITING GALLERY COLLAGE */}
        <div className="mt-16 w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 relative select-none z-10">
          
          {/* Card 1: Foundations Steel & Rebar Siting */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/40 p-1 min-h-[360px] flex flex-col justify-between shadow-2xl transition-all hover:border-primary/30">
            <div className="absolute inset-x-0 top-0 h-48 overflow-hidden rounded-xl">
              <img 
                src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600" 
                alt="Rebar Siting"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
            </div>
            {/* Top Status Card 1 */}
            <div className="absolute top-3 left-3 flex items-center justify-between pointer-events-none w-[calc(100%-24px)] text-[9px] font-mono uppercase">
              <span className="px-2 py-0.5 bg-slate-950/80 border border-primary/20 text-primary rounded-md font-bold">APPROVED East Sector Civil</span>
              <span className="text-zinc-500">CIVIL OPERATIONS</span>
            </div>
            
            <div className="mt-48 p-4 text-left">
              <span className="text-[10px] font-mono text-primary font-extrabold uppercase tracking-widest block mb-1">Foundations</span>
              <h4 className="text-sm font-bold text-white tracking-tight">Structural Foundation Formwork</h4>
              <p className="text-[11px] text-slate-400 leading-normal mt-1.5 font-normal">Ground progress coordinates mapped completely to Bills of Quantities material logs.</p>
              <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center text-[9px] font-mono text-slate-500">
                <span>CONCRETE: VERIFIED</span>
                <span className="text-primary">100% SYNCED</span>
              </div>
            </div>
          </div>

          {/* Card 2: Tower Crane Silhouette at Dusk */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/40 p-1 min-h-[360px] flex flex-col justify-between shadow-2xl transition-all hover:border-cyan-500/30 md:translate-y-4">
            <div className="absolute inset-x-0 top-0 h-48 overflow-hidden rounded-xl">
              <img 
                src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600" 
                alt="Tower Crane"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-55 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
            </div>
            {/* Top Status Card 2 */}
            <div className="absolute top-3 left-3 flex items-center justify-between pointer-events-none w-[calc(100%-24px)] text-[9px] font-mono uppercase">
              <span className="px-2 py-0.5 bg-slate-950/80 border border-cyan-500/20 text-cyan-400 rounded-md font-bold">MACHINERY Central Corridor Crane</span>
              <span className="text-zinc-500">CIVIL OPERATIONS</span>
            </div>
            
            <div className="mt-48 p-4 text-left">
              <span className="text-[10px] font-mono text-cyan-400 font-extrabold uppercase tracking-widest block mb-1">Equipment</span>
              <h4 className="text-sm font-bold text-white tracking-tight">Logistics & Operational Audits</h4>
              <p className="text-[11px] text-slate-400 leading-normal mt-1.5 font-normal">Continuous crane tracking maps equipment runtime directly to structural milestone charts.</p>
              <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center text-[9px] font-mono text-slate-500">
                <span>FUEL CAPACITY: OK</span>
                <span className="text-cyan-400">OPTIMIZED VERIFIED</span>
              </div>
            </div>
          </div>

          {/* Card 3: Civil Superintendent checking actual metrics */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/40 p-1 min-h-[360px] flex flex-col justify-between shadow-2xl transition-all hover:border-primary/30">
            <div className="absolute inset-x-0 top-0 h-48 overflow-hidden rounded-xl">
              <img 
                src="https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?q=80&w=600" 
                alt="Civil Superintendent"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
            </div>
            {/* Top Status Card 3 */}
            <div className="absolute top-3 left-3 flex items-center justify-between pointer-events-none w-[calc(100%-24px)] text-[9px] font-mono uppercase">
              <span className="px-2 py-0.5 bg-slate-950/80 border border-primary/20 text-primary rounded-md font-bold">VERIFIED Western Regional Block</span>
              <span className="text-zinc-500">CIVIL OPERATIONS</span>
            </div>
            
            <div className="mt-48 p-4 text-left">
              <span className="text-[10px] font-mono text-primary font-extrabold uppercase tracking-widest block mb-1">Billing Claims</span>
              <h4 className="text-sm font-bold text-white tracking-tight">Interim Quantity Approvals</h4>
              <p className="text-[11px] text-slate-400 leading-normal mt-1.5 font-normal">Directors certify concrete volumes on smartphone interfaces inside 3 taps, eliminating paper claims delay.</p>
              <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center text-[9px] font-mono text-slate-500">
                <span>No Claim Discrepancies</span>
                <span className="text-primary">100% VERIFIED</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* INFINITE SCROLLING RIBBON */}
      <div className="w-full bg-slate-900 border-y border-slate-800/80 py-4 overflow-hidden relative select-none z-10">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />
        <div className="animate-marquee whitespace-nowrap flex gap-10 items-center">
          {[...Array(3)].map((_, i) => (
            <React.Fragment key={i}>
              <span className="text-xs font-mono font-extrabold tracking-[0.2em] text-primary">REAL-TIME SITE SYNC</span>
              <span className="text-zinc-700 text-sm">•</span>
              <span className="text-xs font-mono font-extrabold tracking-[0.2em] text-cyan-400">MATERIAL WASTE CONTROL</span>
              <span className="text-zinc-700 text-sm">•</span>
              <span className="text-xs font-mono font-extrabold tracking-[0.2em] text-primary">IPC CLAIM AUTOMATION</span>
              <span className="text-zinc-700 text-sm">•</span>
              <span className="text-xs font-mono font-extrabold tracking-[0.2em] text-emerald-400">MULTI-SITE OVERSIGHT</span>
              <span className="text-zinc-700 text-sm">•</span>
              <span className="text-xs font-mono font-extrabold tracking-[0.2em] text-primary">OFFLINE-FIRST FIELD APP</span>
              <span className="text-zinc-700 text-sm">•</span>
              <span className="text-xs font-mono font-extrabold tracking-[0.2em] text-cyan-400">SUPPLIER BIDDING ENGINE</span>
              <span className="text-zinc-700 text-sm">•</span>
              <span className="text-xs font-mono font-extrabold tracking-[0.2em] text-primary">EARNED VALUE TRACKING</span>
              <span className="text-zinc-700 text-sm">•</span>
              <span className="text-xs font-mono font-extrabold tracking-[0.2em] text-teal-400 font-bold">SUBCONTRACTOR BILLING</span>
              <span className="text-zinc-700 text-sm">•</span>
              <span className="text-xs font-mono font-extrabold tracking-[0.2em] text-primary">STRUCTURAL AUDIT LOGS</span>
              <span className="text-zinc-700 text-sm">•</span>
              <span className="text-xs font-mono font-extrabold tracking-[0.2em] text-amber-400">EAST AFRICA CERTIFIED</span>
              <span className="text-zinc-700 text-sm">•</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* PLATFORM CAPABILITIES SECTION */}
      <section id="digital-ops" className="py-24 px-6 max-w-7xl mx-auto scroll-mt-20 relative z-10 border-b border-slate-900/60">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-mono font-black text-primary uppercase tracking-widest mb-3">Platform Capabilities</div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Every Tool Your <br className="sm:hidden" />
            <span className="bg-gradient-to-r from-primary via-teal-400 to-cyan-400" style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', color: 'transparent', display: 'inline' }}>operations demand</span>
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-sm md:text-base leading-relaxed font-normal">
            From ground-breaking to final certification — Ceflot digitalises the full construction delivery chain in one auditable, high-performance workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: List of 5 capabilities */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {[
              {
                title: 'Real-Time Site Telemetry',
                desc: 'Field engineers log pour volumes and progress on-device. Data syncs to HQ dashboards instantly — even offline.'
              },
              {
                title: 'Material Sourcing Desk',
                desc: 'Automated supplier matching locks pre-approved rates before stock hits critical levels.'
              },
              {
                title: 'IPC Claim Automation',
                desc: 'Verified field quantities generate interim payment certificates in minutes, not weeks.'
              },
              {
                title: 'Earned Value Monitoring',
                desc: 'BCWP vs ACWP curves surfaced across every active project. Spot overruns before they compound.'
              },
              {
                title: 'Audit-Ready Compliance',
                desc: 'Immutable records, digital signatures, and full chain-of-custody from soil to certificate.'
              }
            ].map((cap, idx) => (
              <div 
                key={idx}
                className="p-5.5 bg-slate-900/40 border border-slate-900 rounded-2xl hover:border-primary/25 hover:bg-slate-900/60 transition-all duration-300 text-left flex gap-4"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 text-xs font-mono font-bold">
                  0{idx + 1}
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-bold text-white mb-1">{cap.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-normal">{cap.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Key Stats & Live Network Monitor */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-6">
            
            {/* Key stats cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Field Sync', value: '4.2s', detail: 'Avg. data sync speed', border: 'border-primary/20', text: 'text-primary' },
                { label: 'IPC Cycles', value: '−65%', detail: 'Claim processing delay', border: 'border-cyan-500/20', text: 'text-cyan-400' },
                { label: 'Materials', value: '−15%', detail: 'Bulk raw waste reduction', border: 'border-emerald-500/20', text: 'text-emerald-400' },
                { label: 'Admin Hours', value: '28hr', detail: 'Weekly times reclaimed', border: 'border-amber-500/20', text: 'text-amber-400' }
              ].map((stat, idx) => (
                <div 
                  key={idx}
                  className={`p-5 bg-slate-950/40 border ${stat.border} rounded-2xl text-left flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-all`}
                >
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">{stat.label}</span>
                  <div className="my-1.5">
                    <span className={`text-2xl sm:text-3xl font-mono font-black ${stat.text}`}>{stat.value}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight font-normal">{stat.detail}</span>
                </div>
              ))}
            </div>

            {/* Live Network Status Box */}
            <div className="p-6 bg-slate-950/70 border border-slate-900 rounded-3xl text-left flex flex-col gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/[0.01] rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-900">
                <span className="text-xs font-mono font-bold text-slate-400 tracking-wider uppercase">Live Network Status</span>
                <span className="text-[9px] font-mono text-primary font-bold px-2 py-0.5 bg-primary/10 border border-primary/20 rounded">ONLINE STATE</span>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  { name: 'Nairobi Central Site A', status: 'SYNCED', active: true, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                  { name: 'Mombasa Road Corridor', status: 'SYNCED', active: true, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                  { name: 'Thika Bypass Zone 3', status: 'PENDING', active: false, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
                ].map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-200">{item.name}</span>
                    <span className={`text-[10px] font-mono font-black tracking-widest px-2.5 py-1 rounded-md border ${item.color} flex items-center gap-1.5`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>



      {/* PROCESS ACTION & SITE APP SIMULATOR (Solves "videos / demo actions of processes") */}
      <section id="demo-actions" className="py-24 px-6 max-w-7xl mx-auto scroll-mt-10 relative z-10">
        <div className="absolute top-10 left-10 w-44 h-44 bg-primary/[0.02] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-44 h-44 bg-cyan-500/[0.02] rounded-full blur-3xl pointer-events-none" />

        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-mono font-black text-primary uppercase tracking-widest mb-3">Live Site Activity & Simulator Console</div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            See your multi-site operations update in real time
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            See how daily field activities instantly update your jobsite records and cost sheets. Select a scenario below to see the interactive flow.
          </p>
        </div>

        {/* Demo Selection Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {[
            { id: 'field-sync', label: '1. On-Site Ground Progress Sync', color: 'from-primary/10 to-primary/20 text-primary' },
            { id: 'material-bid', label: '2. Concrete Reorder & Bid Approvals', color: 'from-blue-500/10 to-blue-500/20 text-blue-400' },
            { id: 'ipc-audit', label: '3. Instant Multi-Project Cost Checklist', color: 'from-cyan-500/10 to-cyan-500/20 text-cyan-400' },
          ].map((demo) => (
            <button
              key={demo.id}
              onClick={() => switchProcessDemo(demo.id as any)}
              className={`px-5 py-3 rounded-xl border text-xs font-black transition-all uppercase tracking-wider cursor-pointer ${
                activeProcessDemo === demo.id 
                  ? 'bg-slate-900 border-primary/45 text-primary shadow-xl shadow-primary/10' 
                  : 'bg-slate-950/60 border-slate-900 hover:border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {demo.id === activeProcessDemo && <span className="inline-block w-2 h-2 bg-primary rounded-full animate-ping mr-2" />}
              {demo.label}
            </button>
          ))}
        </div>

        {/* Outer Device Visual Sandbox */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center bg-slate-950/40 border border-slate-900/60 rounded-3xl p-6 md:p-10 relative overflow-hidden backdrop-blur-md">
          
          {/* Animated Process Logs Display (Left pane) */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <HardHat className="w-5 h-5 text-primary" />
              <span className="text-xs font-mono font-extrabold text-slate-400 uppercase tracking-widest">Interactive Process Timeline</span>
            </div>

            <p className="text-sm font-semibold text-slate-200">
              {activeProcessDemo === 'field-sync' && "Field site managers log piling excavation volumes natively via on-site devices."}
              {activeProcessDemo === 'material-bid' && "Automatic stock depletion triggers vendor matches, locking pre-approved contractor rates."}
              {activeProcessDemo === 'ipc-audit' && "Computing consolidated financial curves based on verified actual field quantities."}
            </p>

            {/* Timelines stepper vertical logs with pulsing nodes */}
            <div className="flex flex-col gap-4 mt-2">
              {[
                { label: 'Step 1: On-Site Field Record', desc: 'Engineer uploads concrete core pour metrics inside the Ceflot app.' },
                { label: 'Step 2: State Synchronization', desc: 'Quantities and materials update securely in the cloud to keep everyone in sync.' },
                { label: 'Step 3: Executive Warning Solver', desc: 'The budget manager flags potential overruns before they impact profits.' },
                { label: 'Step 4: Certified Audit Locking', desc: 'The system records verified quantities and creates instant, audit-ready payment files.' }
              ].map((stepItem, idx) => {
                const isStepActive = idx === demoStep;
                return (
                  <div 
                    key={idx} 
                    className={`flex gap-3.5 items-start border-l-2 pl-4 transition-all duration-300 ${
                      isStepActive 
                        ? 'border-primary text-white' 
                        : 'border-slate-900 text-slate-500'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-mono font-black uppercase tracking-wider ${isStepActive ? 'text-primary' : 'text-slate-600'}`}>
                        {stepItem.label}
                      </span>
                      <span className="text-xs leading-normal mt-0.5">{stepItem.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Timeline controls */}
            <div className="flex items-center gap-4 mt-2 pb-2">
              <button 
                onClick={() => setIsPlayingDemo(!isPlayingDemo)}
                className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-black uppercase tracking-wider text-slate-300 hover:text-white rounded-lg cursor-pointer flex items-center gap-2 transition-all active:scale-95"
              >
                {isPlayingDemo ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    <span>Pause Feed</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 text-primary fill-primary" />
                    <span>Resume Feed</span>
                  </>
                )}
              </button>
              <span className="text-[10px] font-mono text-zinc-500">Auto-ticking intervals</span>
            </div>
          </div>

          {/* Interactive Digital Twin Telemetry Viewport (Right pane) */}
          <div className="lg:col-span-8 bg-slate-950/80 border border-slate-900 rounded-2xl p-5 md:p-8 relative min-h-[460px] flex flex-col justify-between overflow-hidden shadow-2xl">
            
            {/* Ambient Background Grid Pattern overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#020617_1px,transparent_1px),linear-gradient(to_bottom,#020617_1px,transparent_1px)] bg-[size:16px_16px] opacity-25 pointer-events-none" />
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/[0.02] rounded-full blur-3xl pointer-events-none" />
            
            {/* Telemetry Viewport Header */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4 text-[10px] font-mono text-slate-500 relative z-10">
              <span className="flex items-center gap-2 text-slate-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                <span>ACTIVE TWIN VIEWPORT: {activeProcessDemo.toUpperCase()}_LEDGER_FEED</span>
              </span>
              <span className="text-primary">STATUS: CONCURRENT PIPELINES LOCKED</span>
            </div>

            {/* Dynamic Highly-Visual Simulator Core Displays */}
            <div className="flex-1 flex flex-col justify-center py-4 relative z-10">
              
              {activeProcessDemo === 'field-sync' && (
                <div className="flex flex-col gap-6 w-full max-w-xl mx-auto">
                   {/* Glowing 3D CAD Wireframe Simulation of Piling Column */}
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl relative overflow-hidden">
                    <div className="absolute top-2 right-2 text-[8px] font-mono text-primary uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                      <span>CAD_SYS_ONLINE</span>
                    </div>

                    <h4 className="text-xs font-mono font-bold text-slate-300 mb-4 tracking-wider">PIER_04 STRUCTURAL TWINBlueprints</h4>
                    
                    {/* Visual representation of structural pile blocks filling with concrete */}
                    <div className="grid grid-cols-4 gap-2 h-28 items-end mb-4">
                      {[
                        { sec: 'A-Base', height: 'h-[30%]', filledStep: 0 },
                        { sec: 'B-Mid', height: 'h-[60%]', filledStep: 1 },
                        { sec: 'C-Core', height: 'h-[85%]', filledStep: 2 },
                        { sec: 'D-Joint', height: 'h-[100%]', filledStep: 3 },
                      ].map((item, index) => {
                        const isFilled = demoStep >= item.filledStep;
                        return (
                          <div key={index} className="flex flex-col items-center gap-2 h-full justify-end bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                            <span className="text-[8px] font-mono text-zinc-500 text-center uppercase">{item.sec}</span>
                            <div className="w-full bg-slate-900 h-16 rounded overflow-hidden relative border border-slate-950">
                              <motion.div 
                                className={`w-full absolute bottom-0 left-0 bg-gradient-to-t from-primary/40 to-primary ${item.height}`}
                                initial={{ scaleY: 0 }}
                                animate={{ scaleY: isFilled ? 1 : 0 }}
                                transition={{ duration: 0.6 }}
                              />
                              {isFilled && (
                                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/25 via-transparent to-transparent animate-pulse" />
                              )}
                            </div>
                            <span className={`text-[9px] font-mono font-bold ${isFilled ? 'text-primary' : 'text-zinc-650'}`}>
                              {isFilled ? 'POURED' : 'PENDING'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Telemetry Readout Logs */}
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-400 leading-normal">
                      <div className="flex justify-between border-b border-slate-900 pb-1.5 mb-1.5">
                        <span className="text-zinc-500">MEMBER_CODE: PB049_H</span>
                        <span className="text-primary font-bold">STRENGTH_TNS: Type 3 (32.4 MPa)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>EST_QTY: 45.0m³</span>
                        <span className="text-white">VERIFIED ACTUAL: {(demoStep + 1) * 11.25}m³ poured</span>
                      </div>
                    </div>
                  </div>

                  {/* Operational diagnostics state */}
                  <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">Consolidated Profit & Loss Shift:</span>
                    <span className="font-bold font-mono text-primary">+$1,450 Variance Normal</span>
                  </div>
                </div>
              )}

              {activeProcessDemo === 'material-bid' && (
                <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
                  {/* Automated Supplier Sourcing Radar Grid */}
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl relative overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      
                      {/* Radar Screen Visualizer */}
                      <div className="relative w-full aspect-square max-w-[170px] mx-auto rounded-full border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden">
                        {/* Radar Grid lines */}
                        <div className="absolute w-[80%] h-[80%] rounded-full border border-slate-900" />
                        <div className="absolute w-[50%] h-[50%] rounded-full border border-slate-900" />
                        <div className="absolute w-[20%] h-[20%] rounded-full border border-slate-900" />
                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-900" />
                        <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-900" />
                           {/* Rotating Radar Sweep Blade */}
                        <div className="absolute inset-0 border-r border-primary/20 origin-center animate-spin" style={{ animationDuration: '4s' }} />

                        {/* Blip markers */}
                        <div className="absolute top-[25%] left-[30%] w-2 h-2 rounded-full bg-primary animate-ping" />
                        <div className="absolute top-[25%] left-[30%] w-2 h-2 rounded-full bg-primary" />

                        <div className="absolute bottom-[20%] right-[25%] w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        <div className="absolute bottom-[20%] right-[25%] w-2 h-2 rounded-full bg-cyan-500" />
                        
                        <div className="absolute top-[10%] left-[10%] text-[8px] font-mono text-primary font-bold uppercase tracking-wider">RADAR_OPS</div>
                      </div>

                      {/* Sourcing Rates Table */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">Live Sourcing Matches:</span>
                        {[
                          { name: 'Apex Materials Inc.', price: '$12.20 / bag', distance: '12.4 mi', code: 'RATE_LOCKED' },
                          { name: 'Metro Bulk Minerals', price: '$12.45 / bag', distance: '18.9 mi', code: 'CONTRACTED' }
                        ].map((supplier, idx) => (
                          <div key={idx} className="p-2.5 bg-slate-950/80 border border-slate-900 rounded-lg flex justify-between items-center text-xs">
                            <div className="text-left">
                              <span className="font-bold text-white block leading-none">{supplier.name}</span>
                              <span className="text-[8px] font-mono text-slate-500 mt-1 block">Dist: {supplier.distance}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-primary block font-bold">{supplier.price}</span>
                              <span className="text-[8px] px-1 py-0.5 bg-slate-900 text-zinc-400 border border-slate-800 rounded font-mono uppercase tracking-tight block mt-1">{supplier.code}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>

                    {/* Status Alert Overlay */}
                    <div className="mt-4 p-3 bg-amber-950/20 border border-amber-900/30 rounded-lg flex justify-between items-center text-[10px] font-mono">
                      <span className="text-amber-400 font-bold uppercase tracking-wide flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                        <span>Warning: Portland Cement Below Threshold (15 Bags Left)</span>
                      </span>
                      <span className="text-zinc-500">MEMBER_049</span>
                    </div>

                  </div>
                </div>
              )}

              {activeProcessDemo === 'ipc-audit' && (
                <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
                  {/* Dynamic Financial Earned Value Comparison curve chart */}
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl relative overflow-hidden text-left">
                    <span className="text-[10px] font-mono text-slate-400 block mb-3 uppercase tracking-wider">Earned Value Operating Index</span>
                    
                    {/* SVG Curve chart representing BCWP vs ACWP */}
                    <div className="relative h-28 w-full border-b border-l border-slate-800 mb-2">
                      <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                        {/* Grid lines */}
                        <line x1="0" y1="20" x2="100%" y2="20" stroke="rgba(255,255,255,0.03)" />
                        <line x1="0" y1="50" x2="100%" y2="50" stroke="rgba(255,255,255,0.03)" />
                        <line x1="0" y1="80" x2="100%" y2="80" stroke="rgba(255,255,255,0.03)" />
                        
                        {/* Reference baseline curve (Planned Budget) */}
                        <motion.path 
                          d="M 10 110 Q 150 90, 300 30 T 600 10" 
                          fill="none" 
                          stroke="rgba(255,255,255,0.15)" 
                          strokeWidth="2.5" 
                          strokeDasharray="6, 6"
                        />

                        {/* Actual Verified Earned Value curve (Ceflot Sync) */}
                        <motion.path 
                          d="M 10 110 Q 150 90, 300 30 T 600 10" 
                          fill="none" 
                          stroke="url(#evCurveColor)" 
                          strokeWidth="3.5"
                          style={{
                            pathLength: Math.min(1, (demoStep + 1) * 0.25)
                          }}
                          transition={{ duration: 0.8 }}
                        />

                        <defs>
                          <linearGradient id="evCurveColor" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#1aacaa" />
                            <stop offset="100%" stopColor="#22d3ee" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>

                    <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-4">
                      <span>PHASE 1 START</span>
                      <span>CURRENT SESSIONS AUDITING</span>
                      <span>PHASE 2 TARGET</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                      <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
                        <span className="text-zinc-500">PLANNED (BCWS):</span>
                        <span className="text-slate-350 font-bold">$1.45M</span>
                      </div>
                      <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
                        <span className="text-primary">EARNED (BCWP):</span>
                        <span className="text-primary font-bold">$1.48M</span>
                      </div>
                    </div>
                  </div>

                  {/* Certified transactional progress block */}
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-cyan-950/50 text-cyan-400 rounded-lg flex items-center justify-center shrink-0 border border-cyan-500/25">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-200 block leading-tight">Monthly invoice approved</span>
                        <span className="text-[9px] text-zinc-500 font-mono block mt-1">CERTIFICATE ID: REF-47B5-D23D</span>
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  </div>
                </div>
              )}

            </div>

            {/* Video Player Style Progress Bar */}
            <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-2">
                <Bookmark className="w-3.5 h-3.5 text-primary" />
                <span>Multi-Site digital twin in perfect alignment</span>
              </span>
              <span>TIME STATUS: LIVE TRANSIT STATED</span>
            </div>
          </div>

        </div>
      </section>

      {/* INTERACTIVE CONSTRUCTION TWIN - HIGH RESOLUTION GROUND IMAGERY GRID */}
      <section className="py-24 px-6 max-w-7xl mx-auto scroll-mt-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-mono font-black text-primary uppercase tracking-widest mb-3">Live Civil Siting Visualizer</div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Seamless multi-project visual integration
          </h2>
          <p className="text-slate-400 mt-4 max-w-2xl mx-auto">
            View live physical updates captured directly by site engineers. Every structural asset, concrete pour, and machinery milestone syncs seamlessly with corporate accounting records.
          </p>
        </div>

        {/* Creative, asymmetrical bento image grid with technical status overlays */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          <div className="md:col-span-7 group relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/60 min-h-[340px]">
            <img 
              src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=800" 
              alt="Concrete steel rebar placement site"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/[0.02] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 text-primary rounded-lg text-[9px] font-mono uppercase tracking-wider font-bold">STATE: COMPRESSION TESTING</span>
            </div>
            <div className="absolute bottom-6 left-6 right-6">
              <h3 className="text-lg font-bold text-white mb-2">Structure & Concrete Formworks</h3>
              <p className="text-xs text-slate-400 leading-normal max-w-md">Verify rebar tensile and pour ratios on-site. Linking mix blueprints saves millions in structural liability disputes.</p>
              <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-3 border-t border-slate-900">
                <span>GPS CODE: AP-094-E</span>
                <span className="text-primary">BOQ SEC: 03-3000 Poured</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 group relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/60 min-h-[340px]">
            <img 
              src="https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?q=80&w=800" 
              alt="Civil Superintendent engineer checking measurements"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-65 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
            <div className="absolute top-4 left-4">
              <span className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg text-[9px] font-mono uppercase tracking-wider font-bold">ACTIVE AUDITING</span>
            </div>
            <div className="absolute bottom-6 left-6 right-6">
              <h3 className="text-lg font-bold text-white mb-2">Interim Quantities Certification</h3>
              <p className="text-xs text-slate-400 leading-normal">Superintendents log actual quantities verified directly inside the Ceflot canvas, pre-empting subcontractor double-claims.</p>
              <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-3 border-t border-slate-900">
                <span>GPS CODE: BT-301-W</span>
                <span className="text-cyan-400">Interim Certified IFC_09</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 group relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/60 min-h-[340px]">
            <img 
              src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=800" 
              alt="Skyscraper crane structural works"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
            <div className="absolute top-4 left-4">
              <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[9px] font-mono uppercase tracking-wider font-bold">RESOURCE FLOW</span>
            </div>
            <div className="absolute bottom-6 left-6 right-6">
              <h3 className="text-lg font-bold text-white mb-2">Cranes & Heavy Equipment Logs</h3>
              <p className="text-xs text-slate-400 leading-normal">Monitor and lock continuous fuel outputs, operational schedules, and active idle alerts on-site.</p>
              <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-3 border-t border-slate-900">
                <span>GPS CODE: GA-14-Y</span>
                <span className="text-amber-400">Log cycle: 100% Sync</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-7 group relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/60 min-h-[340px]">
            <img 
              src="https://images.unsplash.com/photo-1590069261209-f8e9b8642343?q=80&w=800" 
              alt="Excavator site preparation works"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-65 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
            <div className="absolute top-4 left-4">
              <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 text-primary rounded-lg text-[9px] font-mono uppercase tracking-wider font-bold">STATE: FOUNDATIONS EXCAVATING</span>
            </div>
            <div className="absolute bottom-6 left-6 right-6">
              <h3 className="text-lg font-bold text-white mb-2">Civil Siting & Early Ground Clearing</h3>
              <p className="text-xs text-slate-400 leading-normal max-w-md">Instantly establish baseline cost estimate matrices the moment excavation units move. Sync ground progress with regional office ledgers in standard 3-taps.</p>
              <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-3 border-t border-slate-900">
                <span>GPS CODE: SL-448-S</span>
                <span className="text-primary">Phase 01 Earthworks Complete</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* REVOLUTIONARY ROI CALCULATOR */}
      <section id="roi-engine" className="py-24 px-6 bg-slate-950/40 border-y border-slate-900 scroll-mt-10">
        <div className="max-w-7xl mx-auto">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Intro text */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="text-xs font-mono font-black text-primary uppercase tracking-widest">Immediate Yield Modeling</div>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-none">
                Compute Your Custom Operational Yield
              </h2>
              <p className="text-slate-400 leading-relaxed">
                We engineered this ROI model specifically for high-growth commercial contractors managing concurrent physical sites and multi-project pipelines. Adjust the values to map your exact yearly volume.
              </p>

              <div className="flex flex-col gap-5 mt-2">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-300">
                    <span>Yearly Operational Volume:</span>
                    <span className="font-mono text-primary text-sm">{formatCurrency(portfolioSize)}</span>
                  </div>
                  <input
                    type="range"
                    min={500000}
                    max={15000000}
                    step={250000}
                    value={portfolioSize}
                    onChange={(e) => setPortfolioSize(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>$500K</span>
                    <span>$7.5M Regional Scale</span>
                    <span>$15M Enterprise CAP</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-300">
                    <span>Concurrent Active Projects:</span>
                    <span className="font-mono text-cyan-400 text-sm">{activeSites} Sites</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={activeSites}
                    onChange={(e) => setActiveSites(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>1 Project</span>
                    <span>5 Sites</span>
                    <span>10 Max Projects</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Calculations metrics grid Display (Right column) */}
            <div className="lg:col-span-7 bg-slate-900/40 border border-slate-900 rounded-3xl p-6 md:p-10 grid grid-cols-1 sm:grid-cols-2 gap-6 shadow-2xl relative">
              <div className="absolute top-0 right-0 w-72 h-72 bg-primary/[0.02] rounded-full blur-3xl pointer-events-none" />
              
              <div className="p-5 bg-slate-950 border border-slate-900 rounded-2xl flex flex-col gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wide">Materials Waste Reduction</span>
                <span className="text-2xl font-mono font-black text-white">{formatCurrency(potentialWastageSavings)}</span>
                <p className="text-[10px] text-slate-500 leading-normal">Safeguard Grade-42 cement, rebar quantities, and structural assets from waste or theft.</p>
              </div>

              <div className="p-5 bg-slate-950 border border-slate-900 rounded-2xl flex flex-col gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wide">Claim Disputes Preempted</span>
                <span className="text-2xl font-mono font-black text-white">{formatCurrency(potentialClaimsLossAvoided)}</span>
                <p className="text-[10px] text-slate-500 leading-normal">Stop subcontractor discrepancies using clear photo audit sync timestamps.</p>
              </div>

              <div className="p-5 bg-slate-950 border border-slate-900 rounded-2xl flex flex-col gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wide">Manual Admin Hours Saved</span>
                <span className="text-2xl font-mono font-black text-white">{administrativeHoursSaved} Hrs</span>
                <p className="text-[10px] text-slate-500 leading-normal">Save vital hours compiling logs and cross-project Excel tables.</p>
              </div>

              <div className="p-5 bg-slate-950 border border-slate-900 rounded-2xl flex flex-col gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wide">Cash Flow Acceleration</span>
                <span className="text-2xl font-mono font-black text-white">-{cashFlowAccelerationDays} Days</span>
                <p className="text-[10px] text-slate-500 leading-normal">Speed up certified payment cycles to protect operating liquidity margins.</p>
              </div>

              {/* Combined Total value callout box */}
              <div className="sm:col-span-2 p-5 bg-primary/10 border border-primary/20 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 mt-2">
                <div>
                  <span className="text-xs text-slate-300 font-bold block">Estimated Combined Annual Operating Value Safeguarded</span>
                  <span className="text-[10px] text-zinc-500 block">Based on a localized 3-project performance index.</span>
                </div>
                <span className="text-3xl font-mono font-black text-primary leading-none">
                  {formatCurrency(potentialWastageSavings + potentialClaimsLossAvoided)}
                </span>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* MID-SCALE STRATEGIC VALUES AUDIT (Deep features explanation tailored to user's requested level of details) */}
      <section id="mid-scale-value" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-mono font-black text-primary uppercase tracking-widest mb-3">Enterprise Engineering Audit</div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
            How we solve the mid-market delivery crunch
          </h2>
          <p className="text-slate-400 mt-4 leading-relaxed">
            Contractors scaling complex multi-project workloads often yield margin loss during expansion because traditional software is either too heavy or too basic. Ceflot is calibrated uniquely for mid-market commercial workflows:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1: Multi-Project Margin Protection */}
          <div className="p-6 bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-2xl flex flex-col gap-4 group transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Prevent Cross-Site Cost Slippages</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              When managing 3 active projects, cost overruns at Site A often go unnoticed until profits from Site B and Site C are wiped out. Ceflot auto-aggregates Cost Variance dynamically, signaling alerting red markers the instant material logs exceed BOQ allocations.
            </p>
          </div>

          {/* Card 2: 3-Tap Mobile Site Input Webview App */}
          <div className="p-6 bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-2xl flex flex-col gap-4 group transition-colors">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <HardHat className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Rugged Field App WebView Parity</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              Most construction personnel refuse complex software. Our Mobile site view requires zero training: logged concrete pours, machinery fuel meters, and subcontractor checkouts occur in 3 simple taps with immediate backend Postgres syncing.
            </p>
          </div>

          {/* Card 3: Direct Sourcing rate locks */}
          <div className="p-6 bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-2xl flex flex-col gap-4 group transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Automated Material Balance Trigger</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              Avoid construction suspensions. The Ceflot Sourcing desk monitors materials stock in real-time. Link low balances directly to contracted supplier invoices to auto-generate and stamp pre-approved Purchase Orders in seconds.
            </p>
          </div>

        </div>
      </section>

      {/* FINAL CONVERSION CALL TO ACTION WITH THE GLOW PANEL */}
      <section className="py-24 px-6 max-w-7xl mx-auto text-center relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-[110px]" />
        
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-900 rounded-3xl p-12 max-w-4xl mx-auto flex flex-col items-center relative overflow-hidden">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mb-6">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Reclaim Absolute Multi-Project Control
          </h2>
          <p className="text-slate-400 max-w-xl leading-relaxed mb-8">
            Create an active encrypted workspace today. Log your concurrent projects, parse baseline estimates, coordinate sourcing bid quotes, and accelerate certifications instantly.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md">
            <button 
              onClick={() => openAuthWithTab('signup')}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-xl shadow-emerald-500/15 cursor-pointer flex items-center justify-center gap-2 transition-colors text-sm uppercase tracking-wider"
            >
              <span>Onboard Your Workspace</span>
              <Check className="w-4 h-4" />
            </button>
            <button 
              onClick={() => openAuthWithTab('signin')}
              className="w-full sm:w-auto px-8 py-4 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl cursor-pointer transition-colors text-sm uppercase tracking-wider"
            >
              <span>Access Dashboard</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer Branded Area */}
      <footer className="border-t border-slate-900/60 py-12 px-6 bg-slate-950 text-xs text-slate-500 max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3 select-none">
          <div className="w-8 h-5 flex items-center justify-center text-primary animate-pulse">
            <CeflotLogo className="w-8 h-5" />
          </div>
          <span className="font-extrabold text-white tracking-tight uppercase">CEFLOT INDUSTRIES INC.</span>
          <span>·</span>
          <span>100% SECURE WORKSPACE</span>
        </div>
        <p className="text-slate-600">© 2026 Ceflot. Suppressing cost overruns and optimizing project profitability.</p>
      </footer>


      {/* AUTHENTICATION OVERLAY MODAL */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Backdrop cover */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            {/* Central Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-[420px] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col"
            >
              {/* Top Bar / Header */}
              <div className="p-5 border-b border-slate-800/80 bg-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-5 text-primary">
                    <CeflotLogo className="w-8 h-5 animate-pulse" />
                  </div>
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                    {authTab === 'signin' ? 'Sign In to Portal' : 'Register New Tenant'}
                  </span>
                </div>
                <button 
                  onClick={() => setShowAuthModal(false)}
                  className="p-1 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs selector */}
              <div className="grid grid-cols-2 text-center text-xs font-bold border-b border-slate-850">
                <button
                  type="button"
                  onClick={() => { setAuthTab('signin'); setErrorMsg(''); setSuccessMsg(''); }}
                  className={`py-3 ${authTab === 'signin' ? 'text-primary border-b-2 border-primary bg-slate-900/50' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('signup'); setErrorMsg(''); setSuccessMsg(''); }}
                  className={`py-3 ${authTab === 'signup' ? 'text-primary border-b-2 border-primary bg-slate-900/50' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Create Account
                </button>
              </div>

              {/* Scrollable form holder */}
              <form onSubmit={handleAuthSubmit} className="p-6 flex flex-col gap-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                
                {authTab === 'signup' && (
                  <>
                    {/* Full Name field */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                      <div className="relative">
                        <Users className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Project Director Name"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl text-xs p-3.5 pl-10 text-white outline-none focus:border-primary transition-colors"
                          required
                        />
                      </div>
                    </div>

                    {/* Company Setting Toggle */}
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Company / Tenant</label>
                        <button
                          type="button"
                          onClick={() => setIsNewCompany(!isNewCompany)}
                          className="text-[9px] text-primary hover:underline font-bold"
                        >
                          {isNewCompany ? 'Choose Existing' : 'Create New Company'}
                        </button>
                      </div>

                      {isNewCompany ? (
                        <div className="relative animate-fade-in">
                          <Building className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                          <input
                            type="text"
                            value={customCompanyName}
                            onChange={(e) => setCustomCompanyName(e.target.value)}
                            placeholder="Enter New Company Name"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl text-xs p-3.5 pl-10 text-white outline-none focus:border-primary transition-colors"
                            required
                          />
                        </div>
                      ) : (
                        <div className="relative animate-fade-in">
                          <Building className="w-4 h-4 text-slate-500 absolute left-3 top-3.5 pointer-events-none" />
                          <select
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl text-xs p-3.5 pl-10 text-white appearance-none outline-none focus:border-primary transition-colors"
                            required
                          >
                            <option value="47b5d23d-f030-4edd-9310-4760163cb184">Primary Civil Siting Sector</option>
                            <option value="c1784ed8-7f42-47f3-85d1-f1de64734573">Commercial Infrastructure Division</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Email field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl text-xs p-3.5 pl-10 text-white outline-none focus:border-primary transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl text-xs p-3.5 pl-10 pr-10 text-white outline-none focus:border-primary transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error Box display */}
                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl text-xs leading-relaxed">
                    {errorMsg}
                  </div>
                )}

                {/* Success Box display */}
                {successMsg && (
                  <div className="p-3 bg-primary/10 border border-primary/20 text-slate-200 rounded-xl text-xs leading-relaxed">
                    {successMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 mt-2 bg-primary border border-primary/20 hover:bg-primary-hover text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-primary/10 active:scale-95 disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{authTab === 'signin' ? 'Sign In To Account' : 'Onboard & Register'}</span>
                </button>

                <div className="text-center text-[10px] text-slate-500 mt-2 font-mono">
                  100% SECURE & ENCRYPTED CONNECTION
                </div>

              </form>

            </motion.div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
