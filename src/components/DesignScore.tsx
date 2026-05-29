import { motion } from 'framer-motion';
import { Trophy, LayoutGrid, Type, Car, Palette, Eye, Layers } from 'lucide-react';

interface ScoreCategory {
  id: string;
  icon: typeof LayoutGrid;
  label: string;
  score: number;
  maxScore: number;
}

interface DesignScoreProps {
  categories: ScoreCategory[];
  overallScore: number;
  level: string;
}

export default function DesignScore({ categories, overallScore, level }: DesignScoreProps) {
  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-[hsl(var(--success))]';
    if (score >= 70) return 'text-[hsl(var(--warning))]';
    return 'text-[hsl(var(--destructive))]';
  };

  const getScoreBg = (score: number): string => {
    if (score >= 90) return 'bg-[hsl(var(--success)/0.1)]';
    if (score >= 70) return 'bg-[hsl(var(--warning)/0.1)]';
    return 'bg-[hsl(var(--destructive)/0.1)]';
  };

  const getLevelColor = (level: string): string => {
    const colors: Record<string, string> = {
      '高级汽车界面': 'from-primary to-purple-500',
      '专业级': 'from-blue-500 to-cyan-500',
      '良好': 'from-green-500 to-emerald-500',
      '基础': 'from-yellow-500 to-orange-500',
    };
    return colors[level] || 'from-gray-500 to-gray-600';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Overall Score */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative"
      >
        <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur-xl" />
        <div className="relative bg-[hsl(var(--surface))] rounded-xl p-6 border border-[hsl(var(--border)/0.4)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">设计评分</span>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getLevelColor(level)} text-white`}
            >
              {level}
            </motion.div>
          </div>
          
          <div className="flex items-baseline gap-2">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.3 }}
              className={`text-5xl font-bold ${getScoreColor(overallScore)}`}
            >
              {overallScore}
            </motion.span>
            <span className="text-lg text-muted-foreground">/ 100</span>
          </div>
        </div>
      </motion.div>

      {/* Category Scores */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground">评分详情</h4>
        {categories.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className="bg-[hsl(var(--surface-secondary)/0.4)] rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${getScoreBg(category.score)} flex items-center justify-center`}>
                  <category.icon className={`w-4 h-4 ${getScoreColor(category.score)}`} />
                </div>
                <span className="text-sm font-medium text-foreground">{category.label}</span>
              </div>
              <span className={`font-bold ${getScoreColor(category.score)}`}>
                {category.score}
              </span>
            </div>
            <div className="h-2 bg-[hsl(var(--surface))] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(category.score / category.maxScore) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.4 + index * 0.1, ease: 'easeOut' }}
                className={`h-full ${
                  category.score >= 90 ? 'bg-[hsl(var(--success))]' :
                  category.score >= 70 ? 'bg-[hsl(var(--warning))]' :
                  'bg-[hsl(var(--destructive))]'
                }`}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Default categories for HMI design review
export const defaultCategories: ScoreCategory[] = [
  { id: 'layout', icon: LayoutGrid, label: '布局', score: 88, maxScore: 100 },
    { id: 'typography', icon: Type, label: '排版', score: 92, maxScore: 100 },
    { id: 'automotive', icon: Car, label: '座舱体验', score: 85, maxScore: 100 },
    { id: 'visual', icon: Palette, label: '视觉系统', score: 90, maxScore: 100 },
    { id: 'accessibility', icon: Eye, label: '可访问性', score: 95, maxScore: 100 },
    { id: 'consistency', icon: Layers, label: '一致性', score: 87, maxScore: 100 },
];

