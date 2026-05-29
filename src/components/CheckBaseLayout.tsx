import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { FileText, LayoutGrid, Type, Palette, Boxes, ArrowRight } from 'lucide-react';

interface CheckCategoryInfo {
  id: string;
  icon: typeof LayoutGrid;
  title: string;
  description: string;
  color: string;
}

interface CheckBaseLayoutProps {
  category: CheckCategoryInfo;
  children: ReactNode;
  stats: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
  };
  relatedChecks?: Array<{ label: string; route: string }>;
}

export default function CheckBaseLayout({ category, children, stats, relatedChecks }: CheckBaseLayoutProps) {
  const { id, icon: Icon, title, description, color } = category;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 px-4 py-3 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--border)/0.4)]">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">总检查项</div>
          </div>
          <div className="w-px h-10 bg-[hsl(var(--border)/0.4)]" />
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.pass}</div>
            <div className="text-xs text-muted-foreground">通过</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.warn}</div>
            <div className="text-xs text-muted-foreground">警告</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{stats.fail}</div>
            <div className="text-xs text-muted-foreground">失败</div>
          </div>
        </div>
      </div>

      {/* Related Checks */}
      {relatedChecks && relatedChecks.length > 0 && (
        <div className="flex items-center gap-2 mb-6 px-1">
          <span className="text-xs text-muted-foreground">相关检查：</span>
          {relatedChecks.map((check) => (
            <a
              key={check.route}
              href={`#${check.route}`}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[hsl(var(--surface-secondary)/0.4)] hover:bg-[hsl(var(--surface-secondary))] text-xs text-foreground transition-colors"
            >
              {check.label}
              <ArrowRight className="w-3 h-3" />
            </a>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </motion.div>
  );
}

export const checkCategories: Record<string, CheckCategoryInfo> = {
  'full': {
    id: 'full',
    icon: FileText,
    title: '导入检测',
    description: '导入 Figma 设计稿并检测规范问题',
    color: 'from-purple-500 to-indigo-600',
  },
  'layout': {
    id: 'layout',
    icon: LayoutGrid,
    title: '布局对齐检查',
    description: '检测自动布局、对齐系统、网格结构等布局问题',
    color: 'from-blue-500 to-cyan-600',
  },
  'typography': {
    id: 'typography',
    icon: Type,
    title: '字体规范检查',
    description: '检测字号层级、字重、HMI 可读性等字体问题',
    color: 'from-green-500 to-emerald-600',
  },
  'color': {
    id: 'color',
    icon: Palette,
    title: '色彩对比检查',
    description: '检测色彩对比度、Color Token 一致性等色彩问题',
    color: 'from-orange-500 to-amber-600',
  },
  'spacing': {
    id: 'spacing',
    icon: Boxes,
    title: '间距系统检查',
    description: '检测间距一致性、安全区域、触控区域等间距问题',
    color: 'from-pink-500 to-rose-600',
  },
};

