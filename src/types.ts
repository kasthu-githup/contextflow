export type ModuleId =
  | "dashboard-overview"
  | "ai-content-generator"
  | "reels-script"
  | "viral-hooks"
  | "social-captions"
  | "youtube-suite"
  | "seo-article"
  | "content-ideas"
  | "content-library"
  | "settings";

export interface SavedContentItem {
  id: string;
  moduleId: Exclude<ModuleId, "dashboard-overview" | "content-library" | "settings">;
  moduleName: string;
  prompt: string;
  language: string;
  tone: string;
  createdAt: string;
  structured: any;
  isFavorite?: boolean;
}

export interface UserSettings {
  creatorName: string;
  brandNiche: string;
  defaultLanguage: string;
  defaultTone: string;
  targetAudience: string;
  brandVoiceNotes: string;
  ttsVoice: "Kore" | "Puck" | "Charon" | "Fenrir" | "Zephyr";
  autoSaveToLibrary: boolean;
}

export interface ModuleConfig {
  id: Exclude<ModuleId, "dashboard-overview" | "content-library" | "settings">;
  title: string;
  shortTitle: string;
  subtitle: string;
  placeholder: string;
  quickPrompts: string[];
  badgeText: string;
}

export const MODULE_CONFIGS: Record<
  Exclude<ModuleId, "dashboard-overview" | "content-library" | "settings">,
  ModuleConfig
> = {
  "ai-content-generator": {
    id: "ai-content-generator",
    title: "AI Content Generator",
    shortTitle: "AI Content Generator",
    subtitle: "Ask any question, topic, or creative brief via voice or text and get complete, structured AI answers & ready-to-use content.",
    placeholder: "Ask anything or describe what you want to create (e.g., 'Explain how AI agents work for small businesses and write a post about it' or speak in Tamil/Tanglish/English)...",
    quickPrompts: [
      "How to grow a personal brand on Instagram & LinkedIn in 2026 from scratch",
      "Explain Artificial Intelligence tools for college students in simple Tanglish",
      "Write a high-converting product launch announcement for a new SaaS productivity app",
      "Top 5 passive income skills for freelance creators with step-by-step action plan"
    ],
    badgeText: "Universal AI Studio"
  },
  "reels-script": {
    id: "reels-script",
    title: "Reels & Shorts Script Generator",
    shortTitle: "Reels & Shorts Script",
    subtitle: "Generate high-retention 30s, 60s, or 90s vertical video scripts with timecoded visual cues, spoken audio, and on-screen text.",
    placeholder: "Enter your Reel or YouTube Short topic (e.g., '3 hidden smartphone camera tricks most people don't know')...",
    quickPrompts: [
      "3 free AI websites that feel illegal to know for creators",
      "Stop making this mistake when editing Instagram Reels in 2026",
      "Day in the life of a solo tech founder building an app in 60 seconds",
      "How to save ₹10,000 every month on a beginner salary (Tanglish style)"
    ],
    badgeText: "Timecoded Video Scripts"
  },
  "viral-hooks": {
    id: "viral-hooks",
    title: "Viral Hooks Generator",
    shortTitle: "Viral Hooks Generator",
    subtitle: "Engineer scroll-stopping first 3-second hooks using curiosity gaps, contrarian angles, mistake warnings, and proof triggers.",
    placeholder: "What is your video or post about? (e.g., 'Freelancing for beginners without experience')...",
    quickPrompts: [
      "Learning coding and AI skills in 90 days without a CS degree",
      "Why 95% of new YouTube channels fail in their first 30 videos",
      "Fitness & fat loss truths for busy software engineers sitting 9 hours a day",
      "How small local shops can double customers using Instagram Reels"
    ],
    badgeText: "8 Psychological Angles"
  },
  "social-captions": {
    id: "social-captions",
    title: "Social Captions & Hashtag Suite",
    shortTitle: "Captions & Hashtags",
    subtitle: "Create platform-native captions for Instagram, LinkedIn, X (Twitter), and Threads alongside tiered reach and niche hashtags.",
    placeholder: "Describe your photo, carousel, reel, or update (e.g., 'Sharing behind-the-scenes of launching our new studio workflow')...",
    quickPrompts: [
      "Behind the scenes of building my digital content agency from home",
      "5 harsh truths I learned after posting 100 videos online",
      "New product drop: Minimalist workspace desk setup essentials",
      "Client success story: How we scaled organic reach by 320% in 60 days"
    ],
    badgeText: "Multi-Platform Suite"
  },
  "youtube-suite": {
    id: "youtube-suite",
    title: "YouTube Creator Suite",
    shortTitle: "YouTube Creator Suite",
    subtitle: "Complete long-form video blueprint: High-CTR titles, thumbnail visual concepts, 60s intro script, timestamped chapters, and SEO tags.",
    placeholder: "Enter your YouTube video idea or question (e.g., 'Complete guide to starting a faceless YouTube channel in 2026')...",
    quickPrompts: [
      "Complete guide to building a full-stack web app using AI in 30 minutes",
      "Best budget camera, mic, and lighting setup for YouTubers under ₹25,000",
      "How I organize my entire life and content calendar without burnout",
      "Smartphone vs Mirrorless Camera: Which one do you actually need in 2026?"
    ],
    badgeText: "Titles · Thumbnails · Script · SEO"
  },
  "seo-article": {
    id: "seo-article",
    title: "SEO Article & Copywriter",
    shortTitle: "SEO Article & Copywriter",
    subtitle: "Publish search-optimized long-form blog posts, meta tags, target keywords, structured sections, and conversion copy.",
    placeholder: "Enter your article topic, target keyword, or question (e.g., 'How AI workflow automation saves 15 hours a week for agencies')...",
    quickPrompts: [
      "The Ultimate Guide to AI Content Creation Workflows for Modern Brands",
      "10 Proven Conversion Copywriting Frameworks for Landing Pages",
      "Why Short-Form Video Marketing Is Essential for B2B SaaS Growth",
      "How to Rank #1 on Google and AI Search Engines in 2026"
    ],
    badgeText: "Long-Form SEO & Copy"
  },
  "content-ideas": {
    id: "content-ideas",
    title: "Content Idea Generator",
    shortTitle: "Content Idea Generator",
    subtitle: "Turn any niche, industry, or question into 4 strategic content pillars, 8 actionable video/post concepts, and a 7-day publishing plan.",
    placeholder: "Enter your niche, industry, or target audience (e.g., 'Personal finance & investing for young professionals in India')...",
    quickPrompts: [
      "Tech reviews, AI tools, and productivity hacks in Tamil & Tanglish",
      "Personal finance, SIP investing, and smart money habits for beginners",
      "Digital marketing agency helping local real estate & D2C brands grow",
      "Home cooking, high-protein South Indian recipes, and meal prep"
    ],
    badgeText: "Pillars + 7-Day Roadmap"
  }
};

