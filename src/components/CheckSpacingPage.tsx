import { motion } from 'framer-motion';
import { Boxes, CheckCircle2, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import CheckBaseLayout, { checkCategories } from './CheckBaseLayout';
import { CheckIssue } from '../services/figmaAnalyzer';

interface SpacingIssue {
  id: string;
  type: 'pass' | 'warn' | 'fail';
  title: string;
  description: string;
  suggestion: string;
  spacing?: string;
}

const mockSpacingIssues: SpacingIssue[] = [
    { id: 'spacing-1', type: 'pass', title: '基准间距系统正确', description: '检测到 8px 基准间距系统，所有间距均为 8 的倍数', suggestion: '保持现状', spacing: '8px' },
    { id: 'spacing-2', type: 'pass', title: '卡片间距一致', description: '卡片组间距统一为 16px', suggestion: '保持现状', spacing: '16px' },
    { id: 'spacing-3', type: 'warn', title: '触控区域过小', description: '检测到 2 个按钮触控区域小于 44x44px', suggestion: '增大触控区域至 44x44px 以上', spacing: '36x36px' },
    { id: 'spacing-4', type: 'fail', title: '安全区域未适配', description: '部分元素未考虑 iOS 安全区域', suggestion: '为刘海屏设备添加安全区域内边距' },
  ];

interface CheckSpacingPageProps {
  checkIssues?: CheckIssue[];
}

export default function CheckSpacingPage({ checkIssues = [] }: CheckSpacingPageProps) {
  const issues: SpacingIssue[] = checkIssues.length > 0
    ? checkIssues.map(i => ({
        id: i.id,
        type: (i.type === 'error' ? 'fail' : i.type === 'warning' ? 'warn' : 'pass') as SpacingIssue['type'],
        title: i.title,
        description: i.description,
        suggestion: i.suggestion,
      }))
    : mockSpacingIssues;

  const spacingIssues = issues;
  const stats = {
    total: spacingIssues.length,
    pass: spacingIssues.filter(i => i.type === 'pass').length,
    warn: spacingIssues.filter(i => i.type === 'warn').length,
    fail: spacingIssues.filter(i => i.type === 'fail').length,
  };

  const relatedChecks = [
    { label: '布局对齐', route: 'check:layout' },
    { label: '无障碍检测', route: 'check:accessibility' },
  ];

  return (
    <CheckBaseLayout
      category={checkCategories['spacing']}
      stats={stats}
      relatedChecks={relatedChecks}
    >
      <div className="space-y-4">
        {/* Spacing System */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--border)/0.4)]"
        >
          <h3 className="font-medium text-foreground mb-4">间距系统</h3>
          <div className="flex items-end gap-4">
            {[4, 8, 12, 16, 24, 32, 48].map((size) => (
              <div key={size} className="flex flex-col items-center">
                <div
                  className="bg-primary/20 rounded"
                  style={{ width: size * 2, height: size }}
                />
                <span className="text-xs font-mono text-muted-foreground mt-2">{size}px</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Touch Target */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--border)/0.4)]"
        >
          <h3 className="font-medium text-foreground mb-4">触控区域标准</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-11 h-11 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center">
                  <span className="text-xs text-red-400">44</span>
                </div>
                <div className="absolute -inset-2 border-2 border-dashed border-red-500/30 rounded-full" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">最小触控区域</div>
                <div className="text-xs text-muted-foreground">44 x 44px (iOS) / 48 x 48dp (Android)</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center">
                <span className="text-xs text-emerald-400">56</span>
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">推荐触控区域</div>
                <div className="text-xs text-muted-foreground">56 x 56px (HMI 最佳实践)</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Issues List */}
        {spacingIssues.map((issue, index) => (
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
                {issue.spacing && (
                  <div className="mt-2 px-2 py-1 rounded bg-[hsl(var(--surface))] text-xs font-mono text-muted-foreground inline-block">
                    当前: {issue.spacing}
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

