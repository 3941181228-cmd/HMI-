import { motion } from 'framer-motion';
import { Boxes, CheckCircle2, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import CheckBaseLayout, { checkCategories } from './CheckBaseLayout';

interface ComponentIssue {
  id: string;
  type: 'pass' | 'warn' | 'fail';
  title: string;
  description: string;
  suggestion: string;
  radius?: string;
}

const componentIssues: ComponentIssue[] = [
  {
    id: 'comp-1',
    type: 'pass',
    title: '圆角系统统一',
    description: '检测到 12px 圆角系统，所有组件使用统一圆角值',
    suggestion: '保持现状',
    radius: '12px',
  },
  {
    id: 'comp-2',
    type: 'pass',
    title: '阴影风格一致',
    description: '所有卡片使用统一的阴影配置',
    suggestion: '保持现状',
  },
  {
    id: 'comp-3',
    type: 'warn',
    title: '部分按钮样式不一致',
    description: '检测到 3 个按钮使用了不同的圆角值（8px vs 12px）',
    suggestion: '统一为 12px 圆角',
    radius: '8px → 12px',
  },
  {
    id: 'comp-4',
    type: 'fail',
    title: '图标风格不统一',
    description: '部分图标使用了线性风格，部分使用了填充风格',
    suggestion: '统一为线性风格（2px stroke）',
  },
];

export default function CheckComponentsPage() {
  const stats = {
    total: componentIssues.length,
    pass: componentIssues.filter(i => i.type === 'pass').length,
    warn: componentIssues.filter(i => i.type === 'warn').length,
    fail: componentIssues.filter(i => i.type === 'fail').length,
  };

  const relatedChecks = [
    { label: '色彩对比', route: 'check:color' },
    { label: '布局对齐', route: 'check:layout' },
  ];

  return (
    <CheckBaseLayout
      category={checkCategories['components']}
      stats={stats}
      relatedChecks={relatedChecks}
    >
      <div className="space-y-4">
        {/* Component Standards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--border)/0.4)]"
        >
          <h3 className="font-medium text-foreground mb-4">组件规范</h3>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2">圆角</div>
              <div className="flex items-center justify-center gap-2">
                {[4, 8, 12, 16].map((r) => (
                  <div
                    key={r}
                    className="w-10 h-10 bg-primary/20 border border-primary/30"
                    style={{ borderRadius: r }}
                  />
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-2">推荐 8-12px</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2">阴影</div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-8 bg-[hsl(var(--surface-secondary))] rounded-lg"
                    style={{
                      boxShadow: `0 ${i}px ${i * 2}px rgba(0,0,0,${0.1 * i})`,
                    }}
                  />
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-2">统一阴影层级</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-2">图标</div>
              <div className="flex items-center justify-center gap-3">
                {['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'].map((p, i) => (
                  <svg key={i} className="w-6 h-6 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d={p} />
                  </svg>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-2">2px stroke</div>
            </div>
          </div>
        </motion.div>

        {/* Component Gallery */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--border)/0.4)]"
        >
          <h3 className="font-medium text-foreground mb-4">组件一致性示例</h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { name: '主按钮', style: 'bg-primary text-white rounded-xl px-4 py-2' },
              { name: '次按钮', style: 'bg-[hsl(var(--surface-secondary))] rounded-xl px-4 py-2 border' },
              { name: '卡片', style: 'bg-[hsl(var(--surface))] rounded-xl p-4 border' },
              { name: '输入框', style: 'bg-[hsl(var(--surface))] rounded-xl px-3 py-2 border' },
            ].map((item) => (
              <div key={item.name} className="text-center">
                <div className={item.style}>
                  <span className="text-xs">按钮</span>
                </div>
                <span className="text-xs text-muted-foreground mt-2 block">{item.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Issues List */}
        {componentIssues.map((issue, index) => (
          <motion.div
            key={issue.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            className={`p-5 rounded-xl border ${
              issue.type === 'pass'
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : issue.type === 'warn'
                ? 'bg-yellow-500/5 border-yellow-500/20'
                : 'bg-red-500/5 border-red-500/20'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`mt-1 ${
                issue.type === 'pass'
                  ? 'text-emerald-400'
                  : issue.type === 'warn'
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}>
                {issue.type === 'pass' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : issue.type === 'warn' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-foreground mb-1">{issue.title}</h3>
                <p className="text-sm text-muted-foreground mb-2">{issue.description}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">建议：</span>
                  <span className={
                    issue.type === 'pass'
                      ? 'text-emerald-400'
                      : issue.type === 'warn'
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }>{issue.suggestion}</span>
                </div>
                {issue.radius && (
                  <div className="mt-2 px-2 py-1 rounded bg-[hsl(var(--surface))] text-xs font-mono text-muted-foreground inline-block">
                    {issue.radius}
                  </div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
            </div>
          </motion.div>
        ))}
      </div>
    </CheckBaseLayout>
  );
}

