import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Plus, 
  Trash2, 
  Search, 
  Sliders, 
  Copy, 
  Check, 
  FolderHeart, 
  Film, 
  Flame, 
  MessageSquareQuote, 
  Youtube, 
  RotateCcw, 
  Lock, 
  ShieldCheck, 
  Globe, 
  ChevronDown, 
  Clock, 
  Settings2, 
  Info, 
  Wand2, 
  Share2, 
  X,
  Layers,
  MessageCircle,
  HelpCircle,
  Zap,
  Tag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { ContextThread, ContextProfile, ChatMessage, ContextType } from '../types';

interface ContextStudioViewProps {
  initialThreadId?: string;
  onNavigateToContent?: () => void;
}

// Preset context configurations for instant switching like ChatGPT custom GPTs
const CONTEXT_PRESETS: {
  id: string;
  name: string;
  type: ContextType;
  description: string;
  tone: string;
  language: 'english' | 'tamil' | 'thanglish';
  targetAudience: string;
  niche: string;
  customInstructions: string;
  starterPrompts: string[];
}[] = [
  {
    id: 'preset-tanglish-reels',
    name: 'Viral Reels Creator (Tanglish)',
    type: 'entertainment',
    description: 'High-energy spoken Tanglish scripts with punchy psychological hooks and retention hacks.',
    tone: 'Colloquial & High Energy',
    language: 'thanglish',
    targetAudience: 'Tamil youth, Instagram & YouTube Shorts viewers',
    niche: 'Lifestyle, Tech & Entertainment',
    customInstructions: 'Speak in colloquial Tanglish (Tamil written in English script). Use popular trending Tamil colloquial words like "machi", "bro", "scroll panradha niruthunga", "idha check pannunga". Structure reels into 0-3s Hook, 3-45s Value/Drama, 45-60s Call to Action.',
    starterPrompts: [
      'Write a 60-second viral reel script on "Top 3 hidden Android features"',
      'Give me 5 punchy Tanglish hooks for a personal finance reel',
      'Create a funny relatable reel about working from home vs office in Chennai'
    ]
  },
  {
    id: 'preset-linkedin-authority',
    name: 'LinkedIn Thought Leader',
    type: 'saas',
    description: 'Data-driven, narrative business insights formatted for maximum reposts and comments.',
    tone: 'Authoritative, Inspiring & Analytical',
    language: 'english',
    targetAudience: 'Founders, CTOs, Executives & Tech Professionals',
    niche: 'B2B SaaS, AI & Startup Growth',
    customInstructions: 'Write compelling 1-line hooks with double spacing. Use concrete metrics, counter-intuitive opinions, and clean bullet lists. Avoid buzzword fluff. End with a debate-provoking question.',
    starterPrompts: [
      'Why 80% of AI wrappers will die this year and what wins instead',
      'Write a post sharing 5 harsh lessons learned from scaling to $1M ARR',
      'Breakdown of how modern engineering teams use automated CI/CD'
    ]
  },
  {
    id: 'preset-youtube-script',
    name: 'YouTube Long-form Strategist',
    type: 'education',
    description: 'Structured video breakdowns with timestamps, psychological open loops, and visual cues.',
    tone: 'Educational, Engaging & Methodical',
    language: 'english',
    targetAudience: 'Curious learners, self-taught creators & students',
    niche: 'Deep Dives & Skill Building',
    customInstructions: 'Always include [Visual Cue: ...] notes for the editor. Establish an open loop within the first 15 seconds. Structure into clear chapters with actionable explanations.',
    starterPrompts: [
      'Write an outline & intro for a 10-minute video: "How to Learn Python in 30 Days"',
      'Generate high-CTR YouTube video title ideas + thumbnail concepts for video marketing',
      'Script a compelling 90-second YouTube video intro that keeps retention at 80%+'
    ]
  },
  {
    id: 'preset-tamil-creator',
    name: 'Tamil Social Media Studio (தமிழ்)',
    type: 'personal',
    description: 'Pure conversational Tamil content for Facebook, Instagram, and YouTube creators.',
    tone: 'Authentic & Relatable',
    language: 'tamil',
    targetAudience: 'Tamil speaking audience worldwide',
    niche: 'Culture, Motivation & General Knowledge',
    customInstructions: 'இயல்பான நவீன தமிழில் உரையாடல் பாணியில் எழுதுங்கள். எளிய தமிழ் வார்த்தைகளையும் சமூக வலைதளங்களுக்கு ஏற்ற சுவாரஸ்யமான தலைப்புகளையும் பயன்படுத்துங்கள்.',
    starterPrompts: [
      'வாழ்க்கையில் வெற்றி பெற உதவும் 3 பழக்கங்கள் பற்றிய வீடியோ ஸ்கிரிப்ட் எழுதுங்கள்',
      'புதிய தொழில் தொடங்க நினைப்பவர்களுக்கான 5 பயனுள்ள ஆலோசனைகள்',
      'இன்ஸ்டாகிராம் ரீல்ஸிற்கான 3 கவர்ச்சிகரமான தமிழ் ஹூக்குகள் (Hooks)'
    ]
  },
  {
    id: 'preset-ecommerce-sales',
    name: 'DTC E-Commerce & Ad Copywriter',
    type: 'product',
    description: 'High-conversion ad angles, PAS (Problem-Agitate-Solve) formulas, and promotional copy.',
    tone: 'Persuasive, Urgent & Benefit-Driven',
    language: 'english',
    targetAudience: 'Online shoppers looking for immediate solutions',
    niche: 'Consumer Goods & Retail',
    customInstructions: 'Focus heavily on emotional transformation over raw features. Use the AIDA and PAS copywriting frameworks. Keep lines scannable with clear CTA buttons.',
    starterPrompts: [
      'Write 3 Meta ad variations (Hook + Body + CTA) for an ergonomic office chair',
      'Create a limited-time flash sale email campaign with high urgency',
      'Generate 5 viral TikTok organic video concept angles for a skincare product'
    ]
  }
];

