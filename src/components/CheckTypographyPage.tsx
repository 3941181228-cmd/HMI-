import { motion } from 'framer-motion';
import { Type, CheckCircle2, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import CheckBaseLayout, { checkCategories } from './CheckBaseLayout';
import { CheckIssue } from '../services/figmaAnalyzer';

interface TypographyIssue {
  id: string;
  type: 'pass' | 'warn' | 'fail';
  title: string;
  description: string;
  suggestion: string;
  fontSize?: string;
  fontWeight?: string;
}

const mockTypographyIssues: TypographyIssue[] = [
    { id: 'typo-1', type: 'pass', title: '字号层级规范', description: '检测到 6 级字号层级，符合 HMI 设计规范', suggestion: '保持现状', fontSize: '32/24/18/16/14/12px', fontWeight: 'Bold/Medium/Regular' },
    { id: 'typo-2', type: 'pass', title: '字体选择正确', description: '正文使用思源黑体，数字使用 DIN Alternate', suggestion: '保持现状' },
    { id: 'typo-3', type: 'warn', title: '关键信息字号偏小', description: '充电状态数字 "85%" 使用 48px，建议 ≥ 60px', suggestion: '提高关键数字字号以增强驾驶时可读性', fontSize: '48px → 60px' },
    { id: 'typo-4', type: 'fail', title: '标签文本对比度不足', description: '部分标签文本与背景对比度低于 4.5:1', suggestion: '调整文本颜色或增加背景对比度', fontSize: '14px' },
  ];

interface CheckTypographyPageProps {
  checkIssues?: CheckIssue[];
}

export default function CheckTypographyPage({ checkIssues = [] }: CheckTypographyPageProps) {
  const issues: TypographyIssue[] = checkIssues.length > 0
    ? checkIssues.map(i => ({
        id: i.id,
        type: (i.type === 'error' ? 'fail' : i.type === 'warning' ? 'warn' : 'pass') as TypographyIssue['type'],
        title: i.title,
        description: i.description,
        suggestion: i.suggestion,
      }))
    : mockTypographyIssues;

  const typographyIssues = issues;
  const stats = {
    total: typographyIssues.length,
    pass: typographyIssues.filter(i => i.type === 'pass').length,
    warn: typographyIssues.filter(i => i.type === 'warn').length,
    fail: typographyIssues.filter(i => i.type === 'fail').length,
  };

  const relatedChecks = [
    { label: '色彩对比', route: 'check:color' },
    { label: '无障碍检测', route: 'check:accessibility' },
  ];

  return (
    <CheckBaseLayout
      category={checkCategories['typography']}
      stats={stats}
      relatedChecks={relatedChecks}
    >
      <div className="space-y-4">
        {/* Font Hierarchy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--border)/0.4)]"
        >
          <h3 className="font-medium text-foreground mb-4">推荐字号层级</h3>
          <div className="space-y-3">
            {[
              { level: 'H1', size: '32px', weight: 'Bold', usage: '页面标题' },
              { level: 'H2', size: '24px', weight: 'Medium', usage: '区块标题' },
              { level: 'H3', size: '18px', weight: 'Medium', usage: '卡片标题' },
              { level: 'Body', size: '16px', weight: 'Regular', usage: '正文内容' },
              { level: 'Caption', size: '14px', weight: 'Regular', usage: '辅助说明' },
              { level: 'Label', size: '12px', weight: 'Medium', usage: '标签文字' },
            ].map((item) => (
              <div key={item.level} className="flex items-center gap-4">
                <span className="w-12 text-xs font-mono text-muted-foreground">{item.level}</span>
                <span className="w-16 text-sm font-mono text-foreground">{item.size}</span>
                <span className="w-16 text-xs text-muted-foreground">{item.weight}</span>
                <span className="text-sm text-muted-foreground">{item.usage}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Issues List */}
        {typographyIssues.map((issue, index) => (
          <motion.div
            key={issue.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
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
                {issue.fontSize && (
                  <div className="mt-2 px-2 py-1 rounded bg-[hsl(var(--surface))] text-xs font-mono text-muted-foreground inline-block">
                    当前: {issue.fontSize}
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

