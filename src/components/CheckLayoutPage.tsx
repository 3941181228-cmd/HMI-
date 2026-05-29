import { motion } from 'framer-motion';
import { LayoutGrid, CheckCircle2, AlertTriangle, XCircle, ChevronRight, Search } from 'lucide-react';
import CheckBaseLayout, { checkCategories } from './CheckBaseLayout';
import { CheckIssue } from '../services/figmaAnalyzer';

interface LayoutIssue {
  id: string;
  type: 'pass' | 'warn' | 'fail';
  title: string;
  description: string;
  suggestion: string;
  position?: { x: number; y: number; width: number; height: number };
}

const mockLayoutIssues: LayoutIssue[] = [
  { id: 'layout-1', type: 'pass', title: '自动布局配置正确', description: '检测到 12 个框架正确使用自动布局', suggestion: '保持现状' },
  { id: 'layout-2', type: 'pass', title: '元素对齐一致', description: '左侧面板元素与网格对齐，右侧操作按钮对齐一致', suggestion: '保持现状' },
  { id: 'layout-3', type: 'warn', title: '网格结构不完整', description: '检测到 3 个框架未启用网格系统', suggestion: '建议为所有框架启用网格以保证布局一致性' },
  { id: 'layout-4', type: 'fail', title: '响应式布局缺失', description: '部分组件未配置响应式布局规则', suggestion: '为关键组件添加响应式断点' },
];

interface CheckLayoutPageProps {
  checkIssues?: CheckIssue[];
}

export default function CheckLayoutPage({ checkIssues = [] }: CheckLayoutPageProps) {
  const issues: LayoutIssue[] = checkIssues.length > 0
    ? checkIssues.map(i => ({
        id: i.id,
        type: (i.type === 'error' ? 'fail' : i.type === 'warning' ? 'warn' : 'pass') as LayoutIssue['type'],
        title: i.title,
        description: i.description,
        suggestion: i.suggestion,
      }))
    : mockLayoutIssues;

  const layoutIssues = issues;
  const stats = {
    total: layoutIssues.length,
    pass: layoutIssues.filter(i => i.type === 'pass').length,
    warn: layoutIssues.filter(i => i.type === 'warn').length,
    fail: layoutIssues.filter(i => i.type === 'fail').length,
  };

  const relatedChecks = [
    { label: '间距系统', route: 'check:spacing' },
    { label: '组件一致性', route: 'check:components' },
  ];

  return (
    <CheckBaseLayout
      category={checkCategories['layout']}
      stats={stats}
      relatedChecks={relatedChecks}
    >
      <div className="space-y-4">
        {layoutIssues.map((issue, index) => (
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
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
            </div>
          </motion.div>
        ))}
      </div>
    </CheckBaseLayout>
  );
}

