import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export interface AuthUser {
  name: string;
  role: 'student' | 'parent';
  linkedCode?: string; // Only for student (their own code)
  parentLinkedCode?: string; // Code parent entered to track student
}

interface AuthScreenProps {
  onLogin: (user: AuthUser) => void;
}

const generateLinkCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
};

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'student' | 'parent'>('student');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isLogin) {
      // Mock login with localStorage
      const usersData = localStorage.getItem('oliver_users');
      if (usersData) {
        const users: Record<string, AuthUser & { password: string }> = JSON.parse(usersData);
        if (users[email] && users[email].password === password) {
          const { password: _, ...userWithoutPassword } = users[email];
          onLogin(userWithoutPassword);
        } else {
          setError(t('auth.invalidCredentials'));
        }
      } else {
        setError(t('auth.invalidCredentials'));
      }
    } else {
      // Mock Register
      if (!email || !password || !name) {
        setError(t('auth.fillAllFields'));
        return;
      }
      
      const usersData = localStorage.getItem('oliver_users');
      const users: Record<string, AuthUser & { password: string }> = usersData ? JSON.parse(usersData) : {};
      
      if (users[email]) {
        setError(t('auth.emailExists'));
        return;
      }

      const newUser: AuthUser & { password: string } = {
        name,
        role,
        password,
        linkedCode: role === 'student' ? generateLinkCode() : undefined
      };

      users[email] = newUser;
      localStorage.setItem('oliver_users', JSON.stringify(users));
      
      const { password: _, ...userWithoutPassword } = newUser;
      onLogin(userWithoutPassword);
    }
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-md p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black mx-auto mb-4">
            O
          </div>
          <h2 className="text-2xl font-black text-gray-800 dark:text-white">
            {isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {isLogin ? t('auth.loginDesc') : t('auth.registerDesc')}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-6 text-sm font-medium border border-red-100 dark:bg-red-900/30 dark:border-red-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="flex gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    role === 'student'
                      ? 'bg-primary text-white shadow-btn'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300'
                  }`}
                >
                  {t('auth.roleStudent')}
                </button>
                <button
                  type="button"
                  onClick={() => setRole('parent')}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    role === 'parent'
                      ? 'bg-primary text-white shadow-btn'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300'
                  }`}
                >
                  {t('auth.roleParent')}
                </button>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('auth.fullName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  placeholder="John Doe"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              placeholder="hello@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="w-full btn-primary py-4 text-lg mt-4">
            {isLogin ? t('auth.loginBtn') : t('auth.registerBtn')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-primary font-semibold hover:underline"
          >
            {isLogin ? t('auth.switchToRegister') : t('auth.switchToLogin')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
