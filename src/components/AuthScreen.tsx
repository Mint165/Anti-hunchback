import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { User, Shield, Lock, Mail, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';

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

// Generates a 6-character OTP with exactly 3 letters and 3 numbers (e.g. A2B8C9)
const generateVerificationCode = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const chars: string[] = [];
  
  for (let i = 0; i < 3; i++) {
    chars.push(letters.charAt(Math.floor(Math.random() * letters.length)));
    chars.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
  }
  
  // Shuffle chars array
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  
  return chars.join('');
};

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'student' | 'parent'>('student');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [error, setError] = useState('');
  
  // OTP Verification States
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [pendingUser, setPendingUser] = useState<(AuthUser & { password: string }) | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isLogin) {
      // Mock login with localStorage
      const usersData = localStorage.getItem('oliver_users');
      if (usersData) {
        const users: Record<string, AuthUser & { password: string }> = JSON.parse(usersData);
        if (users[email]) {
          if (users[email].password === password) {
            const { password: _, ...userWithoutPassword } = users[email];
            toast.success('Đăng nhập thành công! 🎉');
            onLogin(userWithoutPassword);
          } else {
            setError(t('auth.invalidCredentials'));
            toast.error('Mật khẩu không đúng!');
          }
        } else {
          setError(t('auth.invalidCredentials'));
          toast.error('Tài khoản không tồn tại!');
        }
      } else {
        setError(t('auth.invalidCredentials'));
        toast.error('Tài khoản không tồn tại!');
      }
    } else {
      // Register validation
      if (!email || !password || !name) {
        setError(t('auth.fillAllFields'));
        toast.error('Vui lòng điền đầy đủ thông tin!');
        return;
      }
      
      const usersData = localStorage.getItem('oliver_users');
      const users: Record<string, AuthUser & { password: string }> = usersData ? JSON.parse(usersData) : {};
      
      if (users[email]) {
        setError(t('auth.emailExists'));
        toast.error('Email này đã được sử dụng!');
        return;
      }

      // Generate OTP Code (3 letters + 3 numbers)
      const otp = generateVerificationCode();
      setGeneratedOtp(otp);
      setPendingEmail(email);
      
      const newUser: AuthUser & { password: string } = {
        name,
        role,
        password,
        linkedCode: role === 'student' ? generateLinkCode() : undefined
      };
      
      setPendingUser(newUser);
      setIsVerifying(true);
      
      // Simulate sending email
      console.log(`[MOCK EMAIL SERVICE] Sent verification code ${otp} to ${email}`);
      toast.success(`Mã xác nhận đã gửi đến ${email}!`, { duration: 6000 });
      
      // Alert developer of simulated code in UI so they can proceed immediately
      alert(`[Nhà phát triển - Giả lập Email]\nMã xác nhận của bạn là: ${otp}\n(Vui lòng nhập mã này vào màn hình kế tiếp để kích hoạt tài khoản)`);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpCode.toUpperCase() === generatedOtp) {
      if (pendingUser && pendingEmail) {
        const usersData = localStorage.getItem('oliver_users');
        const users = usersData ? JSON.parse(usersData) : {};
        
        users[pendingEmail] = pendingUser;
        localStorage.setItem('oliver_users', JSON.stringify(users));
        
        toast.success('Kích hoạt tài khoản thành công! 🌟');
        const { password: _, ...userWithoutPassword } = pendingUser;
        onLogin(userWithoutPassword);
      }
    } else {
      setError('Mã xác nhận không chính xác. Vui lòng thử lại.');
      toast.error('Sai mã xác nhận!');
    }
  };

  const handleResendOtp = () => {
    const otp = generateVerificationCode();
    setGeneratedOtp(otp);
    toast.success('Đã gửi lại mã xác nhận mới!');
    console.log(`[MOCK EMAIL SERVICE] Resent verification code ${otp} to ${pendingEmail}`);
    alert(`[Nhà phát triển - Gửi lại Email]\nMã xác nhận mới của bạn là: ${otp}`);
  };

  if (isVerifying) {
    return (
      <div className="w-full min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Colorful gradient bubbles in background */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="relative z-10 w-full max-w-md p-8 rounded-3xl bg-white/10 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-white">
          <button 
            onClick={() => setIsVerifying(false)}
            className="absolute top-6 left-6 p-2 rounded-full hover:bg-white/10 transition-colors text-white"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="text-center mb-8 mt-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-emerald-500/30">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">Xác Minh Tài Khoản</h2>
            <p className="text-gray-300 mt-2 text-sm">
              Chúng tôi đã gửi một mã xác nhận gồm 6 ký tự (3 chữ, 3 số) đến <span className="font-bold text-primary">{pendingEmail}</span>.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-200 p-3 rounded-xl mb-6 text-sm font-medium border border-red-500/30 flex items-center gap-2">
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 text-center">Nhập mã xác nhận</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center font-black tracking-[0.3em] text-2xl text-white placeholder-gray-600"
                placeholder="A1B2C3"
                maxLength={6}
                required
              />
            </div>

            <button type="submit" className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-purple-600 hover:from-primary-hover hover:to-purple-700 font-bold shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-white">
              Kích hoạt tài khoản
            </button>
          </form>

          <div className="mt-8 text-center border-t border-white/10 pt-6">
            <p className="text-sm text-gray-400">Không nhận được mã?</p>
            <button
              onClick={handleResendOtp}
              className="text-primary font-bold mt-2 hover:underline transition-all"
            >
              Gửi lại mã xác nhận
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Colorful gradient bubbles in background */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="relative z-10 w-full max-w-md p-8 rounded-3xl bg-white/10 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-white">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black mx-auto mb-4 shadow-lg shadow-primary/30">
            O
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white">
            {isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}
          </h2>
          <p className="text-gray-300 mt-2 text-sm">
            {isLogin ? t('auth.loginDesc') : t('auth.registerDesc')}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-200 p-3 rounded-xl mb-6 text-sm font-medium border border-red-500/30 flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <>
              {/* Vibrant interactive Role Selector Cards */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div
                  onClick={() => setRole('student')}
                  className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                    role === 'student'
                      ? 'border-primary bg-primary/20 text-white shadow-lg shadow-primary/10'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <User size={24} />
                  <span className="font-bold text-sm">{t('auth.roleStudent')}</span>
                </div>
                <div
                  onClick={() => setRole('parent')}
                  className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                    role === 'parent'
                      ? 'border-purple-500 bg-purple-500/20 text-white shadow-lg shadow-purple-500/10'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <Shield size={24} />
                  <span className="font-bold text-sm">{t('auth.roleParent')}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{t('auth.fullName')}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    placeholder="Nguyễn Văn A"
                  />
                  <div className="absolute left-3 top-3.5 text-gray-500">
                    <User size={18} />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary text-white"
                placeholder="hello@example.com"
                required
              />
              <div className="absolute left-3 top-3.5 text-gray-500">
                <Mail size={18} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{t('auth.password')}</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary text-white"
                placeholder="••••••••"
                required
              />
              <div className="absolute left-3 top-3.5 text-gray-500">
                <Lock size={18} />
              </div>
            </div>
          </div>

          <button type="submit" className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-purple-600 hover:from-primary-hover hover:to-purple-700 font-bold shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-white mt-6">
            {isLogin ? t('auth.loginBtn') : t('auth.registerBtn')}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/10 pt-6">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-primary font-bold hover:underline transition-all"
          >
            {isLogin ? t('auth.switchToRegister') : t('auth.switchToLogin')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
