import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';

interface CheckBadgeProps {
  type: 'pass' | 'warn' | 'fail';
  label: string;
  detail?: string;
  onClick?: () => void;
  compact?: boolean;
}

interface CheckItem {
  id: string;
  label: string;
  type: 'pass' | 'warn' | 'fail';
  detail: string;
}

export default function CheckBadge({ type, label, detail, onClick, compact = false }: CheckBadgeProps) {
  const getIcon = () => {
    switch (type) {
      case 'pass': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'warn': return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;
      case 'fail': return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'pass': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'warn': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'fail': return 'bg-red-500/10 border-red-500/20';
    }
  };

  if (compact) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-all ${getBgColor()} hover:border-current`}
      >
        {getIcon()}
        <span className="text-foreground/80">{label}</span>
        <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
      </motion.button>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all ${getBgColor()} hover:border-current text-left`}
    >
      <div className="mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {detail && <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-1" />
    </motion.button>
  );
}

// Check items data by category
export const checkItemsByCategory: Record<string, CheckItem[]> = {
  'generate': [],
  'edit': [],
  'theme': [],
  'wallpaper': [],
  'full': [
    { id: 'layout', label: '布局对齐', type: 'pass' as const, detail: '所有元素对齐一致' },
    { id: 'typography', label: '字体规范', type: 'pass' as const, detail: '符合思源黑体规范' },
    { id: 'color', label: '色彩对比', type: 'warn' as const, detail: '部分文字对比度不足' },
    { id: 'spacing', label: '间距系统', type: 'pass' as const, detail: '8px 基准间距一致' },
  ],
};

