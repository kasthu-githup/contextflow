import React, { useState, useEffect } from 'react';

import { 
  FolderHeart, 
  Search, 
  Film, 
  Flame, 
  MessageSquareQuote, 
  Youtube, 
  SearchCode, 
  Lightbulb, 
  Copy, 
  Trash2, 
  Download, 
  Edit3, 
  Save, 
  X, 
  Clock, 
  Sparkles,
  ExternalLink,
  Lock,
  ShieldCheck,
  LogIn,
  Bot,
  MessageCircle,
  Tag,
  ArrowRight,
  Sliders,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { ContentItem, ContextThread } from '../types';
import { AIActionToolbar } from './AIActionToolbar';

interface MyContentViewProps {
  initialSelectId?: string;
  initialSearch?: string;
  onNavigate?: (page: string, params?: Record<string, any>) => void;
}

export const MyContentView: React.FC<MyContentViewProps> = ({ 
  initialSelectId, 
  initialSearch,
  onNavigate 
}) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const { copied, success, error, info } = useToast();

  // Primary Tab: 'content' | 'threads'
  const [activeVaultTab, setActiveVaultTab] = useState<'content' | 'threads'>('content');

  // Content Items
  const [items, setItems] = useState<ContentItem[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [activeTypeFilter, setActiveTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState(initialSearch || '');
  
  // Selected Content Item for Detail / Edit
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Context Threads (ChatGPT Sessions)
  const [threads, setThreads] = useState<ContextThread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [selectedThread, setSelectedThread] = useState<ContextThread | null>(null);

  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearchQuery(initialSearch);
    }
  }, [initialSearch]);

  // Load Content Items strictly for the logged-in user
  const loadContent = async () => {
    if (!user) {
      setItems([]);
      setSelectedItem(null);
      setIsLoadingContent(false);
      return;
    }

    setIsLoadingContent(true);
    try {
      const res = await api.getContent({
        type: activeTypeFilter === 'all' ? undefined : activeTypeFilter,
        search: searchQuery.trim() || undefined,
        userId: user.id
      });

      // Strict client-side verification: ONLY items belonging to this specific user
      const userValidIds = new Set<string>([user.id]);
      if ((user as any).google_id) userValidIds.add((user as any).google_id);
      if (user.email) userValidIds.add(user.email.toLowerCase().trim());

      const userItems = (res.items || []).filter(item => {
        if (!item.user_id) return false;
        const uid = item.user_id.trim();
        return userValidIds.has(uid) || (user.email && uid.toLowerCase() === user.email.toLowerCase().trim());
      });

      setItems(userItems);

      if (initialSelectId && !selectedItem) {
        const found = userItems.find(i => i.id === initialSelectId);
        if (found) {
          handleSelectItem(found);
        }
      }
    } catch (err) {
      console.warn('Could not load content library', err);
      setItems([]);
    } finally {
      setIsLoadingContent(false);
    }
  };

  // Load Context Threads strictly for the logged-in user
  const loadThreads = async () => {
    if (!user) {
      setThreads([]);
      setSelectedThread(null);
      setIsLoadingThreads(false);
      return;
    }

    setIsLoadingThreads(true);
    try {
      const res = await api.getContextThreads(user.id);
      
      const userValidIds = new Set<string>([user.id]);
      if ((user as any).google_id) userValidIds.add((user as any).google_id);
      if (user.email) userValidIds.add(user.email.toLowerCase().trim());

      const userOnlyThreads = (res.threads || []).filter((t: ContextThread) => {
        if (!t.user_id) return false;
        const uid = t.user_id.trim();
        return userValidIds.has(uid) || (user.email && uid.toLowerCase() === user.email.toLowerCase().trim());
      });

      setThreads(userOnlyThreads);
      if (userOnlyThreads.length > 0 && !selectedThread) {
        setSelectedThread(userOnlyThreads[0]);
      }
    } catch (err) {
      console.warn('Could not load context threads in My Content', err);
      setThreads([]);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  useEffect(() => {
    loadContent();
    loadThreads();
  }, [user?.id, user?.email, activeTypeFilter, searchQuery]);

  const handleSelectItem = (item: ContentItem) => {
    setSelectedItem(item);
    setEditTitle(item.title);
    setEditContent(item.content);
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    setIsSavingEdit(true);
    try {
      const res = await api.updateContent(selectedItem.id, {
        title: editTitle,
        content: editContent
      });
      setSelectedItem(res.item);
      setItems(prev => prev.map(i => i.id === res.item.id ? res.item : i));
      success('Changes saved successfully!');
    } catch (err: any) {
      error(err.message || 'Failed to update item');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.deleteContent(id);
      setItems(prev => prev.filter(i => i.id !== id));
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
      success('Item deleted from your library');
    } catch (err: any) {
      error(err.message || 'Failed to delete');
    }
  };

  const handleDeleteThread = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this context session?')) return;
    try {
      await api.deleteContextThread(id);
      setThreads(prev => prev.filter(t => t.id !== id));
      if (selectedThread?.id === id) {
        setSelectedThread(null);
      }
      success('Context session deleted');
    } catch (err: any) {
      error(err.message || 'Failed to delete context session');
    }
  };

  const handleDownload = (item: ContentItem) => {
    const blob = new Blob([item.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(item.title || 'content').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    info('Exported as Markdown file');
  };

  const typeIcons: Record<string, any> = {
    reel: Film,
    hook: Flame,
    caption: MessageSquareQuote,
    youtube: Youtube,
    seo: SearchCode,
    ideas: Lightbulb,
    general: Sparkles
  };

  // Filter threads by search query
  const filteredThreads = threads.filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const inTitle = t.title.toLowerCase().includes(q);
    const inProfile = (t.contextProfile.name || '').toLowerCase().includes(q) ||
                      (t.contextProfile.niche || '').toLowerCase().includes(q);
    const inMessages = t.messages.some(m => m.content.toLowerCase().includes(q));
    return inTitle || inProfile || inMessages;
  });

  if (!user) {
    return (
      <div id="my-content-root" className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
        <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 mb-5 shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
            Private Content History Vault
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Your generated content, context sessions, and search history are completely confidential and only visible to you. Please sign in to your personal account to view your vault.
          </p>
          <button
            onClick={() => openAuthModal('login')}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-indigo-500/20 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Sign In to Access Your Vault
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="my-content-root" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-bold uppercase tracking-wider">
              <FolderHeart className="w-3.5 h-3.5" /> Content Vault
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-[11px] font-semibold">
              <Lock className="w-3 h-3" /> Private to {user.name || user.email}
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Content & Context History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Strictly isolated to your account. Search your saved social media assets and ChatGPT-style context sessions.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="content-library-search-input"
            type="text"
            placeholder={`Search your private vault...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Main Tab Navigation: Saved Content vs Context Studio Sessions */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveVaultTab('content')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeVaultTab === 'content'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FolderHeart className="w-4 h-4" />
            <span>Saved Content & Scripts ({items.length})</span>
          </button>

          <button
            id="btn-tab-context-sessions"
            type="button"
            onClick={() => setActiveVaultTab('threads')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeVaultTab === 'threads'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Context Sessions & ChatGPT History ({threads.length})</span>
          </button>
        </div>

        {onNavigate && activeVaultTab === 'threads' && (
          <button
            type="button"
            onClick={() => onNavigate('context-studio')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold rounded-xl shadow-2xs hover:shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open Context Studio</span>
          </button>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          TAB 1: SAVED CONTENT & SCRIPTS
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeVaultTab === 'content' && (
        <div className="space-y-6">
          {/* Sub-Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'all', label: 'All Items' },
              { id: 'reel', label: '🎬 Reels' },
              { id: 'hook', label: '🔥 Viral Hooks' },
              { id: 'caption', label: '📝 Captions' },
              { id: 'youtube', label: '▶️ YouTube' },
              { id: 'seo', label: '🔍 SEO' },
              { id: 'ideas', label: '💡 Ideas' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTypeFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  activeTypeFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Grid: List (Left) & Detail Editor (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Items List (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>
                  {searchQuery ? `Found ${items.length} of your items` : `${items.length} Private Items`}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Click to inspect & edit</span>
              </div>

              <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
                {isLoadingContent ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loading your private vault...</div>
                ) : items.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    {searchQuery
                      ? `No items matching "${searchQuery}" in your personal library.`
                      : "You haven't saved any content yet. Generate reels, hooks, or captions to build your private vault!"}
                  </div>
                ) : (
                  items.map(item => {
                    const isSelected = selectedItem?.id === item.id;
                    const Icon = typeIcons[item.type] || Sparkles;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className={`p-4 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected 
                            ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                              {item.type}
                            </span>
                            <span className="text-[10px] text-slate-400 capitalize">{item.platform}</span>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {item.title || item.topic}
                          </h4>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-sans">
                            {item.content.replace(/[#*`_]/g, '')}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(item.content);
                              copied();
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Copy"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(item.id, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Detail / Editor (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden min-h-[620px] flex flex-col justify-between">
              {selectedItem ? (
                <>
                  {/* Header */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full font-bold text-xs sm:text-sm text-slate-900 bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none"
                      />
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                        <span className="capitalize">{selectedItem.type}</span>
                        <span>•</span>
                        <span className="capitalize">{selectedItem.platform}</span>
                        <span>•</span>
                        <span className="capitalize">{selectedItem.language}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        id="btn-copy-selected-item"
                        onClick={() => {
                          navigator.clipboard.writeText(editContent);
                          copied();
                        }}
                        className="p-1.5 px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy</span>
                      </button>

                      <button
                        id="btn-save-edited-item"
                        onClick={handleSaveEdit}
                        disabled={isSavingEdit}
                        className="p-1.5 px-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>

                      <button
                        onClick={() => handleDownload(selectedItem)}
                        className="p-1.5 px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span>Export</span>
                      </button>
                    </div>
                  </div>

                  {/* AI Quick Toolbar */}
                  <div className="p-3 bg-slate-50/80 border-b border-slate-100">
                    <AIActionToolbar
                      content={editContent}
                      onContentUpdated={(newText: string) => setEditContent(newText)}
                    />
                  </div>

                  {/* Textarea */}
                  <div className="p-4 flex-1">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={18}
                      className="w-full text-xs sm:text-sm font-sans leading-relaxed text-slate-800 bg-transparent border-none focus:outline-none resize-none"
                    />
                  </div>

                  {/* Footer Meta */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{editContent.length} characters • ~{editContent.split(/\s+/).filter(Boolean).length} words</span>
                    <span>Created: {new Date(selectedItem.created_at).toLocaleDateString()}</span>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center my-auto space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <FolderHeart className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">Select an item from the list</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Choose any of your saved reels, viral hooks, captions or outlines to edit, format with AI, or export.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          TAB 2: CONTEXT SESSIONS & CHATGPT HISTORY
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeVaultTab === 'threads' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Thread List (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>
                  {searchQuery ? `Found ${filteredThreads.length} context sessions` : `${threads.length} Private Context Sessions`}
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Strictly isolated</span>
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
                {isLoadingThreads ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loading your context history...</div>
                ) : filteredThreads.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs space-y-3">
                    <Bot className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-600">
                      {searchQuery ? `No context sessions matching "${searchQuery}"` : 'No context sessions created yet'}
                    </p>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('context-studio')}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 cursor-pointer"
                      >
                        Launch Context Studio
                      </button>
                    )}
                  </div>
                ) : (
                  filteredThreads.map(thread => {
                    const isSelected = selectedThread?.id === thread.id;
                    const lang = thread.contextProfile.language === 'thanglish' ? 'Tanglish' :
                                 thread.contextProfile.language === 'tamil' ? 'தமிழ்' : 'English';

                    return (
                      <div
                        key={thread.id}
                        onClick={() => setSelectedThread(thread)}
                        className={`p-4 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected 
                            ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {thread.contextProfile.type}
                            </span>
                            <span className="text-[10px] text-slate-400">{lang}</span>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-[10px] text-slate-400">{thread.messages.length} msgs</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {thread.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {thread.messages.length > 0 
                              ? thread.messages[thread.messages.length - 1].content 
                              : `Target: ${thread.contextProfile.targetAudience}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {onNavigate && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('context-studio', { threadId: thread.id });
                              }}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Resume in Context Studio"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteThread(thread.id, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Thread Details & Conversation Viewer (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden min-h-[620px] flex flex-col justify-between">
              {selectedThread ? (
                <>
                  {/* Header */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-600" />
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {selectedThread.title}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-500">
                        <span>Audience: <b>{selectedThread.contextProfile.targetAudience}</b></span>
                        <span>•</span>
                        <span>Tone: <b>{selectedThread.contextProfile.tone}</b></span>
                        <span>•</span>
                        <span>Niche: <b>{selectedThread.contextProfile.niche}</b></span>
                      </div>
                    </div>

                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('context-studio', { threadId: selectedThread.id })}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      >
                        <span>Chat in this Context</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Conversation History Stream */}
                  <div className="p-4 sm:p-6 flex-1 overflow-y-auto max-h-[500px] space-y-4 custom-scrollbar">
                    {selectedThread.messages.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No messages exchanged in this session yet. Click "Chat in this Context" to begin!
                      </div>
                    ) : (
                      selectedThread.messages.map((m, idx) => {
                        const isUser = m.role === 'user';
                        return (
                          <div
                            key={m.id || idx}
                            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                              <span>{isUser ? 'You' : 'ContentFlow AI'}</span>
                              <span>•</span>
                              <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed max-w-[85%] ${
                              isUser 
                                ? 'bg-indigo-600 text-white rounded-tr-xs' 
                                : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs whitespace-pre-wrap'
                            }`}>
                              {m.content}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer Meta */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{selectedThread.messages.length} messages in memory</span>
                    <span>Updated: {new Date(selectedThread.updated_at).toLocaleDateString()}</span>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center my-auto space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <Bot className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">Select a context session</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Click any session on the left to inspect previous prompts, responses, and context settings.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
