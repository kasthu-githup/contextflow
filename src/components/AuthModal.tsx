import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User as UserIcon, ArrowRight, Loader2, Eye, EyeOff, ShieldCheck, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';

export const AuthModal: React.FC = () => {
  const { 
    user,
    isAuthModalOpen, 
    closeAuthModal, 
    authModalTab, 
    login, 
    loginWithGoogle,
    register, 
    forgotPassword,
    resetPassword,
    resetAuth
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'forgot'>(authModalTab || 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync tab whenever modal opens or parent requests a specific tab
  useEffect(() => {
    if (authModalTab) {
      setActiveTab(authModalTab);
    }
    setErrorMsg('');
    setSuccessMsg('');
  }, [authModalTab, isAuthModalOpen]);

  useEffect(() => {
    if (user && isAuthModalOpen) {
      closeAuthModal();
    }
  }, [user, isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleResetForm = async () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(false);
    setIsGoogleSubmitting(false);
    await resetAuth();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    const cleanEmail = email.trim();

    try {
      if (activeTab === 'signup') {
        if (password.length < 6) {
          setErrorMsg('Password must be at least 6 characters long (குறைந்தது 6 எழுத்துக்கள் தேவை).');
          setIsSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg('Passwords do not match');
          setIsSubmitting(false);
          return;
        }
        await register(name.trim(), cleanEmail, password, confirmPassword);
        closeAuthModal();
      } else if (activeTab === 'login') {
        await login(cleanEmail, password);
        closeAuthModal();
      } else if (activeTab === 'forgot') {
        if (password) {
          if (confirmPassword && password !== confirmPassword) {
            setErrorMsg('Passwords do not match');
            setIsSubmitting(false);
            return;
          }
          await resetPassword(cleanEmail, password, confirmPassword);
          closeAuthModal();
        } else {
          await forgotPassword(cleanEmail);
          setSuccessMsg(`Password reset instructions dispatched to ${cleanEmail}`);
        }
      }
    } catch (err: any) {
      const serverMsg = err?.data?.error || err?.message;
      if (err?.status === 401 || serverMsg?.toLowerCase().includes('invalid') || serverMsg?.toLowerCase().includes('incorrect')) {
        setErrorMsg('Invalid email or password. Please check your credentials or click Reset Password.');
      } else {
        setErrorMsg(serverMsg || 'Action failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setIsGoogleSubmitting(true);
    setErrorMsg('');

    try {
      await loginWithGoogle();
      closeAuthModal();
    } catch (err: any) {
      setErrorMsg(err?.message || err?.data?.error || 'Google authentication failed.');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <div id="auth-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        id="auth-modal-card" 
        className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Close Button */}
        <button
          id="btn-close-auth-modal"
          type="button"
          aria-label="Close"
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors z-10 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-4 text-center border-b border-slate-100">
          <div className="flex justify-center mb-3">
            <Logo size="md" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {activeTab === 'signup' && 'Create your ContentFlow account'}
            {activeTab === 'login' && 'Welcome back to ContentFlow AI'}
            {activeTab === 'forgot' && 'Reset your password'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'signup' && 'Join 10,000+ creators generating viral hooks & high-converting scripts'}
            {activeTab === 'login' && 'Enter your credentials to continue'}
            {activeTab === 'forgot' && 'Enter your email to receive recovery instructions'}
          </p>
        </div>

        {/* Tabs */}
        {activeTab !== 'forgot' && (
          <div className="flex border border-slate-200 bg-slate-100/80 p-1 mx-6 mt-4 rounded-xl">
            <button
              id="tab-auth-login"
              type="button"
              onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'login' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Sign In
            </button>
            <button
              id="tab-auth-signup"
              type="button"
              onClick={() => { setActiveTab('signup'); setErrorMsg(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'signup' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2 animate-in fade-in">
            <span className="font-semibold shrink-0">Notice:</span>
            <div className="flex-1 text-[11px] leading-relaxed">
              {errorMsg}
              {errorMsg.toLowerCase().includes('already exists') && (
                <div className="mt-2 pt-2 border-t border-rose-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('forgot');
                      setErrorMsg('');
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset password for this email</span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              className="text-rose-400 hover:text-rose-700 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11px]">{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {activeTab === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="auth-name-input"
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="auth-email-input"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                {activeTab === 'forgot' ? 'New Password' : 'Password'}
              </label>
              {activeTab === 'login' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('forgot')}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="auth-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder={activeTab === 'forgot' ? 'Enter new password (min 6 chars)' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {(activeTab === 'signup' || activeTab === 'forgot') && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {activeTab === 'forgot' ? 'Confirm New Password' : 'Confirm Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="auth-confirm-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            id="btn-auth-submit"
            type="submit"
            disabled={isSubmitting || isGoogleSubmitting}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>
                  {activeTab === 'signup' && 'Create Pro Creator Account'}
                  {activeTab === 'login' && 'Sign In to Dashboard'}
                  {activeTab === 'forgot' && 'Reset Password & Sign In'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          {/* Social Sign In (Google) */}
          {activeTab !== 'forgot' && (
            <div className="pt-2">
              <div className="relative flex items-center justify-center mb-3">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider absolute">
                  Or
                </span>
              </div>

              <button
                type="button"
                id="btn-auth-modal-google"
                onClick={handleGoogleClick}
                disabled={isSubmitting || isGoogleSubmitting}
                className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-60"
              >
                {isGoogleSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                    <span>Signing in with Google…</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Reset Action Link */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
            <button
              type="button"
              id="btn-auth-reset-session"
              onClick={handleResetForm}
              className="hover:text-indigo-600 transition-colors cursor-pointer inline-flex items-center gap-1"
              title="Reset session and form inputs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset session</span>
            </button>

            {activeTab === 'login' ? (
              <button
                type="button"
                onClick={() => { setActiveTab('signup'); setErrorMsg(''); }}
                className="text-indigo-600 font-semibold hover:underline cursor-pointer"
              >
                Need an account? Sign Up
              </button>
            ) : activeTab === 'signup' ? (
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
                className="text-indigo-600 font-semibold hover:underline cursor-pointer"
              >
                Have an account? Sign In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
                className="text-indigo-600 font-semibold hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
