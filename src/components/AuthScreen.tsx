import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { User, Shield, Lock, Mail, ArrowLeft, CheckCircle2, ShieldAlert, Eye, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { encryptData, decryptData } from '../utils/crypto';
import { supabase } from '../services/supabase';

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

const validateEmailOrUsername = (input: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return emailRegex.test(input) || usernameRegex.test(input);
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
  const [showMockEmailModal, setShowMockEmailModal] = useState(false);

  const getUsers = () => {
    const usersData = localStorage.getItem('oliver_users');
    if (!usersData) return {};
    try {
      const decrypted = decryptData(usersData);
      if (decrypted) return decrypted;
      return JSON.parse(usersData);
    } catch {
      return {};
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isLogin) {
      if (supabase) {
        // Supabase Auth Login
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) {
          setError(signInError.message);
          toast.error('Đăng nhập thất bại: ' + signInError.message);
          return;
        }
        
        if (data.user) {
          const metadata = data.user.user_metadata || {};
          toast.success('Đăng nhập thành công! 🎉');
          onLogin({
            name: metadata.name || email.split('@')[0],
            role: metadata.role || 'student',
            linkedCode: metadata.linkedCode,
            parentLinkedCode: metadata.parentLinkedCode
          });
        }
      } else {
        // Fallback to localStorage
        const users: Record<string, AuthUser & { password: string }> = getUsers();
        if (users[email]) {
          if (users[email].password === password) {
            const { password: _, ...userWithoutPassword } = users[email];
            toast.success('Đăng nhập thành công (Local)! 🎉');
            onLogin(userWithoutPassword);
          } else {
            setError(t('auth.invalidCredentials'));
            toast.error('Mật khẩu không đúng!');
          }
        } else {
          setError(t('auth.invalidCredentials'));
          toast.error('Tài khoản không tồn tại!');
        }
      }
    } else {
      // Register validation
      if (!email || !password || !name) {
        setError(t('auth.fillAllFields'));
        toast.error('Vui lòng điền đầy đủ thông tin!');
        return;
      }

      if (!validateEmailOrUsername(email)) {
        setError('Vui lòng nhập Email hợp lệ hoặc Tên đăng nhập (3-20 ký tự, không dấu, không khoảng trắng, chỉ dùng chữ, số và dấu gạch dưới).');
        toast.error('Định dạng không hợp lệ!');
        return;
      }
      
      const isEmailInput = email.includes('@');
      
      if (supabase && isEmailInput) {
        // Supabase Auth Register (Only for emails)
        const linkedCode = role === 'student' ? generateLinkCode() : undefined;
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role,
              linkedCode
            }
          }
        });
        
        if (signUpError) {
          setError(signUpError.message);
          toast.error('Đăng ký thất bại: ' + signUpError.message);
          return;
        }
        
        if (data.session) {
          toast.success('Đăng ký thành công! 🌟');
          onLogin({
            name,
            role,
            linkedCode
          });
        } else {
          toast.success('Vui lòng kiểm tra email của bạn để xác thực tài khoản!', { duration: 6000 });
        }
      } else {
        // Fallback to Mock Auth (or Username since Supabase needs real email)
        const users: Record<string, AuthUser & { password: string }> = getUsers();
        
        if (users[email]) {
          const errMsg = isEmailInput ? 'Email này đã được sử dụng!' : 'Tên đăng nhập này đã được sử dụng!';
          setError(errMsg);
          toast.error(errMsg);
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
        
        // Simulate sending verification code
        if (isEmailInput) {
          console.log(`[MOCK EMAIL SERVICE] Sent verification code ${otp} to ${email}`);
          toast.success(`Mã xác nhận đã gửi đến email ${email}!`, { duration: 6000 });
        } else {
          console.log(`[MOCK USERNAME SERVICE] Generated verification code ${otp} for username ${email}`);
          toast.success(`Mã xác nhận đã được tạo cho tên đăng nhập ${email}!`, { duration: 6000 });
        }
        
        setShowMockEmailModal(true);
      }
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpCode.toUpperCase() === generatedOtp) {
      if (pendingUser && pendingEmail) {
        const users = getUsers();
        
        users[pendingEmail] = pendingUser;
        localStorage.setItem('oliver_users', encryptData(users));
        
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
    setShowMockEmailModal(true);
  };

  if (isVerifying) {
    return (
      <div className="w-full min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Colorful gradient bubbles in background */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="relative z-10 w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white/10 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-white">
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
            <h2 className="text-2xl font-black tracking-tight text-white animate-fade-in">Xác Minh Tài Khoản</h2>
            <p className="text-gray-300 mt-2 text-sm">
              Chúng tôi đã gửi một mã xác nhận gồm 6 ký tự (3 chữ, 3 số) đến {pendingEmail.includes('@') ? 'email' : 'tên đăng nhập'} <span className="font-bold text-primary">{pendingEmail}</span>.
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
                className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center font-black tracking-[0.3em] text-2xl text-white placeholder-gray-600 transition-all"
                placeholder="A1B2C3"
                maxLength={6}
                required
              />
            </div>

            <button 
              type="submit" 
              className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-purple-600 hover:from-primary-hover hover:to-purple-700 font-extrabold text-white shadow-[0_4px_20px_rgba(92,60,241,0.4)] hover:shadow-[0_4px_25px_rgba(92,60,241,0.6)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300"
            >
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

        {showMockEmailModal && (() => {
          const isEmailInput = pendingEmail.includes('@');
          return (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-fade-in text-center relative">
                 <button onClick={() => setShowMockEmailModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white">
                   <X size={20} />
                 </button>
                 <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                   {isEmailInput ? <Mail size={32} className="text-blue-500" /> : <User size={32} className="text-blue-500" />}
                 </div>
                 <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-2">
                   {isEmailInput ? 'Email giả lập' : 'Xác thực giả lập'}
                 </h3>
                 <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">
                   {isEmailInput 
                     ? 'Đây là mã xác thực email giả lập. Hãy nhập mã này vào trang sau để có thể xác thực tài khoản và bắt đầu sử dụng.'
                     : 'Đây là mã xác thực tài khoản giả lập. Hãy nhập mã này vào trang sau để có thể xác thực tài khoản và bắt đầu sử dụng.'}
                 </p>
                 <div className="text-4xl font-black text-primary tracking-[0.2em] mb-6 bg-primary/10 py-3 rounded-xl border border-primary/20">
                   {generatedOtp}
                 </div>
                 <button onClick={() => setShowMockEmailModal(false)} className="btn-primary w-full py-3">
                   Đóng
                 </button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Colorful gradient bubbles in background */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="relative z-10 w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white/10 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-white">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-primary/40 transform hover:scale-105 transition-all">
            <Eye size={32} className="text-white" />
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
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Email hoặc Tên đăng nhập</label>
            <div className="relative">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary text-white"
                placeholder="Email hoặc Tên đăng nhập"
                required
              />
              <div className="absolute left-3 top-3.5 text-gray-500">
                {email && !email.includes('@') ? <User size={18} /> : <Mail size={18} />}
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

          <button 
            type="submit" 
            className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-purple-600 hover:from-primary-hover hover:to-purple-700 font-extrabold text-white shadow-[0_4px_20px_rgba(92,60,241,0.4)] hover:shadow-[0_4px_25px_rgba(92,60,241,0.6)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 mt-6"
          >
            {isLogin ? t('auth.loginBtn') : t('auth.registerBtn')}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/10 pt-6 flex flex-col items-center gap-3">
          <span className="text-sm text-gray-400">
            {isLogin ? "Bạn mới tham gia?" : "Đã có tài khoản?"}
          </span>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="w-full py-3.5 px-6 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] duration-200"
          >
            {isLogin ? "Đăng ký tài khoản mới" : "Đăng nhập ngay"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
