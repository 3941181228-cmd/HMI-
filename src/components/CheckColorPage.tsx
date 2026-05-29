import { motion } from 'framer-motion';
import { Palette, CheckCircle2, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import CheckBaseLayout, { checkCategories } from './CheckBaseLayout';
import { CheckIssue } from '../services/figmaAnalyzer';

interface ColorIssue {
  id: string;
  type: 'pass' | 'warn' | 'fail';
  title: string;
  description: string;
  suggestion: string;
  contrastRatio?: string;
  colorPair?: { bg: string; text: string };
}

const mockColorIssues: ColorIssue[] = [
    { id: 'color-1', type: 'pass', title: '主色调一致', description: '主题色 #2563EB 正确应用于所有关键元素', suggestion: '保持现状' },
    { id: 'color-2', type: 'pass', title: '功能色规范', description: '成功色 #10B981、警告色 #F59E0B、错误色 #EF4444 使用正确', suggestion: '保持现状' },
    { id: 'color-3', type: 'warn', title: '次要文字对比度偏低', description: '灰色文字 #6B7280 与背景对比度为 3.2:1，低于 WCAG AA 标准', suggestion: '将灰色改为 #4B5563 或加深背景色', contrastRatio: '3.2:1', colorPair: { bg: '#F3F4F6', text: '#6B7280' } },
    { id: 'color-4', type: 'fail', title: '深色模式适配问题', description: '部分颜色在深色模式下对比度不足', suggestion: '为深色模式创建独立的色板配置', contrastRatio: '2.1:1', colorPair: { bg: '#1F2937', text: '#9CA3AF' } },
  ];

interface CheckColorPageProps {
  checkIssues?: CheckIssue[];
}

export default function CheckColorPage({ checkIssues = [] }: CheckColorPageProps) {
  const issues: ColorIssue[] = checkIssues.length > 0
    ? checkIssues.map(i => ({
        id: i.id,
        type: (i.type === 'error' ? 'fail' : i.type === 'warning' ? 'warn' : 'pass') as ColorIssue['type'],
        title: i.title,
        description: i.description,
        suggestion: i.suggestion,
      }))
    : mockColorIssues;

  const colorIssues = issues;
  const stats = {
    total: colorIssues.length,
    pass: colorIssues.filter(i => i.type === 'pass').length,
    warn: colorIssues.filter(i => i.type === 'warn').length,
    fail: colorIssues.filter(i => i.type === 'fail').length,
  };

  const relatedChecks = [
    { label: '字体规范', route: 'check:typography' },
    { label: '无障碍检测', route: 'check:accessibility' },
  ];

  return (
    <CheckBaseLayout
      category={checkCategories['color']}
      stats={stats}
      relatedChecks={relatedChecks}
    >
      <div className="space-y-4">
        {/* Color Palette */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--border)/0.4)]"
        >
          <h3 className="font-medium text-foreground mb-4">HMI 色彩系统</h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { name: 'Primary', color: '#2563EB' },
              { name: 'Success', color: '#10B981' },
              { name: 'Warning', color: '#F59E0B' },
              { name: 'Error', color: '#EF4444' },
            ].map((item) => (
              <div key={item.name} className="text-center">
                <div
                  className="w-full h-12 rounded-lg mb-2"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-muted-foreground">{item.name}</span>
                <br />
                <span className="text-xs font-mono text-muted-foreground">{item.color}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Contrast Check */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--border)/0.4)]"
        >
          <h3 className="font-medium text-foreground mb-4">对比度参考</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground mb-2">普通文本（≥ 4.5:1）</div>
              {[
                { ratio: '7.2:1', bg: '#FFFFFF', text: '#1F2937', pass: true },
                { ratio: '5.1:1', bg: '#F3F4F6', text: '#374151', pass: true },
                { ratio: '3.2:1', bg: '#F3F4F6', text: '#6B7280', pass: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-16 h-8 rounded flex items-center justify-center text-xs font-medium"
                    style={{ backgroundColor: item.bg, color: item.text }}
                  >
                    文本
                  </div>
                  <span className={`text-xs font-mono ${item.pass ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.ratio}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground mb-2">大文本（≥ 3:1）</div>
              {[
                { ratio: '11.5:1', bg: '#FFFFFF', text: '#1F2937', pass: true },
                { ratio: '8.3:1', bg: '#1F2937', text: '#FFFFFF', pass: true },
                { ratio: '2.1:1', bg: '#1F2937', text: '#9CA3AF', pass: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-16 h-8 rounded flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: item.bg, color: item.text }}
                  >
                    A
                  </div>
                  <span className={`text-xs font-mono ${item.pass ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.ratio}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Issues List */}
        {colorIssues.map((issue, index) => (
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
                {issue.contrastRatio && (
                  <div className="mt-2 px-2 py-1 rounded bg-[hsl(var(--surface))] text-xs font-mono text-muted-foreground inline-block mr-2">
                    对比度: {issue.contrastRatio}
                  </div>
                )}
                {issue.colorPair && (
                  <div className="mt-2 px-2 py-1 rounded bg-[hsl(var(--surface))] text-xs font-mono text-muted-foreground inline-block">
                    {issue.colorPair.text} on {issue.colorPair.bg}
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

