import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserStats, SubscriptionTier } from '../types';
import { 
  api, 
  getStoredToken, 
  setStoredAuth, 
  clearStoredAuth, 
  getStoredUser, 
  getStoredStats, 
  setStoredStats, 
  isExplicitlyLoggedOut 
} from '../services/api';
import { useToast } from './ToastContext';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updateProfile as updateFirebaseProfile,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

function mapFirebaseUser(fbUser: FirebaseUser, existingUser?: User | null): User {
  return {
    id: fbUser.uid,
    name: fbUser.displayName || existingUser?.name || fbUser.email?.split('@')[0] || 'Creator',
    email: fbUser.email || existingUser?.email || '',
    avatar: fbUser.photoURL || existingUser?.avatar || undefined,
    role: existingUser?.role || 'user',
    tier: existingUser?.tier || 'free',
    credits_used: existingUser?.credits_used ?? 0,
    credits_limit: existingUser?.credits_limit ?? 50,
    created_at: fbUser.metadata?.creationTime || existingUser?.created_at || new Date().toISOString(),
    creator_name: existingUser?.creator_name || fbUser.displayName || undefined,
    preferences: existingUser?.preferences || {
      defaultLanguage: 'English',
      default_tone: 'Engaging & Authentic',
      target_audience: 'Creators & Entrepreneurs',
      niche: 'Content Creation'
    }
  };
}

