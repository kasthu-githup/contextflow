import {
  User,
  UserStats,
  BrandVoice,
  ContentItem,
  ContentTemplate,
  GenerationRequest,
  GenerationResponse,
  AIAction,
  AdminStats,
  SubscriptionTier,
  UsageResponse,
  ContextThread,
  ContextProfile,
  ChatMessage
} from '../types';

const TOKEN_KEY = 'contentflow_token';
const USER_KEY = 'contentflow_user';
const STATS_KEY = 'contentflow_stats';
const LOGGED_OUT_KEY = 'contentflow_logged_out';
const LEGACY_ITEMS_KEY = 'contentflow_saved_items';

function getUserStorageKey(userId?: string): string | null {
  const user = getStoredUser();
  const id = userId || user?.id;
  if (!id) return null;
  return `contentflow_saved_items_${id}`;
}

export function isItemOwnedByUser(item: ContentItem, userId?: string, userEmail?: string): boolean {
  if (!item || !item.user_id) return false;
  const targetId = userId || getStoredUser()?.id;
  const targetEmail = (userEmail || getStoredUser()?.email || '').toLowerCase().trim();

  if (targetId && item.user_id === targetId) return true;
  if (targetEmail && item.user_id.toLowerCase() === targetEmail) return true;
  if (targetEmail && (item as any).email && (item as any).email.toLowerCase() === targetEmail) return true;
  return false;
}

function getLocalItems(userId?: string): ContentItem[] {
  try {
    // Purge legacy unscoped key so past users' data cannot leak
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_ITEMS_KEY);
    }
    const key = getUserStorageKey(userId);
    if (!key) return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: ContentItem[] = JSON.parse(raw);
    const currentUser = getStoredUser();
    const currentId = userId || currentUser?.id;
    const currentEmail = currentUser?.email;
    return parsed.filter(item => isItemOwnedByUser(item, currentId, currentEmail));
  } catch {
    return [];
  }
}

function setLocalItems(items: ContentItem[], userId?: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_ITEMS_KEY);
    }
    const key = getUserStorageKey(userId);
    if (!key) return;
    const currentUser = getStoredUser();
    const currentId = userId || currentUser?.id;
    const currentEmail = currentUser?.email;
    const filtered = items.filter(item => isItemOwnedByUser(item, currentId, currentEmail));
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (e) {
    console.warn('LocalStorage save items error:', e);
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

function setCookie(name: string, value: string, days = 30): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export function getStoredToken(): string | null {
  try {
    const local = localStorage.getItem(TOKEN_KEY);
    if (local) return local;
    return getCookie(TOKEN_KEY);
  } catch {
    return getCookie(TOKEN_KEY);
  }
}

export function setStoredAuth(token: string, user: User): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.removeItem(LOGGED_OUT_KEY);
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
  setCookie(TOKEN_KEY, token, 30);
  try {
    setCookie(USER_KEY, JSON.stringify(user), 30);
  } catch (e) {
    console.warn('Cookie save failed:', e);
  }
}

export function clearStoredAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(STATS_KEY);
    localStorage.removeItem(LEGACY_ITEMS_KEY);
    localStorage.setItem(LOGGED_OUT_KEY, 'true');
  } catch (e) {
    console.warn('localStorage clear failed:', e);
  }
  deleteCookie(TOKEN_KEY);
  deleteCookie(USER_KEY);
  deleteCookie(STATS_KEY);
}