export const ContextStudioView: React.FC<ContextStudioViewProps> = ({ 
  initialThreadId,
  onNavigateToContent 
}) => {
  const { user, stats, openUpgradeModal, openAuthModal } = useAuth();
  const { success, error, info, copied } = useToast();

  const [threads, setThreads] = useState<ContextThread[]>([]);
  const [activeThread, setActiveThread] = useState<ContextThread | null>(null);
  const [threadSearch, setThreadSearch] = useState('');
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);

  // Chat State
  const [messageInput, setMessageInput] = useState('');
  const [selectedContentType, setSelectedContentType] = useState('chat');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [savingMsgId, setSavingMsgId] = useState<string | null>(null);

  // Context Profile Drawer / Modal
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
  const [editedProfile, setEditedProfile] = useState<ContextProfile>({
    id: `cp_${Date.now()}`,
    name: 'My Brand Context',
    type: 'general',
    targetAudience: 'Creators & Tech Audience',
    language: 'english',
    tone: 'Conversational, Viral & Punchy',
    niche: 'Digital Content Creation',
    brandOrProductName: '',
    businessDescription: '',
    keyPoints: '',
    pricingOrOffer: '',
    uniqueSellingPoint: '',
    wordsToAvoid: '',
    customInstructions: ''
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeThread?.messages, isGenerating]);

  // Load User's Context Threads (Strictly filtered to this user only)
  const loadUserThreads = async () => {
    if (!user) {
      setThreads([]);
      setActiveThread(null);
      setIsLoadingThreads(false);
      return;
    }

    setIsLoadingThreads(true);
    try {
      const res = await api.getContextThreads(user.id);
      
      // Strict client verification: ONLY threads matching current user's ID or email
      const userValidIds = new Set<string>([user.id]);
      if ((user as any).google_id) userValidIds.add((user as any).google_id);
      if (user.email) userValidIds.add(user.email.toLowerCase().trim());

      const userOnlyThreads = (res.threads || []).filter((t: ContextThread) => {
        if (!t.user_id) return false;
        const uid = t.user_id.trim();
        return userValidIds.has(uid) || (user.email && uid.toLowerCase() === user.email.toLowerCase().trim());
      });

      setThreads(userOnlyThreads);

      if (userOnlyThreads.length > 0) {
        if (initialThreadId) {
          const match = userOnlyThreads.find((t: ContextThread) => t.id === initialThreadId);
          if (match) {
            setActiveThread(match);
            setEditedProfile(match.contextProfile);
            return;
          }
        }
        if (!activeThread) {
          setActiveThread(userOnlyThreads[0]);
          setEditedProfile(userOnlyThreads[0].contextProfile);
        }
      } else {
        // If user has no threads yet, auto-create their first isolated thread
        handleCreateNewThread('Viral Creator Context', CONTEXT_PRESETS[0]);
      }
    } catch (err) {
      console.warn('Could not load context threads:', err);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  useEffect(() => {
    loadUserThreads();
  }, [user?.id, user?.email]);

  // Create a brand new Context Thread
  const handleCreateNewThread = async (
    title = 'New Context Session', 
    preset?: typeof CONTEXT_PRESETS[0]
  ) => {
    if (!user) {
      openAuthModal();
      return;
    }

    const profileToUse: Partial<ContextProfile> = preset ? {
      name: preset.name,
      type: preset.type,
      targetAudience: preset.targetAudience,
      language: preset.language,
      tone: preset.tone,
      niche: preset.niche,
      customInstructions: preset.customInstructions
    } : {
      name: 'Custom Context Studio',
      type: 'general',
      targetAudience: 'My Target Audience',
      language: 'english',
      tone: 'Conversational, engaging, and impactful',
      niche: 'Digital Marketing & Content'
    };

    try {
      const res = await api.createContextThread({
        title,
        contextProfile: profileToUse
      });

      if (res?.thread) {
        setThreads(prev => [res.thread, ...prev.filter((t: ContextThread) => t.id !== res.thread.id)]);
        setActiveThread(res.thread);
        setEditedProfile(res.thread.contextProfile);
        success(`Created "${res.thread.title}" context session`);
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    } catch (err: any) {
      error(err.message || 'Failed to create context session');
    }
  };

  // Switch Active Thread
  const handleSelectThread = (thread: ContextThread) => {
    setActiveThread(thread);
    setEditedProfile(thread.contextProfile);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Save changes to Active Context Profile
  const handleSaveProfile = async () => {
    if (!activeThread) return;
    try {
      const res = await api.updateContextThread(activeThread.id, {
        title: editedProfile.name || activeThread.title,
        contextProfile: editedProfile
      });
      if (res?.thread) {
        setActiveThread(res.thread);
        setThreads(prev => prev.map((t: ContextThread) => t.id === res.thread.id ? res.thread : t));
        setIsConfigDrawerOpen(false);
        success('Context profile updated! AI will now generate using these exact rules.');
      }
    } catch (err: any) {
      error(err.message || 'Could not update context profile');
    }
  };

  // Apply a Preset to Current Active Thread
  const handleApplyPreset = (preset: typeof CONTEXT_PRESETS[0]) => {
    setEditedProfile({
      ...editedProfile,
      name: preset.name,
      type: preset.type,
      targetAudience: preset.targetAudience,
      language: preset.language,
      tone: preset.tone,
      niche: preset.niche,
      customInstructions: preset.customInstructions
    });
    info(`Loaded "${preset.name}" preset settings`);
  };

  // Delete Thread
  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this context session?')) return;
    try {
      await api.deleteContextThread(threadId);
      const remaining = threads.filter((t: ContextThread) => t.id !== threadId);
      setThreads(remaining);
      if (activeThread?.id === threadId) {
        if (remaining.length > 0) {
          setActiveThread(remaining[0]);
          setEditedProfile(remaining[0].contextProfile);
        } else {
          setActiveThread(null);
        }
      }
      success('Context session deleted');
    } catch (err: any) {
      error(err.message || 'Failed to delete session');
    }
  };

  // Clear Messages in Active Thread
  const handleClearMessages = async () => {
    if (!activeThread) return;
    if (!confirm('Clear all conversation messages in this context session?')) return;
    try {
      const res = await api.clearThreadMessages(activeThread.id);
      if (res?.thread) {
        setActiveThread(res.thread);
        setThreads(prev => prev.map((t: ContextThread) => t.id === res.thread.id ? res.thread : t));
        success('Conversation cleared');
      }
    } catch (err: any) {
      error(err.message || 'Failed to clear chat');
    }
  };

  // Send Message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || messageInput).trim();
    if (!text || isGenerating) return;

    if (!user) {
      openAuthModal();
      return;
    }

    let current = activeThread;
    if (!current) {
      await handleCreateNewThread('New Context Session');
      return;
    }

    setMessageInput('');
    setIsGenerating(true);

    // Optimistic user message append
    const tempUserMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      contentType: selectedContentType
    };

    setActiveThread(prev => prev ? {
      ...prev,
      messages: [...prev.messages, tempUserMsg]
    } : null);

    try {
      const res = await api.sendThreadMessage(current.id, text, selectedContentType);
      if (res?.modelMessage) {
        setActiveThread(prev => {
          if (!prev) return null;
          // Replace or append
          const hasUser = prev.messages.some(m => m.id === res.userMessage.id);
          const newMessages = hasUser
            ? [...prev.messages, res.modelMessage]
            : [...prev.messages.filter(m => m.id !== tempUserMsg.id), res.userMessage, res.modelMessage];
          
          return {
            ...prev,
            messages: newMessages,
            title: prev.title === 'New Context Session' && text.length > 3 
              ? (text.slice(0, 32) + (text.length > 32 ? '...' : '')) 
              : prev.title
          };
        });

        // Also update thread in sidebar list
        setThreads(prev => prev.map((t: ContextThread) => {
          if (t.id === current!.id) {
            return {
              ...t,
              messages: [...t.messages, res.userMessage, res.modelMessage],
              updated_at: new Date().toISOString()
            };
          }
          return t;
        }));
      }
    } catch (err: any) {
      error(err.message || 'Failed to generate response. Please try again.');
      // Remove optimistic message if failed
      setActiveThread(prev => prev ? {
        ...prev,
        messages: prev.messages.filter(m => m.id !== tempUserMsg.id)
      } : null);
    } finally {
      setIsGenerating(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Copy Message to Clipboard
  const handleCopyMessage = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    copied();
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Save Assistant Message to User's Private "My Content" Library
  const handleSaveToMyContent = async (msg: ChatMessage) => {
    if (!user) {
      openAuthModal();
      return;
    }
    setSavingMsgId(msg.id);
    try {
      const title = activeThread?.title 
        ? `${activeThread.title} - AI Output` 
        : `Context Studio - ${msg.contentType || 'Chat'}`;

      await api.saveContent({
        title,
        type: msg.contentType || 'general',
        platform: 'all',
        language: activeThread?.contextProfile.language || 'english',
        tone: activeThread?.contextProfile.tone || 'Conversational',
        topic: activeThread?.title || 'Context Studio Conversation',
        content: msg.content,
        meta: {
          contextProfileName: activeThread?.contextProfile.name,
          source: 'context-studio'
        }
      });

      success('Saved to your private Content Library!');
    } catch (err: any) {
      error(err.message || 'Failed to save to library');
    } finally {
      setSavingMsgId(null);
    }
  };

  // Filtered threads strictly for this user by search
  const filteredThreads = threads.filter(t => {
    if (!threadSearch.trim()) return true;
    const q = threadSearch.toLowerCase().trim();
    const inTitle = t.title.toLowerCase().includes(q);
    const inProfile = (t.contextProfile.name || '').toLowerCase().includes(q) ||
                      (t.contextProfile.niche || '').toLowerCase().includes(q);
    const inMessages = t.messages.some(m => m.content.toLowerCase().includes(q));
    return inTitle || inProfile || inMessages;
  });

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#fcfcfd] overflow-hidden">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          LEFT SIDEBAR: Context Threads & Sessions
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <aside className="w-80 border-r border-slate-200/90 bg-white flex flex-col shrink-0">
        {/* Header: New Session & Search */}
        <div className="p-3.5 border-b border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Context Studio</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <Lock className="w-3 h-3" />
              <span>Private to You</span>
            </div>
          </div>

          <button
            id="btn-new-context-session"
            type="button"
            onClick={() => handleCreateNewThread('New Context Session')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Context Session</span>
          </button>

          {/* Search User's Context History */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search your context history..."
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-400"
            />
            {threadSearch && (
              <button
                type="button"
                onClick={() => setThreadSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Context Presets Accordion */}
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Quick Start Presets
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CONTEXT_PRESETS.slice(0, 3).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleCreateNewThread(p.name, p)}
                className="shrink-0 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-lg shadow-2xs transition-colors text-left"
                title={p.description}
              >
                {p.name.split(' ')[0]} {p.name.split(' ')[1]}
              </button>
            ))}
          </div>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {isLoadingThreads ? (
            <div className="p-6 text-center text-xs text-slate-400 space-y-2">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading your private context threads...</p>
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 space-y-2">
              <MessageCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">No context sessions found</p>
              <p className="text-[11px]">
                {threadSearch ? 'Try a different search keyword' : 'Click "New Context Session" to get started'}
              </p>
            </div>
          ) : (
            filteredThreads.map(t => {
              const isActive = activeThread?.id === t.id;
              const msgCount = t.messages?.length || 0;
              const langBadge = t.contextProfile.language === 'thanglish' ? 'Tanglish' :
                                t.contextProfile.language === 'tamil' ? 'தமிழ்' : 'EN';

              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectThread(t)}
                  className={`group relative flex items-start justify-between gap-2 p-2.5 rounded-xl cursor-pointer transition-all ${
                    isActive 
                      ? 'bg-indigo-50/80 border border-indigo-200 shadow-2xs text-slate-900' 
                      : 'hover:bg-slate-50 border border-transparent text-slate-700'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
                        {langBadge}
                      </span>
                      <h4 className={`text-xs font-semibold truncate ${isActive ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {t.title}
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {t.messages.length > 0 
                        ? t.messages[t.messages.length - 1].content 
                        : t.contextProfile.niche || 'Empty session'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span>{msgCount} messages</span>
                      <span>•</span>
                      <span>{new Date(t.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteThread(t.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-all cursor-pointer"
                    title="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Profile Info */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5 truncate">
            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
              {(user?.name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <span className="truncate font-medium">{user?.email || 'Logged in user'}</span>
          </div>
          <button
            type="button"
            onClick={onNavigateToContent}
            className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <FolderHeart className="w-3 h-3" />
            <span>Library</span>
          </button>
        </div>
      </aside>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          CENTER / MAIN CHAT AREA (ChatGPT-Style Experience)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <main className="flex-1 flex flex-col bg-[#fcfcfd] min-w-0 relative">
        {/* Top Active Context Header Bar */}
        <div className="h-14 px-4 sm:px-6 bg-white border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {activeThread?.title || 'Context Studio'}
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  <Tag className="w-2.5 h-2.5" />
                  {activeThread?.contextProfile.type || 'General'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate hidden md:block">
                Target: <span className="font-medium text-slate-700">{activeThread?.contextProfile.targetAudience || 'Audience'}</span> • 
                Tone: <span className="font-medium text-slate-700">{activeThread?.contextProfile.tone || 'Engaging'}</span> • 
                Lang: <span className="font-medium text-slate-700 uppercase">{activeThread?.contextProfile.language || 'English'}</span>
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-edit-active-context"
              type="button"
              onClick={() => setIsConfigDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-600" />
              <span>Customize Context</span>
            </button>

            {activeThread && activeThread.messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearMessages}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Clear chat messages"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 custom-scrollbar">
          {(!activeThread || activeThread.messages.length === 0) ? (
            /* Empty State: ChatGPT Prompt suggestions */
            <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-500/20">
                <Sparkles className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Welcome to {activeThread?.contextProfile.name || 'Context Studio'}
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Ask anything, iterate on ideas, generate viral scripts, or brainstorm. 
                  Every generation remembers your active persona, audience, and instructions!
                </p>
              </div>

              {/* Starter Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
                {(CONTEXT_PRESETS.find(p => p.language === activeThread?.contextProfile.language)?.starterPrompts || [
                  'Write a 60-second high-retention reel script for my niche',
                  'Give me 5 viral hooks using psychological curiosity gaps',
                  'Create an engaging post outline for LinkedIn and Twitter',
                  'Translate and adapt my topic into punchy colloquial Tanglish'
                ]).map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="p-3 bg-white hover:bg-indigo-50/50 border border-slate-200/90 hover:border-indigo-300 rounded-xl text-xs text-slate-800 transition-all text-left shadow-2xs group cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium group-hover:text-indigo-900 leading-relaxed">
                        "{prompt}"
                      </span>
                      <Zap className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0 mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages List */
            <div className="max-w-3xl mx-auto space-y-6 pb-4">
              {activeThread.messages.map((msg, idx) => {
                const isUser = msg.role === 'user';

                return (
                  <div 
                    key={msg.id || idx}
                    className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/20 text-xs font-bold mt-1">
                        AI
                      </div>
                    )}

                    <div className={`max-w-[85%] rounded-2xl p-4 space-y-2 shadow-2xs leading-relaxed ${
                      isUser 
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs' 
                        : 'bg-white border border-slate-200/90 text-slate-900 rounded-tl-xs'
                    }`}>
                      {/* Message Content */}
                      <div className="text-xs sm:text-sm whitespace-pre-wrap font-sans">
                        {msg.content}
                      </div>

                      {/* Footer Actions on AI Messages */}
                      {!isUser && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="flex items-center gap-1 px-2 py-1 hover:bg-slate-100 rounded-md text-[11px] font-medium text-slate-600 transition-colors cursor-pointer"
                            >
                              {copiedMsgId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSaveToMyContent(msg)}
                              disabled={savingMsgId === msg.id}
                              className="flex items-center gap-1 px-2 py-1 hover:bg-indigo-50 hover:text-indigo-600 rounded-md text-[11px] font-medium text-slate-600 transition-colors cursor-pointer"
                              title="Save to My Content library"
                            >
                              <FolderHeart className="w-3 h-3" />
                              <span>{savingMsgId === msg.id ? 'Saving...' : 'Save to Library'}</span>
                            </button>
                          </div>

                          <span className="text-[10px] text-slate-400">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 text-xs font-bold mt-1 shadow-2xs">
                        {(user?.name || user?.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Generating indicator */}
              {isGenerating && (
                <div className="flex items-start gap-3 justify-start">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/20 text-xs font-bold animate-pulse">
                    AI
                  </div>
                  <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs p-4 flex items-center gap-2 text-xs text-slate-500 shadow-2xs">
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="font-medium text-indigo-700 ml-1">
                      Thinking in "{activeThread?.contextProfile.name || 'Context'}"...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            CHAT INPUT COMPOSER
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200/80 shrink-0">
          <div className="max-w-3xl mx-auto space-y-2">
            {/* Quick Content Type Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
              <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider mr-1">Mode:</span>
              {[
                { id: 'chat', label: '💬 General Chat' },
                { id: 'reel', label: '🎬 Reel Script' },
                { id: 'hook', label: '🔥 Viral Hook' },
                { id: 'caption', label: '📝 Caption' },
                { id: 'youtube', label: '📺 YouTube Outline' },
                { id: 'ad', label: '🚀 Ad Angle' }
              ].map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelectedContentType(mode.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    selectedContentType === mode.id
                      ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-center bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 rounded-2xl transition-all shadow-2xs"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={`Ask, iterate, or generate scripts in "${activeThread?.contextProfile.name || 'this context'}"...`}
                className="w-full pl-4 pr-12 py-3 text-xs sm:text-sm bg-transparent border-none focus:outline-none resize-none placeholder:text-slate-400 max-h-32"
              />

              <button
                id="btn-send-context-message"
                type="submit"
                disabled={!messageInput.trim() || isGenerating}
                className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl shadow-2xs transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Send message (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Press <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200">Enter</kbd> to send, <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200">Shift+Enter</kbd> for newline</span>
              <span className="flex items-center gap-1 text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span>Isolated private session</span>
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          RIGHT DRAWER: Customize Context Profile
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {isConfigDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsConfigDrawerOpen(false)}
          />

          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Customize Context Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Presets Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-100">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                Load Ready-made Context Preset:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {CONTEXT_PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="p-1.5 text-[11px] font-medium bg-white border border-slate-200 rounded-lg hover:border-indigo-400 hover:text-indigo-600 text-slate-700 text-left transition-all truncate"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
              {/* Context Name */}
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Context / Session Name</label>
                <input
                  type="text"
                  value={editedProfile.name}
                  onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                  placeholder="e.g. My Tech Startup, Tamil Comedy Reel"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Language Selection */}
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Language Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'english', label: 'English' },
                    { id: 'thanglish', label: 'Thanglish / Tanglish' },
                    { id: 'tamil', label: 'தமிழ் (Tamil)' }
                  ].map(lang => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => setEditedProfile({ ...editedProfile, language: lang.id as any })}
                      className={`py-2 px-2 rounded-xl text-center font-medium border transition-all cursor-pointer ${
                        editedProfile.language === lang.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Niche / Industry */}
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Niche / Industry</label>
                <input
                  type="text"
                  value={editedProfile.niche}
                  onChange={(e) => setEditedProfile({ ...editedProfile, niche: e.target.value })}
                  placeholder="e.g. Fitness Coaching, Digital Marketing, Travel"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Target Audience */}
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Target Audience</label>
                <input
                  type="text"
                  value={editedProfile.targetAudience}
                  onChange={(e) => setEditedProfile({ ...editedProfile, targetAudience: e.target.value })}
                  placeholder="e.g. Busy college students, Solopreneurs, Moms"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Tone */}
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Tone of Voice</label>
                <input
                  type="text"
                  value={editedProfile.tone}
                  onChange={(e) => setEditedProfile({ ...editedProfile, tone: e.target.value })}
                  placeholder="e.g. High energy, funny, authoritative, relatable"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Brand or Product Name */}
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Brand / Product Name (Optional)</label>
                <input
                  type="text"
                  value={editedProfile.brandOrProductName || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, brandOrProductName: e.target.value })}
                  placeholder="e.g. NitroFlow, ContentFlow Pro"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Custom System Instructions */}
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Custom System Instructions</label>
                <textarea
                  rows={3}
                  value={editedProfile.customInstructions || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, customInstructions: e.target.value })}
                  placeholder="e.g. Always structure scripts with 0-3s Hook, 3-30s Body, and call to action. Never use robotic transitions."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>

              {/* Words to Avoid */}
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Words / Clichés to Avoid</label>
                <input
                  type="text"
                  value={editedProfile.wordsToAvoid || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, wordsToAvoid: e.target.value })}
                  placeholder="e.g. In today's fast paced world, delve, game changer"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfigDrawerOpen(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-save-context-profile"
                type="button"
                onClick={handleSaveProfile}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
              >
                Apply to This Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
