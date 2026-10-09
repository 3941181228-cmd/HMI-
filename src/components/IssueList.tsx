import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, ChevronRight, CheckCircle2, ExternalLink, Bot, ShieldCheck, MapPin } from 'lucide-react';

export type Issue = import('../services/figmaAnalyzer').CheckIssue;

interface IssueListProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue, nodeId?: string) => void;
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

  const getStatusLabel = (issue: Issue) => {
    if (issue.status === 'uncheckable') return '未能检测';
    if (issue.status === 'review') return '待人工确认';
    if (issue.status === 'accepted') return '已接受';
    return '实测不符合所选规则';
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
          <p className="text-sm text-muted-foreground">实测 {issues.filter(i => i.status === 'open').length} · 待确认 {issues.filter(i => i.status === 'review').length} · 未检测 {issues.filter(i => i.status === 'uncheckable').length}</p>
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
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelectIssue(issue); } }}
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
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${issue.source === 'ai' ? 'bg-violet-500/10 text-violet-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {issue.source === 'ai' ? <Bot className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                      {issue.source === 'ai' ? 'AI 建议 · 未验证' : '节点规则检测'}
                    </span>
                    <span className="rounded bg-[hsl(var(--surface-secondary))] px-1.5 py-0.5 text-xs text-muted-foreground">{getStatusLabel(issue)}</span>
                    {issue.confidence !== undefined && (
                      <span className="text-xs text-muted-foreground">模型自评（非准确率） {Math.round(issue.confidence * 100)}%</span>
                    )}
                  </div>
                  <h4 className="font-medium text-foreground text-sm mb-1">{issue.title}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{issue.description}</p>
                  {(issue.nodeName || issue.nodeId || issue.location) && (
                    <div className="flex items-center gap-1.5 mb-2 text-xs text-cyan-500">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">位置：{issue.location || issue.nodeName || issue.nodeId}</span>
                      {issue.figmaUrl && (
                        <a
                          href={issue.figmaUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-0.5 hover:underline"
                        >
                          Figma <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                  {issue.nodePath && <p className="text-xs text-muted-foreground break-words mb-2">{issue.nodePath}</p>}
                  {issue.ruleId && <p className="text-sm text-muted-foreground mb-2">规则 ID：{issue.ruleId}</p>}
                  {issue.actualValue && <p className="text-sm mb-1">实测：{issue.actualValue}</p>}
                  {issue.expectedValue && <p className="text-sm mb-2 text-muted-foreground">阈值：{issue.expectedValue}</p>}
                  {!!issue.affectedNodeIds?.length && <details onClick={e => e.stopPropagation()} className="mb-2 text-xs">
                    <summary className="cursor-pointer">定位节点（{issue.affectedNodeIds.length}）</summary>
                    <div className="max-h-36 overflow-y-auto flex flex-wrap gap-2 mt-2">
                      {issue.affectedNodeIds.map(id => <button type="button" key={id}
                        className="rounded border px-2 py-1 text-cyan-500"
                        onClick={e => { e.stopPropagation(); onSelectIssue(issue, id); }}>{id}</button>)}
                    </div>
                  </details>}
                  {issue.evidence && <p className="mb-2 text-xs leading-relaxed text-muted-foreground/80">证据：{issue.evidence}</p>}
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
            <p className="text-foreground font-medium">{issues.length ? '当前筛选没有记录' : '本次规则未报告问题'}</p>
            <p className="text-sm text-muted-foreground">不代表所有设计规范均已验证；请查看检测范围与未检测项</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
