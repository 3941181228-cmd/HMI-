import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Link2, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
interface FigmaImportPanelProps {
 onImport: (url: string) => void;
 isConnecting: boolean;
 connectionStatus: 'idle' | 'connected' | 'error';
 currentFile?: string;
 currentPage?: string;
 errorMessage?: string;
}
export default function FigmaImportPanel({ onImport, isConnecting, connectionStatus, currentFile, currentPage, errorMessage }: FigmaImportPanelProps) {
 const [url, setUrl] = useState('');
 const [error, setError] = useState('');
 const validateFigmaUrl = (inputUrl: string): boolean => {
    // 支持 file, proto, design 三种 Figma URL 格式
    const figmaRegex = /^https?:\/\/(?:www\.)?figma\.com\/(file|proto|design)\/[a-zA-Z0-9-_]+\/?.*$/;
    return figmaRegex.test(inputUrl);
  };
 const handleConnect = () => {
 if (!url.trim()) {
 setError('请输入 Figma 链接');
 return;
 }
 if (!validateFigmaUrl(url)) {
 setError('请输入有效的 Figma 文件链接');
 return;
 }
 setError('');
 onImport(url);
 };
 return (<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
 {/* Figma Import Header */}
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
 <FileText className="w-5 h-5 text-white"/>
 </div>
 <div>
 <h3 className="text-lg font-semibold text-foreground">Figma 导入</h3>
 <p className="text-sm text-muted-foreground">接入 Figma 设计稿进行 AI 检测</p>
 </div>
 </div>

 {/* Connection Status */}
 {connectionStatus === 'connected' && currentFile && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[hsl(var(--success)/0.1)] border border-[hsl(var(--success)/0.2)] rounded-xl p-4">
 <div className="flex items-center gap-3">
 <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]"/>
 <div>
 <p className="text-sm font-medium text-foreground">已连接 Figma</p>
 <p className="text-xs text-muted-foreground">当前文件: {currentFile}</p>
 {currentPage && (<p className="text-xs text-muted-foreground">当前页面: {currentPage}</p>)}
 </div>
 </div>
 </motion.div>)}

 {connectionStatus === 'error' && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.2)] rounded-xl p-4">
 <div className="flex items-center gap-3">
 <AlertCircle className="w-5 h-5 text-[hsl(var(--destructive))]"/>
 <div>
 <p className="text-sm font-medium text-[hsl(var(--destructive))]">连接失败</p>
 <p className="text-xs text-muted-foreground">{errorMessage || '请检查 Figma 链接是否正确，确保使用有效的 Figma 文件链接'}</p>
 </div>
 </div>
 </motion.div>)}

 {/* URL Input */}
 <div className="space-y-2">
 <label className="text-sm font-medium text-foreground flex items-center gap-2">
 <Link2 className="w-4 h-4"/>
 Figma 文件链接
 </label>
 <div className="relative">
 <input type="url" value={url} onChange={(e) => {
 setUrl(e.target.value);
 setError('');
 }} placeholder="https://www.figma.com/file/..." className="w-full bg-[hsl(var(--surface-secondary)/0.4)] border border-[hsl(var(--border)/0.4)] rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] focus:border-primary transition-all"/>
 {isConnecting && (<motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="absolute right-3 top-1/2 -translate-y-1/2">
 <RefreshCw className="w-4 h-4 text-primary"/>
 </motion.div>)}
 </div>
 {error && (<p className="text-xs text-[hsl(var(--destructive))]">{error}</p>)}
 </div>

 {/* Connect Button */}
 <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={handleConnect} disabled={isConnecting} className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2">
 {isConnecting ? (<>
 <RefreshCw className="w-4 h-4 animate-spin"/>
 连接中...
 </>) : (<>
 连接 Figma
 </>)}
 </motion.button>

 {/* Tips */}
 <div className="text-xs text-muted-foreground space-y-1">
 <p>支持格式:</p>
 <ul className="list-disc list-inside space-y-0.5">
 <li>Figma 文件链接</li>
 <li>Figma 原型链接</li>
 </ul>
 </div>
 </motion.div>);
}