// ━━━━━━━━━━━━━━━━━━━━
// Domain & Auth Models
// ━━━━━━━━━━━━━━━━━━━━

export type SubscriptionTier = 'free' | 'pro' | 'agency';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  google_id?: string;
  avatar?: string;
  role: 'user' | 'admin';
  tier: SubscriptionTier;
  credits_used: number;
  credits_limit: number;
  created_at: string;
  disabled?: boolean;
  creator_name?: string;
  preferences?: {
    defaultLanguage?: string;
    defaultPlatform?: string;
    theme?: string;
    [key: string]: any;
  };
}

export interface UserStats {
  creditsUsed: number;
  creditsLimit: number;
  creditsRemaining: number;
  totalGenerations: number;
  credits_used?: number;
  credits_limit?: number;
  credits_remaining?: number;
  total_content_saved?: number;
  has_brand_voice?: boolean;
  reelsGenerated?: number;
  hooksGenerated?: number;
  captionsGenerated?: number;
  youtubeGenerated?: number;
  seoGenerated?: number;
  ideasGenerated?: number;
  libraryCount?: number;
  memberSince?: string;
  tier: SubscriptionTier;
  resetDate?: string;
}

export interface BrandVoice {
  id?: string;
  user_id?: string;
  brand_name: string;
  business_description: string;
  target_audience: string;
  preferred_tone: string;
  words_to_use: string;
  words_to_avoid: string;
  brand_personality: string;
  cta_style: string;
  is_active: boolean;
  updated_at?: string;
}

export type ContextType =
  | 'product'
  | 'personal'
  | 'local_business'
  | 'saas'
  | 'education'
  | 'agency'
  | 'entertainment'
  | 'general';

export interface ContextProfile {
  id: string;
  name: string;
  type: ContextType;
  targetAudience: string;
  language: 'english' | 'tamil' | 'thanglish';
  tone: string;
  niche: string;
  brandOrProductName?: string;
  businessDescription?: string;
  keyPoints?: string;
  pricingOrOffer?: string;
  uniqueSellingPoint?: string;
  wordsToAvoid?: string;
  customInstructions?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  contentType?: string;
  isSaved?: boolean;
  savedItemId?: string;
}

