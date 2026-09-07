import { motion } from 'framer-motion';
import { LayoutGrid, Type, Palette, Boxes, CheckCircle2, AlertTriangle, Info, Sparkles, ChevronRight, Zap, Target, BarChart3 } from 'lucide-react';
import { CategoryAnalysis, DesignHighlight, ImprovementSuggestion, AnalysisMetric } from '../services/figmaAnalyzer';

interface AnalysisReportProps {
  categories: CategoryAnalysis[];
  highlights: DesignHighlight[];
  suggestions: ImprovementSuggestion[];
  documentInfo: {
    name?: string;
    pageCount: number;
    componentCount: number;
    instanceCount: number;
  };
  frameCount: number;
  textCount: number;
  totalNodes: number;
}

const categoryIcons: Record<string, typeof LayoutGrid> = {
  layout: LayoutGrid,
  typography: Type,
  color: Palette,
  spacing: Boxes,
};

const getStatusColor = (status: AnalysisMetric['status']): string => {
  switch (status) {
    case 'good': return 'text-[hsl(var(--success))]';
    case 'warning': return 'text-[hsl(var(--warning))]';
    case 'error': return 'text-[hsl(var(--destructive))]';
    default: return 'text-muted-foreground';
  }
};

const getStatusBg = (status: AnalysisMetric['status']): string => {
  switch (status) {
    case 'good': return 'bg-[hsl(var(--success)/0.1)]';
    case 'warning': return 'bg-[hsl(var(--warning)/0.1)]';
    case 'error': return 'bg-[hsl(var(--destructive)/0.1)]';
    default: return 'bg-[hsl(var(--surface-secondary))]';
  }
};

const getPriorityColor = (priority: ImprovementSuggestion['priority']): string => {
  switch (priority) {
    case 'high': return 'bg-[hsl(var(--destructive))]';
    case 'medium': return 'bg-[hsl(var(--warning))]';
    case 'low': return 'bg-[hsl(var(--primary))]';
    default: return 'bg-muted-foreground';
  }
};

const getPriorityLabel = (priority: ImprovementSuggestion['priority']): string => {
  switch (priority) {
    case 'high': return '高';
    case 'medium': return '中';
    case 'low': return '低';
    default: return '未知';
  }
};

export default function AnalysisReport({
  categories,
  highlights,
  suggestions,
  documentInfo,
  frameCount,
  textCount,
  totalNodes,
}: AnalysisReportProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Document Overview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-[hsl(var(--surface))] rounded-xl border border-[hsl(var(--border)/0.4)] p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h4 className="font-semibold text-foreground">文档概览</h4>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.4)]">
            <p className="text-[10px] text-muted-foreground mb-1">页面数量</p>
            <p className="text-xl font-bold text-foreground">{documentInfo.pageCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.4)]">
            <p className="text-[10px] text-muted-foreground mb-1">组件数量</p>
            <p className="text-xl font-bold text-foreground">{documentInfo.componentCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.4)]">
            <p className="text-[10px] text-muted-foreground mb-1">实例数量</p>
            <p className="text-xl font-bold text-foreground">{documentInfo.instanceCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.4)]">
            <p className="text-[10px] text-muted-foreground mb-1">节点总数</p>
            <p className="text-xl font-bold text-foreground">{totalNodes}</p>
          </div>
        </div>
        <div className="flex gap-4 mt-4 pt-4 border-t border-[hsl(var(--border)/0.2)]">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">画板: {frameCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">文本: {textCount}</span>
          </div>
        </div>
      </motion.div>

      {/* Design Highlights */}
      {highlights.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-[hsl(var(--surface))] rounded-xl border border-[hsl(var(--border)/0.4)] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-[hsl(var(--success))]" />
            <h4 className="font-semibold text-foreground">设计亮点</h4>
          </div>
          <div className="space-y-3">
            {highlights.slice(0, 5).map((highlight, index) => (
              <motion.div
                key={highlight.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(var(--success)/0.05)] border border-[hsl(var(--success)/0.15)]"
              >
                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{highlight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{highlight.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Improvement Suggestions */}
      {suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-[hsl(var(--surface))] rounded-xl border border-[hsl(var(--border)/0.4)] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-[hsl(var(--warning))]" />
            <h4 className="font-semibold text-foreground">改进建议</h4>
            <span className="text-xs text-muted-foreground">({suggestions.length} 项)</span>
          </div>
          <div className="space-y-3">
            {suggestions.slice(0, 6).map((suggestion, index) => (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="p-4 rounded-lg bg-[hsl(var(--surface-secondary)/0.4)] border border-[hsl(var(--border)/0.2)]"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${getPriorityColor(suggestion.priority)}`}>
                      {getPriorityLabel(suggestion.priority)}
                    </span>
                    <span className="text-xs text-muted-foreground">{suggestion.category}</span>
                  </div>
                  {suggestion.affectedNodes && (
                    <span className="text-[10px] text-muted-foreground">
                      影响 {suggestion.affectedNodes} 个元素
                    </span>
                  )}
                </div>
                <h5 className="text-sm font-medium text-foreground mb-1">{suggestion.title}</h5>
                <p className="text-xs text-muted-foreground mb-2">{suggestion.description}</p>
                <div className="flex items-center gap-2 p-2 rounded bg-[hsl(var(--surface))]">
                  <Target className="w-3 h-3 text-primary" />
                  <span className="text-[10px] text-foreground">{suggestion.actionable}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Category Analysis */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <h4 className="font-semibold text-foreground">详细分析</h4>
        {categories.map((category, index) => {
          const Icon = categoryIcons[category.id] || LayoutGrid;
          return (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + index * 0.1 }}
              className="bg-[hsl(var(--surface))] rounded-xl border border-[hsl(var(--border)/0.4)] overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-[hsl(var(--surface-secondary)/0.2)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium text-foreground">{category.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {category.metrics.length} 项指标
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
              <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                {category.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className={`p-3 rounded-lg ${getStatusBg(metric.status)}`}
                  >
                    <p className="text-[10px] text-muted-foreground mb-1">{metric.label}</p>
                    <p className={`text-lg font-bold ${getStatusColor(metric.status)}`}>
                      {metric.value}{metric.unit ? ` ${metric.unit}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