export function getStoredUser(): User | null {
  try {
    const data = localStorage.getItem(USER_KEY) || getCookie(USER_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function getStoredStats(): UserStats | null {
  try {
    const data = localStorage.getItem(STATS_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setStoredStats(stats: UserStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn('Stats save failed:', e);
  }
}

export function isExplicitlyLoggedOut(): boolean {
  try {
    return localStorage.getItem(LOGGED_OUT_KEY) === 'true';
  } catch {
    return false;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isPublicAuthEndpoint =
    endpoint.startsWith('/api/auth/login') ||
    endpoint.startsWith('/api/auth/register') ||
    endpoint.startsWith('/api/auth/forgot-password');

  const token = !isPublicAuthEndpoint ? getStoredToken() : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-user-id'] = token;
  }

  const currentUser = getStoredUser();
  if (currentUser?.email) {
    headers['x-user-email'] = currentUser.email;
  }
  if (currentUser?.name) {
    headers['x-user-name'] = encodeURIComponent(currentUser.name);
  }
  if (currentUser?.id && !headers['x-user-id']) {
    headers['x-user-id'] = currentUser.id;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      ...options,
      headers,
    });
  } catch (networkErr: any) {
    const error = new Error('Unable to connect to the server. Please check your internet connection or try again.') as any;
    error.status = 0;
    error.isNetworkError = true;
    error.originalError = networkErr;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html') && endpoint.startsWith('/api/')) {
    const error = new Error('Service endpoint not available. Please try another sign-in method.') as any;
    error.status = 404;
    throw error;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    let errorMsg = data.error || data.message;
    if (!errorMsg) {
      if (response.status === 401) {
        errorMsg = 'Invalid email or password. Please check your credentials.';
      } else if (response.status === 403) {
        errorMsg = 'Account access denied or disabled. Please contact support.';
      } else if (response.status === 404) {
        if (endpoint.includes('/api/auth/login')) {
          errorMsg = 'Invalid email or password. Please check your credentials or click Sign Up.';
        } else if (endpoint.includes('/api/auth/register')) {
          errorMsg = 'Unable to complete registration. Please try signing up again.';
        } else {
          errorMsg = 'Requested service endpoint was not found.';
        }
      } else if (response.status === 500) {
        errorMsg = 'Server encountered an error. Please try again in a moment.';
      } else {
        errorMsg = `Request failed with status ${response.status}`;
      }
    }

    const error = new Error(errorMsg) as any;
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const api = {
  // Auth
  async register(params: { name: string; email: string; password: string; confirmPassword?: string }) {
    return request<{ user: User; token: string; message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async login(params: { email: string; password: string }) {
    return request<{ user: User; token: string; message: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async forgotPassword(email: string) {
    return request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async resetPassword(params: { email: string; password: string; confirmPassword?: string }) {
    return request<{ user: User; token: string; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async getMe() {
    try {
      return await request<{ user: User; stats: UserStats }>('/api/auth/me');
    } catch (e: any) {
      const stored = getStoredUser();
      const stats: UserStats = getStoredStats() || {
        creditsUsed: stored?.credits_used ?? 0,
        creditsLimit: stored?.credits_limit ?? 50,
        creditsRemaining: (stored?.credits_limit ?? 50) - (stored?.credits_used ?? 0),
        totalGenerations: 0,
        tier: stored?.tier || 'free',
        credits_remaining: (stored?.credits_limit ?? 50) - (stored?.credits_used ?? 0),
        credits_used: stored?.credits_used ?? 0,
        credits_limit: stored?.credits_limit ?? 50,
        total_content_saved: getLocalItems().length,
        has_brand_voice: false
      };
      if (stored) {
        return { user: stored, stats };
      }
      throw e;
    }
  },

  async getGoogleConfig() {
    return request<{ clientId: string; isConfigured: boolean }>('/api/auth/google/config');
  },

  async loginWithGoogle(payload: { credential?: string; accessToken?: string; idToken?: string; email?: string; name?: string; avatar?: string }) {
    return request<{ user: User; token: string; message: string }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateProfile(params: {
    name?: string;
    email?: string;
    avatar?: string;
    creator_name?: string;
    preferences?: Record<string, any>;
    currentPassword?: string;
    newPassword?: string;
  }) {
    return request<{ user: User; message: string }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(params)
    });
  },

  async getUsage() {
    try {
      return await request<UsageResponse>('/api/usage');
    } catch (err) {
      const stored = getStoredUser();
      return {
        success: true,
        tier: stored?.tier || 'free',
        credits_used: stored?.credits_used || 0,
        credits_limit: stored?.credits_limit || 10,
        credits_remaining: Math.max(0, (stored?.credits_limit || 10) - (stored?.credits_used || 0)),
        created_at: stored?.created_at || new Date().toISOString(),
        history: [],
        logs: []
      };
    }
  },

  async upgradeTier(tier: SubscriptionTier) {
    return request<{ user: User; message: string }>('/api/auth/upgrade-tier', {
      method: 'POST',
      body: JSON.stringify({ tier })
    });
  },

  // AI Generation
  async generateContent(payload: GenerationRequest) {
    try {
      const res = await request<GenerationResponse>('/api/generate', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res && res.savedItem) {
        const currentUserId = getStoredUser()?.id;
        if (currentUserId) {
          const local = getLocalItems(currentUserId).filter(i => i.id !== res.savedItem?.id);
          local.unshift(res.savedItem);
          setLocalItems(local, currentUserId);
        }
      }
      return res;
    } catch (apiErr) {
      console.warn('API generate endpoint fallback:', apiErr);
      // Fallback for offline or static hosting with strict language adaptation
      const genId = `gen_${Date.now()}`;
      const langLower = (payload.language || 'english').toLowerCase().trim();
      let scriptContent = '';
      let title = '';

      if (langLower === 'tamil') {
        title = `${payload.topic || 'முக்கிய தலைப்பு'} - தமிழ் ரீல் ஸ்கிரிப்ட்`;
        scriptContent = `🎬 [ஹூக் (HOOK) - 0:00 - 0:03]
ஸ்க்ரோல் செய்வதை நிறுத்துங்கள்! ${payload.topic || 'இந்த விஷயத்தில்'} நீங்கள் வெற்றி பெற விரும்பினால், இந்த 3 முக்கியமான ரகசியங்களை உடனே தெரிந்து கொள்ளுங்கள்!

💡 [முக்கிய தகவல் (BODY) - 0:03 - 0:25]
1. முதல் 3 வினாடிகளில் மக்களின் கவனத்தை ஈர்க்கும் ஒரு பலமான ஹூக் (Hook) தேவை.
2. பார்வையாளர்களுக்கு பயனுள்ள 2 அல்லது 3 நேரடி டிப்ஸ்களை எந்தவித தயக்கமும் இன்றி தெளிவாக சொல்லுங்கள்.
3. உண்மைத்தன்மையுடன் உங்கள் சொந்த அனுபவத்தை பகிர்ந்து பார்வையாளர்களின் நம்பிக்கையை உருவாக்குங்கள்.

🎯 [அழைப்பு (CTA) - 0:25 - 0:30]
இந்த வீடியோவை இப்போதே சேவ் (Save) செய்து கொள்ளுங்கள்! உங்கள் கருத்துக்களை கீழே கமெண்ட் செய்யுங்கள்.`;
      } else if (langLower === 'thanglish' || langLower === 'tanglish') {
        title = `${payload.topic || 'Viral Content'} - Thanglish Reel Script`;
        scriptContent = `🎬 [HOOK - 0:00 - 0:03]
Scroll panradha niruthunga! Neenga ${payload.topic || 'indha topic-la'} periya reach edukka poringalana, indha 3 secret tips ungalukku dhaan!

💡 [BODY - 0:03 - 0:25]
1. First 3 seconds-la audience-ah attract pandra maadhiri oru strong hook podunga.
2. Fluff edhuvum illama 2 simple actionable points deliver pannunga.
3. Unga real experience share panni viewers trust build pannunga.

🎯 [CTA - 0:25 - 0:30]
Indha post-ah kandippa save panni vechukkonga! Unga thoughts-ah keezha comment pannunga.`;
      } else {
        title = `${payload.topic || 'Viral Content'} - ${payload.platform?.toUpperCase() || 'Content'}`;
        const hook1 = `Stop scrolling! If you want to master ${payload.topic || 'this topic'}, you need this simple blueprint.`;
        scriptContent = `🎬 [HOOK - 0:00 - 0:03]\n${hook1}\n\n💡 [CORE VALUE - 0:03 - 0:25]\nHere is the step-by-step breakdown:\n1. Hook: Start with curiosity or a common myth\n2. Retention: Deliver 2-3 hyper-actionable tips with zero fluff\n3. Proof: Share an authentic example that builds trust immediately\n\n🎯 [CALL TO ACTION - 0:25 - 0:30]\nSave this post so you have the script when filming your next video! Drop your thoughts below.`;
      }
      
      const currentUser = getStoredUser();
      const currentUserId = currentUser?.id || 'creator_guest';
      const sampleItem: ContentItem = {
        id: genId,
        user_id: currentUserId,
        title,
        type: payload.contentType || 'reel',
        platform: payload.platform || 'instagram',
        language: payload.language || 'English',
        tone: payload.tone || 'Engaging',
        topic: payload.topic,
        content: scriptContent,
        meta: {
          estimated_duration: '30-45 sec',
          word_count: 85,
          tags: ['#ContentCreator', '#ViralGrowth', '#AIContent', '#CreatorEconomy', '#ReelsTips']
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (currentUser?.id) {
        const localFallback = getLocalItems(currentUser.id).filter(i => i.id !== sampleItem.id);
        localFallback.unshift(sampleItem);
        setLocalItems(localFallback, currentUser.id);
      }

      return {
        success: true,
        content: scriptContent,
        title,
        savedItem: sampleItem,
        meta: {
          estimated_duration: '30-45 sec',
          word_count: 85,
          tags: ['#ContentCreator', '#ViralGrowth', '#AIContent']
        },
        credits: {
          remaining: Math.max(0, (getStoredUser()?.credits_limit || 50) - (getStoredUser()?.credits_used || 0) - 1),
          limit: getStoredUser()?.credits_limit || 50,
          used: (getStoredUser()?.credits_used || 0) + 1
        }
      };
    }
  },

  async transformContent(payload: {
    content: string;
    action: AIAction;
    targetLanguage?: string;
    targetTone?: string;
    platform?: string;
  }) {
    try {
      return await request<{ success: boolean; content: string; meta: any; action: string }>('/api/transform', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch {
      let transformed = payload.content;
      if (payload.action === 'viral') {
        transformed = `🔥 [VIRAL HOOK]: Stop scrolling! Here's what they won't tell you:\n\n${payload.content}`;
      } else if (payload.action === 'shorten') {
        transformed = payload.content.split('\n').slice(0, 3).join('\n');
      } else if (payload.action === 'cta') {
        transformed = `${payload.content}\n\n👉 Save this post & follow for more daily creator playbooks!`;
      } else if (payload.action === 'emotional') {
        transformed = `❤️ If this touches your heart, you understand why:\n\n${payload.content}`;
      } else {
        transformed = `✨ ${payload.content}`;
      }
      return { success: true, content: transformed, meta: {}, action: payload.action };
    }
  },

  // Content Items - Strictly filtered so each user only sees their own content history
  async getContent(params: { type?: string; platform?: string; search?: string; userId?: string } = {}) {
    const currentUser = getStoredUser();
    const currentId = params.userId || currentUser?.id;
    const currentEmail = currentUser?.email;

    // Strict privacy boundary: If user is not authenticated, do not return any other person's content
    if (!currentId && !currentEmail) {
      return { items: [] };
    }

    let serverItems: ContentItem[] = [];
    try {
      const query = new URLSearchParams();
      if (params.type) query.set('type', params.type);
      if (params.platform) query.set('platform', params.platform);
      if (params.search) query.set('search', params.search);
      const res = await request<{ items: ContentItem[] }>(`/api/content?${query.toString()}`);
      if (res && Array.isArray(res.items)) {
        serverItems = res.items;
      }
    } catch (e) {
      console.warn('API getContent server fetch fallback to cache:', e);
    }

    const local = getLocalItems(currentId);
    const itemMap = new Map<string, ContentItem>();

    // Only add items strictly owned by this specific user
    local.forEach(i => {
      if (isItemOwnedByUser(i, currentId, currentEmail)) {
        itemMap.set(i.id, i);
      }
    });

    serverItems.forEach(i => {
      if (isItemOwnedByUser(i, currentId, currentEmail)) {
        itemMap.set(i.id, i);
      }
    });

    let allItems = Array.from(itemMap.values())
      .filter(i => isItemOwnedByUser(i, currentId, currentEmail))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (params.type && params.type !== 'all') {
      allItems = allItems.filter(i => (i.type || '').toLowerCase().includes(params.type!.toLowerCase()));
    }
    if (params.platform && params.platform !== 'all') {
      allItems = allItems.filter(i => (i.platform || '').toLowerCase() === params.platform!.toLowerCase());
    }
    if (params.search) {
      const q = params.search.toLowerCase().trim();
      allItems = allItems.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.content || '').toLowerCase().includes(q) ||
        (i.topic || '').toLowerCase().includes(q)
      );
    }
    return { items: allItems };
  },

  async getContentById(id: string) {
    const currentUser = getStoredUser();
    const currentId = currentUser?.id;
    const currentEmail = currentUser?.email;

    try {
      const res = await request<{ item: ContentItem }>(`/api/content/${id}`);
      if (res?.item && isItemOwnedByUser(res.item, currentId, currentEmail)) {
        return res;
      }
    } catch {
      // Fallback to local
    }

    const found = getLocalItems(currentId).find(i => i.id === id && isItemOwnedByUser(i, currentId, currentEmail));
    if (found) return { item: found };
    throw new Error('Item not found or access denied');
  },

  async saveContent(payload: Partial<ContentItem>) {
    const currentUser = getStoredUser();
    const currentId = payload.user_id || currentUser?.id;
    if (!currentId) {
      throw new Error('Please sign in to save content to your personal library');
    }

    const newItem: ContentItem = {
      id: payload.id || `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: currentId,
      title: payload.title || 'Untitled Creation',
      type: payload.type || 'reel',
      platform: payload.platform || 'instagram',
      language: payload.language || 'English',
      tone: payload.tone || 'Engaging',
      topic: payload.topic || '',
      content: payload.content || '',
      meta: payload.meta,
      created_at: payload.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const current = getLocalItems(currentId);
    const existingIdx = current.findIndex(i => i.id === newItem.id);
    if (existingIdx >= 0) {
      current[existingIdx] = newItem;
    } else {
      current.unshift(newItem);
    }
    setLocalItems(current, currentId);

    try {
      const res = await request<{ item: ContentItem; message: string }>('/api/content', {
        method: 'POST',
        body: JSON.stringify({ ...payload, user_id: currentId })
      });
      if (res && res.item) {
        const updatedLocal = getLocalItems(currentId).filter(i => i.id !== newItem.id && i.id !== res.item.id);
        updatedLocal.unshift(res.item);
        setLocalItems(updatedLocal, currentId);
        return res;
      }
    } catch (e) {
      console.warn('API saveContent server fallback to local cache:', e);
    }
    return { item: newItem, message: 'Content saved to your library!' };
  },

  async updateContent(id: string, payload: Partial<ContentItem>) {
    const currentUser = getStoredUser();
    const currentId = currentUser?.id;
    const current = getLocalItems(currentId);
    const idx = current.findIndex(i => i.id === id);
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...payload, updated_at: new Date().toISOString() };
      setLocalItems(current, currentId);
    }
    try {
      return await request<{ item: ContentItem; message: string }>(`/api/content/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } catch {
      return { item: current[idx] || (payload as ContentItem), message: 'Updated successfully' };
    }
  },

  async deleteContent(id: string) {
    const currentUser = getStoredUser();
    const currentId = currentUser?.id;
    const current = getLocalItems(currentId).filter(i => i.id !== id);
    setLocalItems(current, currentId);
    try {
      return await request<{ success: boolean; message: string }>(`/api/content/${id}`, {
        method: 'DELETE'
      });
    } catch {
      return { success: true, message: 'Deleted successfully' };
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Context Threads (ChatGPT-style multi-context sessions)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getContextThreads(userId?: string) {
    const currentUser = getStoredUser();
    const currentId = userId || currentUser?.id;
    if (!currentId) return { threads: [] };

    try {
      const res = await request<{ threads: ContextThread[] }>('/api/threads');
      if (res && Array.isArray(res.threads)) {
        try {
          localStorage.setItem(`contentflow_threads_${currentId}`, JSON.stringify(res.threads));
        } catch {}
        return res;
      }
    } catch (e) {
      console.warn('API getContextThreads server fetch error, falling back to local:', e);
    }

    try {
      const raw = localStorage.getItem(`contentflow_threads_${currentId}`);
      return { threads: raw ? JSON.parse(raw) : [] };
    } catch {
      return { threads: [] };
    }
  },

  async getContextThread(id: string) {
    try {
      return await request<{ thread: ContextThread }>(`/api/threads/${id}`);
    } catch (e) {
      const currentUser = getStoredUser();
      if (currentUser?.id) {
        try {
          const raw = localStorage.getItem(`contentflow_threads_${currentUser.id}`);
          const threads: ContextThread[] = raw ? JSON.parse(raw) : [];
          const found = threads.find(t => t.id === id);
          if (found) return { thread: found };
        } catch {}
      }
      throw e;
    }
  },

  async createContextThread(payload: { title?: string; contextProfile?: Partial<ContextProfile>; initialMessage?: string }) {
    const currentUser = getStoredUser();
    const currentId = currentUser?.id;
    if (!currentId) throw new Error('Please sign in to create context threads');

    try {
      const res = await request<{ thread: ContextThread }>('/api/threads', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res && res.thread) {
        try {
          const raw = localStorage.getItem(`contentflow_threads_${currentId}`);
          const threads: ContextThread[] = raw ? JSON.parse(raw) : [];
          threads.unshift(res.thread);
          localStorage.setItem(`contentflow_threads_${currentId}`, JSON.stringify(threads));
        } catch {}
        return res;
      }
    } catch (e) {
      console.warn('API createContextThread server error, creating locally:', e);
    }

    const now = new Date().toISOString();
    const localThread: ContextThread = {
      id: `th_loc_${Date.now()}`,
      user_id: currentId,
      title: payload.title || 'New Context Session',
      contextProfile: {
        id: `cp_${Date.now()}`,
        name: payload.contextProfile?.name || 'General Creator',
        type: (payload.contextProfile?.type as any) || 'general',
        targetAudience: payload.contextProfile?.targetAudience || 'General Audience',
        language: payload.contextProfile?.language || 'english',
        tone: payload.contextProfile?.tone || 'Conversational & Engaging',
        niche: payload.contextProfile?.niche || 'Digital Content',
        brandOrProductName: payload.contextProfile?.brandOrProductName || '',
        businessDescription: payload.contextProfile?.businessDescription || '',
        keyPoints: payload.contextProfile?.keyPoints || '',
        pricingOrOffer: payload.contextProfile?.pricingOrOffer || '',
        uniqueSellingPoint: payload.contextProfile?.uniqueSellingPoint || '',
        wordsToAvoid: payload.contextProfile?.wordsToAvoid || '',
        customInstructions: payload.contextProfile?.customInstructions || ''
      },
      messages: payload.initialMessage ? [
        {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: payload.initialMessage,
          timestamp: now
        }
      ] : [],
      created_at: now,
      updated_at: now
    };

    try {
      const raw = localStorage.getItem(`contentflow_threads_${currentId}`);
      const threads: ContextThread[] = raw ? JSON.parse(raw) : [];
      threads.unshift(localThread);
      localStorage.setItem(`contentflow_threads_${currentId}`, JSON.stringify(threads));
    } catch {}

    return { thread: localThread };
  },

  async updateContextThread(id: string, payload: { title?: string; contextProfile?: Partial<ContextProfile> }) {
    const currentUser = getStoredUser();
    const currentId = currentUser?.id;

    try {
      const res = await request<{ thread: ContextThread }>(`/api/threads/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res?.thread && currentId) {
        try {
          const raw = localStorage.getItem(`contentflow_threads_${currentId}`);
          const threads: ContextThread[] = raw ? JSON.parse(raw) : [];
          const idx = threads.findIndex(t => t.id === id);
          if (idx >= 0) {
            threads[idx] = res.thread;
            localStorage.setItem(`contentflow_threads_${currentId}`, JSON.stringify(threads));
          }
        } catch {}
        return res;
      }
    } catch (e) {
      console.warn('API updateContextThread server error, updating locally:', e);
    }

    if (currentId) {
      try {
        const raw = localStorage.getItem(`contentflow_threads_${currentId}`);
        const threads: ContextThread[] = raw ? JSON.parse(raw) : [];
        const idx = threads.findIndex(t => t.id === id);
        if (idx >= 0) {
          if (payload.title) threads[idx].title = payload.title;
          if (payload.contextProfile) {
            threads[idx].contextProfile = {
              ...threads[idx].contextProfile,
              ...payload.contextProfile
            };
          }
          threads[idx].updated_at = new Date().toISOString();
          localStorage.setItem(`contentflow_threads_${currentId}`, JSON.stringify(threads));
          return { thread: threads[idx] };
        }
      } catch {}
    }
    throw new Error('Thread not found');
  },

  async deleteContextThread(id: string) {
    const currentUser = getStoredUser();
    const currentId = currentUser?.id;
    if (currentId) {
      try {
        const raw = localStorage.getItem(`contentflow_threads_${currentId}`);
        const threads: ContextThread[] = raw ? JSON.parse(raw) : [];
        const filtered = threads.filter(t => t.id !== id);
        localStorage.setItem(`contentflow_threads_${currentId}`, JSON.stringify(filtered));
      } catch {}
    }

    try {
      return await request<{ success: boolean; message: string }>(`/api/threads/${id}`, {
        method: 'DELETE'
      });
    } catch {
      return { success: true, message: 'Thread deleted' };
    }
  },

  async clearThreadMessages(id: string) {
    const currentUser = getStoredUser();
    const currentId = currentUser?.id;

    try {
      const res = await request<{ thread: ContextThread }>(`/api/threads/${id}/clear`, {
        method: 'POST'
      });
      if (res?.thread && currentId) {
        try {
          const raw = localStorage.getItem(`contentflow_threads_${currentId}`);
          const threads: ContextThread[] = raw ? JSON.parse(raw) : [];
          const idx = threads.findIndex(t => t.id === id);
          if (idx >= 0) {
            threads[idx].messages = [];
            localStorage.setItem(`contentflow_threads_${currentId}`, JSON.stringify(threads));
          }
        } catch {}
        return res;
      }
    } catch {}

    if (currentId) {
      try {
        const raw = localStorage.getItem(`contentflow_threads_${currentId}`);
        const threads: ContextThread[] = raw ? JSON.parse(raw) : [];
        const idx = threads.findIndex(t => t.id === id);
        if (idx >= 0) {
          threads[idx].messages = [];
          localStorage.setItem(`contentflow_threads_${currentId}`, JSON.stringify(threads));
          return { thread: threads[idx] };
        }
      } catch {}
    }
    throw new Error('Thread not found');
  },

  async sendChatMessage(threadId: string, message: string, contentType?: string) {
    return request<{
      success: boolean;
      userMessage: ChatMessage;
      modelMessage: ChatMessage;
      meta: any;
      credits: any;
    }>(`/api/threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message, contentType })
    });
  },

  async sendThreadMessage(threadId: string, message: string, contentType?: string) {
    return this.sendChatMessage(threadId, message, contentType);
  },
  async getBrandVoice() {
    try {
      return await request<{ brandVoice: BrandVoice }>('/api/brand-voice');
    } catch {
      const stored = localStorage.getItem('contentflow_brand_voice');
      const bv: BrandVoice = stored ? JSON.parse(stored) : {
        brand_name: getStoredUser()?.name || 'My Brand',
        business_description: 'Modern digital creator and entrepreneur.',
        target_audience: 'Creators & ambitious professionals',
        preferred_tone: 'Authentic, bold, inspiring',
        words_to_use: 'Actionable, framework, leverage, results',
        words_to_avoid: 'Hustle 24/7, synergy, jargon',
        brand_personality: 'Direct, clear, insightful',
        cta_style: 'Save for later and share',
        is_active: true
      };
      return { brandVoice: bv };
    }
  },

  async updateBrandVoice(payload: Partial<BrandVoice>) {
    try {
      localStorage.setItem('contentflow_brand_voice', JSON.stringify(payload));
    } catch {}
    try {
      return await request<{ brandVoice: BrandVoice; message: string }>('/api/brand-voice', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch {
      return { brandVoice: payload as BrandVoice, message: 'Brand voice saved!' };
    }
  },

  // Templates
  async getTemplates() {
    try {
      return await request<{ templates: ContentTemplate[]; totalCount?: number }>('/api/templates');
    } catch {
      const { ALL_TEMPLATES } = await import('../data/templatesData');
      return { templates: ALL_TEMPLATES, totalCount: ALL_TEMPLATES.length };
    }
  },

  async getTemplateUserData() {
    return request<{ favorites: string[]; recent: string[] }>('/api/templates/user-data');
  },

  async toggleTemplateFavorite(templateId: string) {
    return request<{ favorites: string[]; isFavorite: boolean }>('/api/templates/favorite', {
      method: 'POST',
      body: JSON.stringify({ templateId })
    });
  },

  async trackTemplateUse(templateId: string) {
    return request<{ recent: string[] }>('/api/templates/track-use', {
      method: 'POST',
      body: JSON.stringify({ templateId })
    });
  },

  // Admin
  async getAdminStats() {
    return request<AdminStats>('/api/admin/stats');
  },

  async getAdminUsers() {
    return request<{ users: User[] }>('/api/admin/users');
  },

  async toggleUserStatus(userId: string) {
    return request<{ user: User; message: string }>(`/api/admin/users/${userId}/toggle-status`, {
      method: 'POST'
    });
  },

  async grantUserCredits(userId: string, amount: number) {
    return request<{ user: User; message: string }>(`/api/admin/users/${userId}/grant-credits`, {
      method: 'POST',
      body: JSON.stringify({ amount })
    });
  },

  async deleteUser(userId: string) {
    return request<{ success: boolean; message: string }>(`/api/admin/users/${userId}`, {
      method: 'DELETE'
    });
  }
};
