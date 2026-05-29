import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Hexagon, ArrowLeft, ArrowRight, Sparkles, CheckCircle2, Phone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

type LoginMethod = 'wechat' | 'qq' | 'phone'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [method, setMethod] = useState<LoginMethod>('wechat')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [loginSuccess, setLoginSuccess] = useState(false)

  const sendCode = () => {
    if (!phone || phone.length < 11 || countdown > 0) return
    setCodeSent(true)
    setCountdown(60)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    login(method === 'phone' ? phone : undefined, method === 'phone' ? undefined : undefined)
    setLoginSuccess(true)
    setTimeout(() => {
      navigate('/workspace?from=home')
    }, 800)
  }

  const tabs: { id: LoginMethod; label: string }[] = [
    { id: 'wechat', label: '微信登录' },
    { id: 'qq', label: 'QQ 登录' },
    { id: 'phone', label: '手机号登录' },
  ]

  const WechatIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm3.67 2.798c-3.3 0-5.98 2.744-5.98 6.127 0 3.383 2.68 6.126 5.98 6.126.325 0 .65-.025.974-.076a.755.755 0 0 1 .636.086l1.64.96a.283.283 0 0 0 .146.047.255.255 0 0 0 .253-.255c0-.063-.026-.125-.042-.186l-.334-1.265a.526.526 0 0 1 .19-.584C20.469 18.813 22 17.247 22 15.416c0-2.456-1.982-4.67-4.422-5.502-.502-.085-1.006-.125-1.508-.125zM13.448 12.5c.43 0 .782.353.782.787a.785.785 0 0 1-.782.787.785.785 0 0 1-.782-.787c0-.434.352-.787.782-.787zm4.422 0c.43 0 .782.353.782.787a.785.785 0 0 1-.782.787.785.785 0 0 1-.782-.787c0-.434.352-.787.782-.787z"/>
    </svg>
  )

  const QQIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M21.395 15.035a39.548 39.548 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.527 4.661 17.29 2 12 2S4.474 4.661 4.474 9.24c0 .274.013.804.014.836l-1.08 2.695a38.97 38.97 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.098.474 2.122 1.05 2.886.184.243.414.448.683.595.042.624.37 3.283 1.158 3.283.393 0 .666-.528.826-1.127.236.033.478.053.722.053.247 0 .49-.02.727-.054.16.599.433 1.127.826 1.127.787 0 1.116-2.659 1.158-3.283.269-.147.5-.352.684-.595.575-.764 1.05-1.788 1.05-2.886 0 0 1.563 2.537 2.103 2.472.252-.03.583-1.39-.438-4.673z"/>
    </svg>
  )

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background overflow-hidden">
      <div className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 600px 400px at 50% 30%, hsl(var(--primary)/0.06) 0%, transparent 60%), radial-gradient(ellipse 400px 300px at 50% 70%, hsl(var(--primary)/0.04) 0%, transparent 60%)',
        }}
      />

      <AnimatePresence mode="wait">
        {loginSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center gap-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </motion.div>
            <h2 className="text-lg font-semibold text-foreground">登录成功</h2>
            <p className="text-sm text-muted-foreground">正在跳转至工作台...</p>
          </motion.div>
        ) : (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-[420px] mx-4"
          >
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft size={14} />
              返回首页
            </button>

            <div className="glass-strong rounded-2xl border border-white/[0.06] p-8 shadow-glass-lg">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                  <Hexagon className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-xl font-semibold text-foreground">欢迎回来</h1>
                <p className="text-sm text-muted-foreground mt-1">登录 HMI Agent Studio</p>
              </div>

              <div className="flex rounded-xl bg-[hsl(var(--surface-secondary)/0.3)] p-1 mb-8">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMethod(tab.id)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                      method === tab.id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {method === 'wechat' && (
                  <motion.div
                    key="wechat"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-center gap-4 p-8 rounded-xl bg-[#07c160]/5 border border-[#07c160]/10">
                      <div className="w-12 h-12 rounded-full bg-[#07c160]/10 flex items-center justify-center text-[#07c160]">
                        <WechatIcon />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">微信扫码登录</div>
                        <div className="text-xs text-muted-foreground mt-0.5">请使用微信扫描二维码</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center p-8 rounded-xl bg-white border border-white/[0.06]">
                      <div className="w-40 h-40 bg-[hsl(var(--foreground)/0.05)] rounded-xl flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-24 h-24 mx-auto rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                            <span className="text-[10px] text-muted-foreground/40">二维码</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/40 mt-2">扫码后自动登录</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleLogin}
                      className="w-full py-3 rounded-xl bg-[#07c160] hover:bg-[#06ad56] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Sparkles size={14} />
                      模拟微信登录
                    </button>
                  </motion.div>
                )}

                {method === 'qq' && (
                  <motion.div
                    key="qq"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-center gap-4 p-8 rounded-xl bg-[#12b7f5]/5 border border-[#12b7f5]/10">
                      <div className="w-12 h-12 rounded-full bg-[#12b7f5]/10 flex items-center justify-center text-[#12b7f5]">
                        <QQIcon />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">QQ 授权登录</div>
                        <div className="text-xs text-muted-foreground mt-0.5">授权 HMI Agent Studio 获取信息</div>
                      </div>
                    </div>
                    <button
                      onClick={handleLogin}
                      className="w-full py-3 rounded-xl bg-[#12b7f5] hover:bg-[#0fa5e0] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Sparkles size={14} />
                      模拟 QQ 登录
                    </button>
                  </motion.div>
                )}

                {method === 'phone' && (
                  <motion.div
                    key="phone"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">手机号</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            placeholder="请输入手机号"
                            className="w-full pl-9 pr-4 py-3 rounded-xl bg-[hsl(var(--surface-secondary)/0.3)] border border-[hsl(var(--foreground)/0.06)] text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/15 transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">验证码</label>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="请输入验证码"
                            maxLength={6}
                            className="flex-1 px-4 py-3 rounded-xl bg-[hsl(var(--surface-secondary)/0.3)] border border-[hsl(var(--foreground)/0.06)] text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/15 transition-all"
                          />
                          <button
                            type="button"
                            onClick={sendCode}
                            disabled={!phone || phone.length < 11 || countdown > 0}
                            className="px-4 py-3 rounded-xl text-xs font-medium transition-all duration-200 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed bg-primary/10 text-primary hover:bg-primary/20 border border-primary/15"
                          >
                            {countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '获取验证码'}
                          </button>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={!phone || !code}
                        className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        登录
                        <ArrowRight size={14} />
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="text-center text-[10px] text-muted-foreground/50 mt-6">
                登录即表示同意{' '}
                <span className="text-primary/60 cursor-pointer hover:text-primary transition-colors">服务协议</span>
                {' '}和{' '}
                <span className="text-primary/60 cursor-pointer hover:text-primary transition-colors">隐私政策</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}