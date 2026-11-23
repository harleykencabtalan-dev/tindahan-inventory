import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { Store, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { auth } from '../firebase';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setError('Incorrect email or password.');
      } else if (code === 'auth/email-already-in-use') {
        setError('This email is already registered. Try signing in instead.');
      } else if (code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else if (code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password sign-in is not enabled yet in Firebase Console (Security → Authentication).'
        );
      } else {
        setError('Could not sign in. Please check your internet and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-5 py-8 max-w-md mx-auto">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-sm">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 mt-3">Tindahan POS</h1>
          <p className="text-xs text-slate-500 mt-1">
            Sari-Sari Store &amp; Bigasan • Cloud Sync + Offline
          </p>
        </div>

        <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'login' ? 'bg-white text-teal-800 shadow-2xs' : 'text-slate-500'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'register' ? 'bg-white text-teal-800 shadow-2xs' : 'text-slate-500'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="store@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold text-sm shadow-sm active:scale-[0.99]"
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign In to Store'
                : 'Create Store Account'}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-400 leading-relaxed">
          Sign in with the same account on your phone and PC to keep inventory &amp; sales synced.
        </p>
      </div>
    </div>
  );
}
