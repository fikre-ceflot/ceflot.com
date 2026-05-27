import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { 
  User, 
  Mail, 
  Lock, 
  Shield, 
  Check, 
  X, 
  AlertCircle, 
  Loader2,
  Key,
  Smartphone,
  Globe
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ProfileProps {
  profile: UserProfile;
  tenantName: string;
  onProfileUpdate: (updated: UserProfile) => void;
}

export function Profile({ profile, tenantName, onProfileUpdate }: ProfileProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    full_name: profile.full_name || '',
    phone: '', // Add phone to schema if needed, but for now just UI
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          full_name: formData.full_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;
      
      onProfileUpdate(data);
      setSuccess('Profile updated successfully.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;
      
      setSuccess('Password changed successfully.');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border-subtle flex items-center justify-center text-primary text-2xl font-bold">
            {profile.full_name?.split(' ').map(n => n[0]).join('') || '?'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-main">{profile.full_name || 'Your Profile'}</h1>
            <p className="text-ghost flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" />
              {tenantName}
              <span className="w-1 h-1 rounded-full bg-border-subtle" />
              <Shield className="w-3.5 h-3.5 text-accent-2" />
              {profile.role?.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger text-sm p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-primary/10 border border-primary/20 text-primary text-sm p-4 rounded-xl flex items-center gap-3">
            <Check className="w-5 h-5 flex-shrink-0" />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* General Information */}
          <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border-subtle bg-surface-2">
              <h2 className="text-sm font-bold text-main uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-accent-2" />
                General Information
              </h2>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-ghost">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <input 
                    type="text"
                    required
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl text-sm p-2.5 pl-10 outline-none focus:border-primary transition-all text-main"
                    value={formData.full_name}
                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 opacity-60">
                <label className="text-[11px] font-medium uppercase tracking-wider text-ghost">Email Address (Managed by Admin)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <input 
                    type="email"
                    disabled
                    className="w-full bg-surface-base border border-border-subtle rounded-xl text-sm p-2.5 pl-10 outline-none cursor-not-allowed text-main"
                    defaultValue={profile.email}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="btn btn-accent btn-sm mt-4"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Save Profile
              </button>
            </form>
          </div>

          {/* Security & Password */}
          <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border-subtle bg-surface-2">
              <h2 className="text-sm font-bold text-main uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-warning" />
                Security & Password
              </h2>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-ghost">New Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <input 
                    type="password"
                    required
                    minLength={6}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl text-sm p-2.5 pl-10 outline-none focus:border-warning transition-all text-main"
                    value={passwordData.newPassword}
                    onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-ghost">Confirm Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <input 
                    type="password"
                    required
                    minLength={6}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl text-sm p-2.5 pl-10 outline-none focus:border-warning transition-all text-main"
                    value={passwordData.confirmPassword}
                    onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="btn btn-sm mt-4 bg-warning/10 text-warning border-warning/20 hover:bg-warning/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Change Password
              </button>
            </form>
          </div>
        </div>

        {/* Account Metadata */}
        <div className="bg-surface-1/50 border border-border-subtle rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-[10px] font-mono text-ghost uppercase tracking-widest mb-1">User ID</div>
              <div className="text-xs font-mono text-ghost break-all">{profile.id}</div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-ghost uppercase tracking-widest mb-1">Account Created</div>
              <div className="text-xs text-main">{new Date(profile.created_at).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-ghost uppercase tracking-widest mb-1">Last Updated</div>
              <div className="text-xs text-main">{new Date(profile.updated_at || profile.created_at).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
