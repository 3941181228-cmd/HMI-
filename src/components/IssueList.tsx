import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, ChevronRight, CheckCircle2 } from 'lucide-react';

export interface Issue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  suggestion: string;
  position?: { x: number; y: number; width: number; height: number };
  severity: 'high' | 'medium' | 'low';
}

interface IssueListProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  selectedIssueId?: string;
}

export default function IssueList({ issues, onSelectIssue, selectedIssueId }: IssueListProps) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const filteredIssues = issues.filter(issue => filter === 'all' || issue.type === filter);

  const getTypeIcon = (type: Issue['type']) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-4 h-4 text-[hsl(var(--destructive))]" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" />;
      case 'info': return <Info className="w-4 h-4 text-[hsl(var(--primary))]" />;
    }
  };

  const getTypeColor = (type: Issue['type']) => {
    switch (type) {
      case 'error': return 'border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.05)]';
      case 'warning': return 'border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.05)]';
      case 'info': return 'border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)]';
    }
  };

  const getSeverityLabel = (severity: Issue['severity']) => {
    switch (severity) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
    }
  };

  const getSeverityColor = (severity: Issue['severity']) => {
    switch (severity) {
      case 'high': return 'bg-[hsl(var(--destructive))]';
      case 'medium': return 'bg-[hsl(var(--warning))]';
      case 'low': return 'bg-[hsl(var(--success))]';
    }
  };

  const stats = {
    all: issues.length,
    error: issues.filter(i => i.type === 'error').length,
    warning: issues.filter(i => i.type === 'warning').length,
    info: issues.filter(i => i.type === 'info').length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">问题列表</h3>
          <p className="text-sm text-muted-foreground">{issues.length} 个问题待处理</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'error', 'warning', 'info'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-[hsl(var(--surface-secondary)/0.4)] text-muted-foreground hover:text-foreground'
            }`}
          >
            {key === 'all' ? '全部' : key === 'error' ? '错误' : key === 'warning' ? '警告' : '提示'}
            <span className="ml-1 opacity-70">({stats[key]})</span>
          </button>
        ))}
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        <AnimatePresence>
          {filteredIssues.map((issue, index) => (
            <motion.div
              key={issue.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelectIssue(issue)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedIssueId === issue.id
                  ? `${getTypeColor(issue.type)} ring-2 ring-primary/50`
                  : 'border-[hsl(var(--border)/0.4)] hover:border-[hsl(var(--border))]'
              }`}
            >
              <div className="flex items-start gap-3">
                {getTypeIcon(issue.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--surface))] text-muted-foreground">
                      {issue.category}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${getSeverityColor(issue.severity)}`} />
                    <span className="text-xs text-muted-foreground">严重程度: {getSeverityLabel(issue.severity)}</span>
                  </div>
                  <h4 className="font-medium text-foreground text-sm mb-1">{issue.title}</h4>
                  <p className="text-xs text-muted-foreground mb-2">{issue.description}</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-[hsl(var(--success))]" />
                    <span className="text-xs text-[hsl(var(--success))]">{issue.suggestion}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredIssues.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--success))]" />
            <p className="text-foreground font-medium">没有发现问题</p>
            <p className="text-sm text-muted-foreground">您的设计稿符合 HMI 设计规范</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// Mock issues data
export const mockIssues: Issue[] = [
  {
    id: '1',
    type: 'error',
    category: '布局',
    title: '自动布局未启用',
    description: '检测到多个框架未使用自动布局，建议启用以保证响应式布局。',
    suggestion: '启用自动布局',
    position: { x: 100, y: 200, width: 200, height: 100 },
    severity: 'high',
  },
  {
    id: '2',
    type: 'warning',
    category: '字体',
    title: '字号层级不规范',
    description: '检测到文本字号未遵循设计系统规范，建议统一字号层级。',
    suggestion: '统一字号为 12/14/16/18/24/32',
    position: { x: 150, y: 350, width: 180, height: 30 },
    severity: 'medium',
  },
  {
    id: '3',
    type: 'warning',
    category: '用户体验',
    title: '触控区域过小',
    description: '按钮触控区域小于 44px 最小标准，影响驾驶时的操作安全性。',
    suggestion: '增大触控区域至 44x44px',
    position: { x: 200, y: 450, width: 32, height: 32 },
    severity: 'high',
  },
  {
    id: '4',
    type: 'info',
    category: '视觉系统',
    title: '圆角不一致',
    description: '检测到不同组件使用了不同的圆角值，建议统一设计规范。',
    suggestion: '统一圆角为 12px',
    position: { x: 250, y: 500, width: 150, height: 80 },
    severity: 'low',
  },
  {
    id: '5',
    type: 'error',
    category: '无障碍',
    title: '对比度不足',
    description: '文本与背景对比度低于 WCAG AA 标准，影响可读性。',
    suggestion: '提高对比度至 4.5:1',
    position: { x: 80, y: 150, width: 220, height: 24 },
    severity: 'high',
  },
  {
    id: '6',
    type: 'info',
    category: '一致性',
    title: '阴影效果不一致',
    description: '检测到多个相似组件使用了不同的阴影参数。',
    suggestion: '统一阴影为 0 4px 12px rgba(0,0,0,0.1)',
    position: { x: 300, y: 300, width: 180, height: 120 },
    severity: 'low',
  },
];

