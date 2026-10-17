import React, { useState } from 'react';
import { 
  MessageSquareQuote, 
  Sparkles, 
  Copy, 
  Bookmark, 
  RotateCw, 
  Hash, 
  Globe, 
  Target, 
  Loader2,
  Pin,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { Platform, Language, Tone, CtaOption } from '../types';
import { AIActionToolbar } from './AIActionToolbar';

export const CaptionGeneratorView: React.FC = () => {
  const { deductCreditLocal, openUpgradeModal } = useAuth();
  const { copied, success, error } = useToast();

  const [topic, setTopic] = useState('');
  const [contextDetails, setContextDetails] = useState('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [language, setLanguage] = useState<Language>('english');
  const [tone, setTone] = useState<Tone>('Conversational');
  const [cta, setCta] = useState<CtaOption>('DM');
  const [isSavingVoice, setIsSavingVoice] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [captionOutput, setCaptionOutput] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveAsPermanentContext = async () => {
    const textToSave = (contextDetails.trim() || topic.trim());
    if (!textToSave) {
      error('Please write some context or topic before saving permanently.');
      return;
    }
    setIsSavingVoice(true);
    try {
      await api.updateBrandVoice({
        business_description: textToSave,
        is_active: true
      });
      success('Context saved permanently! All future captions will strictly adhere to this context.');
    } catch (err: any) {
      error(err.message || 'Failed to save permanent context');
    } finally {
      setIsSavingVoice(false);
    }
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) {
      error('Please enter a caption topic or post context');
      return;
    }

    setIsGenerating(true);
    setIsSaved(false);

    try {
      const res = await api.generateContent({
        topic,
        context: contextDetails.trim() || undefined,
        contentType: 'caption',
        platform,
        language,
        tone,
        cta,
        useBrandVoice: true,
        autoSave: true
      });

      if (res.success) {
        setCaptionOutput(res.content);
        setIsSaved(true);
        deductCreditLocal(res.credits.remaining, res.credits.limit, res.credits.used);
        // Explicitly guarantee database persistence
        api.saveContent({
          title: `Caption: ${topic}`,
          type: 'caption',
          platform,
          language,
          tone,
          topic,
          content: res.content,
        }).catch(() => {});
        success('Captions and hashtags generated and saved to library!');
      }
    } catch (err: any) {
      if (err.status === 403 || err.message?.includes('Credit limit')) {
        openUpgradeModal();
      } else {
        error(err.message || 'Caption generation failed');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && topic.trim()) {
        handleGenerate();
      }
    }
  };

  return (
    <div id="caption-generator-root" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200 font-sans">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-100 rounded-full text-purple-700 text-xs font-semibold uppercase tracking-wider mb-2">
          <MessageSquareQuote className="w-3.5 h-3.5" /> High-Engagement Copy
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Social Captions & Hashtag Suite
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Generate short and long-form captions with engaging hooks, line breaks, clear call-to-actions, and 15+ curated hashtags.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form (4 cols) */}
        <form onSubmit={handleGenerate} className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-800">
                Post Topic / Content Summary <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Enter ↵ to send • Shift+Enter for new line
              </span>
            </div>
            <textarea
              id="caption-topic-input"
              rows={2}
              required
              placeholder="What is your post about? (e.g. 5 lessons from bootstrapping my digital agency to ₹10L/month)"
              value={topic}
              onKeyDown={handleKeyDown}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full p-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100 focus:outline-none resize-none leading-relaxed transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Context & Nuances */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Specific Context & Details (Optional)</span>
              </label>
              <button
                type="button"
                onClick={handleSaveAsPermanentContext}
                disabled={isSavingVoice || (!contextDetails.trim() && !topic.trim())}
                className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40"
                title="Save this context permanently to your brand voice persona"
              >
                <Pin className="w-3 h-3" />
                <span>{isSavingVoice ? 'Saving...' : 'Set as Permanent Context'}</span>
              </button>
            </div>
            <textarea
              id="caption-context-input"
              rows={3}
              placeholder="Provide exact offer, client results, hashtags preference, or key bullet points to strictly include in the caption..."
              value={contextDetails}
              onChange={(e) => setContextDetails(e.target.value)}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100 focus:outline-none resize-none leading-relaxed transition-all placeholder:text-slate-400"
            />
            <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Strict context fidelity permanently enabled
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Platform</label>
            <select
              id="caption-platform-select"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none font-medium"
            >
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="x">X (Twitter)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Language</label>
            <select
              id="caption-language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none font-medium"
            >
              <option value="english">🇺🇸 English</option>
              <option value="tamil">🇮🇳 Tamil (தமிழ்)</option>
              <option value="thanglish">🗣️ Thanglish (Spoken)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tone of Voice</label>
            <select
              id="caption-tone-select"
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none font-medium"
            >
              <option value="Conversational">Conversational & Relatable</option>
              <option value="Professional">Professional & Authority</option>
              <option value="Storytelling">Personal Story</option>
              <option value="Educational">Educational Value</option>
              <option value="Emotional">Emotional & Vulnerable</option>
              <option value="Bold">Bold / Hot Take</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Call to Action (CTA)</label>
            <select
              id="caption-cta-select"
              value={cta}
              onChange={(e) => setCta(e.target.value as CtaOption)}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none font-medium"
            >
              <option value="DM">"DM me for details"</option>
              <option value="Comment">"Drop a comment below"</option>
              <option value="Visit Website">"Link in bio"</option>
              <option value="Follow">"Save & follow for more"</option>
              <option value="Generate automatically">Automatic AI CTA</option>
            </select>
          </div>

          <button
            id="btn-generate-caption-submit"
            type="submit"
            disabled={isGenerating}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md shadow-purple-500/20 hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Writing Captions...</span>
              </>
            ) : (
              <>
                <MessageSquareQuote className="w-4 h-4" />
                <span>Generate Captions & Tags</span>
              </>
            )}
          </button>
        </form>

        {/* Right Output (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden flex flex-col min-h-[560px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-900">
              Captions & Hashtags Preview
            </span>

            {captionOutput && (
              <div className="flex items-center gap-1.5">
                <button
                  id="btn-copy-captions"
                  onClick={() => {
                    navigator.clipboard.writeText(captionOutput);
                    copied('Captions copied to clipboard');
                  }}
                  className="p-1.5 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1 bg-white shadow-2xs cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy All</span>
                </button>

                <button
                  onClick={() => handleGenerate()}
                  disabled={isGenerating}
                  className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 border border-slate-200 rounded-lg transition-colors bg-white shadow-2xs cursor-pointer"
                  title="Regenerate"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 p-5 flex flex-col">
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                <h4 className="text-sm font-semibold text-slate-800">Drafting Captions & Tags...</h4>
                <p className="text-xs text-slate-400 max-w-xs">Structuring hooks, readability breaks, and hashtag clusters.</p>
              </div>
            ) : captionOutput ? (
              <div className="flex-1 flex flex-col">
                {/* User Prompt Message Bubble */}
                {topic && (
                  <div className="mb-4 p-3 bg-slate-100/70 border border-slate-200/60 rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1">Your Post Summary:</div>
                    <p className="text-xs text-slate-800 font-medium leading-relaxed">{topic}</p>
                  </div>
                )}

                <textarea
                  id="caption-output-textarea"
                  value={captionOutput}
                  onChange={(e) => {
                    setCaptionOutput(e.target.value);
                    setIsSaved(false);
                  }}
                  className="w-full flex-1 min-h-[380px] p-4 text-xs sm:text-sm font-sans text-slate-800 bg-slate-50/50 border border-slate-200/80 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100 focus:outline-none resize-y leading-relaxed"
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
                <MessageSquareQuote className="w-8 h-8 text-slate-300" />
                <p className="text-xs text-slate-500">Fill in your post topic on the left to generate short & long captions with hashtags.</p>
              </div>
            )}
          </div>

          {captionOutput && (
            <AIActionToolbar
              content={captionOutput}
              onContentUpdated={(newContent) => {
                setCaptionOutput(newContent);
                setIsSaved(false);
              }}
              disabled={isGenerating}
            />
          )}
        </div>
      </div>
    </div>
  );
};