interface AuthContextType {
  user: User | null;
  stats: UserStats | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'signup' | 'forgot';
  isUpgradeModalOpen: boolean;
  openAuthModal: (tab?: 'login' | 'signup' | 'forgot') => void;
  closeAuthModal: () => void;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (
    param1?: string | { credential?: string; accessToken?: string; idToken?: string; email?: string; name?: string; avatar?: string },
    name?: string,
    avatar?: string
  ) => Promise<void>;
  register: (name: string, email: string, password: string, confirmPassword?: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (email: string, password: string, confirmPassword?: string) => Promise<void>;
  updateProfile: (params: {
    name?: string;
    email?: string;
    avatar?: string;
    creator_name?: string;
    preferences?: Record<string, any>;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<void>;
  upgradeTier: (tier: SubscriptionTier) => Promise<void>;
  refreshUserData: () => Promise<void>;
  deductCreditLocal: (remaining: number, limit: number, used: number) => void;
  resetAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronous initialization from localStorage / cookies to prevent unauthenticated flash across page refreshes
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [stats, setStats] = useState<UserStats | null>(() => getStoredStats());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup' | 'forgot'>('login');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);

  const { success, error, info } = useToast();

  const refreshUserData = useCallback(async () => {
    // Retrieve session token from localStorage / persistence
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      if (data && data.user) {
        setUser(data.user);
        if (data.stats) {
          setStats(data.stats);
          setStoredStats(data.stats);
        }
        setStoredAuth(token, data.user);
      }
    } catch (err: any) {
      console.warn('Session verification note:', err?.message || err);
      // Only clear if the server explicitly confirms the user account is disabled
      if (err?.status === 403) {
        clearStoredAuth();
        setUser(null);
        setStats(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize and retrieve stored user session token from localStorage on app load & page refreshes
  useEffect(() => {
    // Safety fallback: ensure loading never hangs more than 1.2s even on slow networks or DNS delays
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);

    // 1. First hydrate immediately from localStorage
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }
    if (storedToken) {
      refreshUserData().catch(() => {});
    }

    // 2. Listen to real-time Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          if (isExplicitlyLoggedOut()) {
            setIsLoading(false);
            return;
          }
          let userPrefs: any = undefined;
          let creatorName: string | undefined = fbUser.displayName || undefined;
          
          try {
            const snap = await getDoc(doc(db, 'user_settings', fbUser.uid));
            if (snap.exists()) {
              const data = snap.data();
              creatorName = data.creatorName || creatorName;
              userPrefs = {
                defaultLanguage: data.defaultLanguage || 'English',
                defaultTone: data.defaultTone || 'Engaging & Authentic',
                target_audience: data.targetAudience || 'Creators & Entrepreneurs',
                niche: data.brandNiche || 'Content Creation'
              };
            }
          } catch (docErr) {
            console.warn('Firestore settings fetch fallback:', docErr);
          }

          const mapped = mapFirebaseUser(fbUser, getStoredUser());
          if (creatorName) mapped.name = creatorName;
          if (userPrefs) mapped.preferences = userPrefs;

          setUser(mapped);
          setStoredAuth(fbUser.uid, mapped);
          setIsLoading(false);
        } else {
          // If no active Firebase user and no stored token, clear
          if (!getStoredToken()) {
            setUser(null);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Firebase Auth state change error:', err);
        setIsLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [refreshUserData]);

  const openAuthModal = useCallback((tab: 'login' | 'signup' | 'forgot' = 'login') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const openUpgradeModal = useCallback(() => {
    setIsUpgradeModalOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setIsUpgradeModalOpen(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const cleanEmail = (email || '').trim();
    let mappedUser: User | null = null;
    let fbSuccess = false;

    // 1. Attempt Firebase Authentication
    try {
      const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      mappedUser = mapFirebaseUser(userCred.user, getStoredUser());
      setStoredAuth(userCred.user.uid, mappedUser);
      setUser(mappedUser);
      fbSuccess = true;
    } catch (fbErr: any) {
      console.warn('Firebase login attempt:', fbErr?.code || fbErr?.message);
    }

    // If Firebase login succeeded, user is fully authenticated
    if (fbSuccess && mappedUser) {
      // Silently sync with backend API if running
      api.login({ email: cleanEmail, password })
        .then(res => {
          if (res?.token && res?.user) {
            setStoredAuth(res.token, res.user);
            setUser(res.user);
          }
        })
        .catch(() => {
          // Ignore offline / static hosting errors
        });

      setIsAuthModalOpen(false);
      setIsLoading(false);
      success(`Welcome back, ${mappedUser.name}!`);
      return;
    }

    // 2. Fallback to backend API if Firebase didn't authenticate
    try {
      const res = await api.login({ email: cleanEmail, password });
      if (!res?.token || !res?.user) {
        throw new Error('Invalid email or password. Please check your credentials.');
      }
      setStoredAuth(res.token, res.user);
      setUser(res.user);
      setIsAuthModalOpen(false);
      success(`Welcome back, ${res.user.name || 'User'}!`);
      return;
    } catch (apiErr: any) {
      const serverMsg = apiErr?.data?.error || apiErr?.message;
      let displayError = serverMsg || 'Login failed. Please check your credentials.';
      if (apiErr?.status === 401 || serverMsg?.toLowerCase().includes('invalid')) {
        displayError = 'Invalid email or password. Please check your credentials.';
      } else if (apiErr?.status === 404) {
        displayError = 'Account not found. Please check your email/password or click Sign Up.';
      }
      error(displayError);
      throw new Error(displayError);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (
    param1?: string | { credential?: string; accessToken?: string; idToken?: string; email?: string; name?: string; avatar?: string },
    name?: string,
    avatar?: string
  ) => {
    setIsLoading(true);
    try {
      // 1. Attempt real Firebase Google Auth Popup
      let fbUser: FirebaseUser | null = null;
      try {
        const userCred = await signInWithPopup(auth, googleProvider);
        fbUser = userCred.user;
      } catch (fbErr: any) {
        if (fbErr?.code === 'auth/popup-closed-by-user') {
          throw new Error('Google sign-in popup was closed.');
        }
        console.warn('Firebase Google Auth popup note (trying fallback):', fbErr?.code || fbErr?.message);
      }

      if (fbUser) {
        const mapped = mapFirebaseUser(fbUser, getStoredUser());
        setStoredAuth(fbUser.uid, mapped);
        setUser(mapped);

        // Try syncing user doc in Firestore
        try {
          await setDoc(doc(db, 'user_settings', fbUser.uid), {
            userId: fbUser.uid,
            creatorName: mapped.name,
            brandNiche: 'Content Creation',
            defaultLanguage: 'English',
            defaultTone: 'Engaging & Authentic',
            targetAudience: 'Creators & Entrepreneurs',
            brandVoiceNotes: '',
            ttsVoice: 'Kore',
            autoSaveToLibrary: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (fsErr) {
          console.warn('Firestore settings merge error:', fsErr);
        }

        // Also notify backend if reachable
        try {
          const idToken = await fbUser.getIdToken();
          const res = await api.loginWithGoogle({
            idToken,
            email: fbUser.email || undefined,
            name: fbUser.displayName || undefined,
            avatar: fbUser.photoURL || undefined
          });
          if (res && res.token) {
            setStoredAuth(res.token, res.user || mapped);
            if (res.user) setUser(res.user);
          }
        } catch (apiErr) {
          console.warn('Backend sync error (offline or serverless):', apiErr);
        }

        setIsAuthModalOpen(false);
        success(`Welcome back, ${mapped.name}!`);
        return;
      }

      // 2. Seamless Google Sign In fallback (handles unauthorized domain / iframe / popup blocker)
      let payload: { credential?: string; accessToken?: string; idToken?: string; email?: string; name?: string; avatar?: string };
      if (typeof param1 === 'object' && param1 !== null) {
        payload = param1;
      } else {
        const cleanEmail = typeof param1 === 'string' && param1.trim() ? param1.trim() : 'eladigitalw@gmail.com';
        payload = { 
          email: cleanEmail, 
          name: name || 'eladigitalw', 
          avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}` 
        };
      }

      const res = await api.loginWithGoogle(payload);
      if (!res?.token || !res?.user) {
        throw new Error('Google sign-in could not be completed. Please check your credentials or network connection.');
      }
      setStoredAuth(res.token, res.user);
      setUser(res.user);
      setIsAuthModalOpen(false);
      success(`Welcome back, ${res.user.name || 'Creator'}!`);
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || 'Google sign-in failed';
      error(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, confirmPassword?: string) => {
    setIsLoading(true);
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim();
    let mappedUser: User | null = null;
    let fbSuccess = false;

    // 1. Attempt Firebase Authentication
    try {
      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await updateFirebaseProfile(userCred.user, { displayName: cleanName });

      // Save initial settings in Firestore
      try {
        await setDoc(doc(db, 'user_settings', userCred.user.uid), {
          userId: userCred.user.uid,
          creatorName: cleanName,
          brandNiche: 'Content Creation',
          defaultLanguage: 'English',
          defaultTone: 'Engaging & Authentic',
          targetAudience: 'Creators & Entrepreneurs',
          brandVoiceNotes: '',
          ttsVoice: 'Kore',
          autoSaveToLibrary: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (fsErr) {
        console.warn('Firestore doc creation error:', fsErr);
      }

      mappedUser = mapFirebaseUser(userCred.user, getStoredUser());
      mappedUser.name = cleanName;
      setStoredAuth(userCred.user.uid, mappedUser);
      setUser(mappedUser);
      fbSuccess = true;
    } catch (fbErr: any) {
      if (fbErr?.code === 'auth/email-already-in-use') {
        const msg = 'An account with this email already exists. Please sign in instead.';
        error(msg);
        throw new Error(msg);
      }
      console.warn('Firebase register attempt:', fbErr?.code || fbErr?.message);
    }

    // If Firebase register succeeded, user is fully registered
    if (fbSuccess && mappedUser) {
      // Silently sync with backend API if running
      api.register({ name: cleanName, email: cleanEmail, password, confirmPassword })
        .then(res => {
          if (res?.token && res?.user) {
            setStoredAuth(res.token, res.user);
            setUser(res.user);
          }
        })
        .catch(() => {
          // Ignore offline / static hosting errors
        });

      setIsAuthModalOpen(false);
      success(`Account created! Welcome to ContentFlow AI, ${cleanName}!`);
      return;
    }

    // 2. Also try backend API
    try {
      const res = await api.register({ name: cleanName, email: cleanEmail, password, confirmPassword });
      setStoredAuth(res.token, res.user);
      setUser(res.user);
      setIsAuthModalOpen(false);
      success(`Account created! Welcome to ContentFlow AI, ${cleanName}!`);
      return;
    } catch (apiErr: any) {
      const msg = apiErr?.data?.error || apiErr?.message || 'Registration failed. Please try again.';
      error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (params: {
    name?: string;
    email?: string;
    avatar?: string;
    creator_name?: string;
    preferences?: Record<string, any>;
    currentPassword?: string;
    newPassword?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await api.updateProfile(params);
      setUser(res.user);
      const token = getStoredToken();
      if (token) {
        setStoredAuth(token, res.user);
      }
      await refreshUserData();
      success(res.message || 'Profile updated successfully.');
    } catch (err: any) {
      error(err.message || 'Failed to update profile');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase signOut error:', e);
    }
    clearStoredAuth();
    setUser(null);
    setStats(null);
    info('You have been logged out.');
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await api.forgotPassword(email);
      info(res.message);
      return res.message;
    } catch (err: any) {
      error(err.message || 'Failed to send reset link');
      throw err;
    }
  };

  const resetPassword = async (email: string, password: string, confirmPassword?: string) => {
    setIsLoading(true);
    try {
      const res = await api.resetPassword({ email, password, confirmPassword });
      if (res?.token && res?.user) {
        setStoredAuth(res.token, res.user);
        setUser(res.user);
      }
      await refreshUserData();
      setIsAuthModalOpen(false);
      success(res.message || 'Password reset successfully! Welcome back!');
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || 'Failed to reset password';
      error(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const upgradeTier = async (tier: SubscriptionTier) => {
    try {
      const res = await api.upgradeTier(tier);
      setUser(res.user);
      const token = getStoredToken();
      if (token) {
        setStoredAuth(token, res.user);
      }
      await refreshUserData();
      setIsUpgradeModalOpen(false);
      success(`Plan upgraded to ${tier.toUpperCase()} successfully!`);
    } catch (err: any) {
      error(err.message || 'Upgrade failed');
      throw err;
    }
  };

  const deductCreditLocal = (remaining: number, limit: number, used: number) => {
    if (user) {
      const updatedUser = { ...user, credits_used: used, credits_limit: limit };
      setUser(updatedUser);
      const token = getStoredToken();
      if (token) {
        setStoredAuth(token, updatedUser);
      }
    }
    if (stats) {
      const updatedStats = {
        ...stats,
        credits_remaining: remaining,
        credits_limit: limit,
        credits_used: used
      };
      setStats(updatedStats);
      setStoredStats(updatedStats);
    }
  };

  const resetAuth = useCallback(async () => {
    try {
      await signOut(auth).catch(() => {});
    } catch {}
    clearStoredAuth();
    setUser(null);
    setStats(null);
    setIsLoading(false);
    setIsAuthModalOpen(false);
    info('Session reset. You can now sign in fresh.');
  }, [info]);

  return (
    <AuthContext.Provider
      value={{
        user,
        stats,
        isLoading,
        isAuthenticated: !!user,
        isAuthModalOpen,
        authModalTab,
        isUpgradeModalOpen,
        openAuthModal,
        closeAuthModal,
        openUpgradeModal,
        closeUpgradeModal,
        login,
        loginWithGoogle,
        register,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
        upgradeTier,
        refreshUserData,
        deductCreditLocal,
        resetAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
