import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MessageSquare, Send, User, Clock, Trash2, Reply } from 'lucide-react';
import { cn, isValidUUID } from '../lib/utils';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  category: string;
  user_profiles: {
    full_name: string;
  };
}

interface CollaborationFeedProps {
  projectId: string;
  tenantId: string;
  category?: string;
}

export function CollaborationFeed({ projectId, tenantId, category = 'budget' }: CollaborationFeedProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadComments();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('project_comments')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'project_comments',
        filter: `project_id=eq.${projectId}`
      }, () => {
        loadComments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const loadComments = async () => {
    const { data, error } = await supabase
      .from('project_comments')
      .select('*, user_profiles(full_name)')
      .eq('project_id', projectId)
      .eq('category', category)
      .order('created_at', { ascending: true });

    if (!error) setComments(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('project_comments')
        .insert({
          project_id: projectId,
          tenant_id: tenantId,
          user_id: user.id,
          content: newComment,
          category
        });

      if (error) throw error;
      setNewComment('');
    } catch (e: any) {
      alert('Error posting comment: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (!isValidUUID(id)) return;
    
    const { error } = await supabase
      .from('project_comments')
      .delete()
      .eq('id', id);
    
    if (error) alert('Error deleting: ' + error.message);
  };

  return (
    <div className="flex flex-col h-full bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-border-subtle bg-surface-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-main">Budget Discussions</h3>
        </div>
        <span className="text-[10px] text-ghost font-mono">{comments.length} Messages</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageSquare className="w-8 h-8 text-border-subtle mb-2" />
            <p className="text-xs text-ghost">No discussions yet. Start the conversation!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="group animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-ghost" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-dim">{comment.user_profiles?.full_name || 'System User'}</span>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] text-ghost">{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button onClick={() => deleteComment(comment.id)} className="text-ghost hover:text-danger p-0.5">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-surface-2 border border-border-subtle rounded-lg rounded-tl-none p-2.5 text-xs text-main leading-relaxed shadow-sm">
                    {comment.content}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-surface-2 border-t border-border-subtle">
        <div className="relative">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Type a message..."
            className="w-full bg-surface-1 border border-border-subtle rounded-lg pl-4 pr-10 py-2.5 text-xs text-main focus:ring-1 focus:ring-primary outline-none transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