export interface ContextThread {
  id: string;
  user_id: string;
  title: string;
  contextProfile: ContextProfile;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ContentItem {
  id: string;
  user_id: string;
  title: string;
  type: string;
  platform: string;
  language: string;
  tone: string;
  topic: string;
  content: string;
  structured_data?: any;
  meta?: {
    estimated_duration?: string;
    word_count?: number;
    char_count?: number;
    tags?: string[];
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface ContentTemplate {
  id: string;
  title: string;
  description: string;
  category: 'all' | 'favorites' | 'recent' | 'reels' | 'social' | 'marketing' | 'youtube' | 'seo' | 'copywriting' | 'sales' | 'business' | 'personal-brand' | 'education' | 'healthcare' | 'local-business' | 'ads' | 'planning' | string;
  icon: string;
  type: string;
  platform: string;
  tone: string;
  topic_template: string;
  prompt_preset: Record<string, any>;
  keywords?: string[];
  audience?: string;
  duration?: string;
  framework?: string;
  safety_note?: string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  type: string;
  platform: string;
  topic: string;
  created_at: string;
  prompt?: string;
  language?: string;
  credits_consumed?: number;
}

export interface UsageResponse {
  stats: UserStats;
  history: UsageLog[];
  logs?: UsageLog[];
  tierInfo: {
    name: string;
    limit: number;
    features: string[];
    price: string;
  };
}

export interface GenerationRequest {
  type?: string;
  topic: string;
  contentType?: string;
  platform?: string;
  language?: string;
  tone?: string;
  targetAudience?: string;
  reelStyle?: string;
  contentLength?: string;
  ctaOption?: string;
  keywords?: string[];
  brandVoiceId?: string;
  additionalInstructions?: string;
  [key: string]: any;
}

export interface GenerationResponse {
  id?: string;
  type?: string;
  topic?: string;
  content: string;
  title: string;
  success?: boolean;
  savedItem?: ContentItem;
  meta?: any;
  credits: {
    remaining: number;
    used: number;
    limit: number;
    [key: string]: any;
  };
  structured_data?: any;
  language?: string;
  platform?: string;
  created_at?: string;
  credits_remaining?: number;
  credits_used?: number;
  [key: string]: any;
}

export type AIAction = 
  | 'regenerate'
  | 'translate'
  | 'tone'
  | 'expand'
  | 'shorten'
  | 'fix_grammar'
  | 'hook_variations'
  | 'generate_audio'
  | 'viral'
  | 'cta'
  | 'emotional'
  | 'improve'
  | 'professional'
  | 'conversational'
  | string;

export interface AdminStats {
  totalUsers?: number;
  activeUsersToday?: number;
  totalGenerations?: number;
  generationsToday?: number;
  proSubscribers?: number;
  agencySubscribers?: number;
  freeUsers?: number;
  estimatedRevenue?: number;
  popularTypes?: { type: string; count: number }[];
  popularLanguages?: { language: string; count: number }[];
  recentSignups?: User[];
  total_users?: number;
  active_users?: number;
  total_generations?: number;
  daily_generations?: number;
  most_popular_type?: string;
  content_distribution?: Record<string, any>;
  recent_logs?: any[];
  [key: string]: any;
}

export type ContentType = string;
export type ContentMeta = any;

export type Platform = 'instagram' | 'youtube' | 'tiktok' | 'linkedin' | 'x' | 'threads' | 'facebook' | 'all' | string;
export type Language = 'english' | 'tamil' | 'thanglish' | 'hindi' | 'spanish' | 'french' | 'german' | 'telugu' | 'kannada' | 'malayalam' | string;
export type Tone = 'casual' | 'professional' | 'energetic' | 'humorous' | 'storytelling' | 'dramatic' | 'authoritative' | 'empathetic' | 'Educational' | string;
export type CtaOption = 'comment' | 'save' | 'share' | 'link_in_bio' | 'dm' | 'follow' | 'subscribe' | 'buy_now' | string;
export type ReelStyle = 'talking_head' | 'voiceover_broll' | 'text_on_screen' | 'skit' | 'tutorial' | 'vlog' | string;
export type ContentLength = '30s' | '60s' | '90s' | 'short' | 'medium' | 'long' | string;
export type TargetAudience = 'general' | 'beginners' | 'creators' | 'entrepreneurs' | 'professionals' | 'students' | 'parents' | 'Creators' | string;

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'copied';
  message: string;
  title?: string;
  duration?: number;
}
