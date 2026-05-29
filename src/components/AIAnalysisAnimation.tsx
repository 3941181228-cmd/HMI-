import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, FileSearch, LayoutGrid, Type, Palette, CheckCircle2, Zap } from 'lucide-react';

interface AnalysisStep {
  id: string;
  icon: typeof FileSearch;
  label: string;
  description: string;
}

const analysisSteps: AnalysisStep[] = [
  { id: 'frame', icon: FileSearch, label: '解析框架', description: '正在解析设计稿结构...' },
  { id: 'layout', icon: LayoutGrid, label: '检测自动布局', description: '分析布局系统...' },
  { id: 'typography', icon: Type, label: '分析字体规范', description: '检测字体层级...' },
  { id: 'hmi', icon: Zap, label: '检测 HMI 规范', description: '验证汽车交互规范...' },
  { id: 'token', icon: Palette, label: '分析设计令牌', description: '检查设计系统一致性...' },
];

interface AIAnalysisAnimationProps {
  onComplete: () => void;
}

export default function AIAnalysisAnimation({ onComplete }: AIAnalysisAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    if (currentStep < analysisSteps.length) {
      const timer = setTimeout(() => {
        setCompletedSteps(prev => new Set([...prev, analysisSteps[currentStep].id]));
        setCurrentStep(prev => prev + 1);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setIsScanning(false);
      const completeTimer = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(completeTimer);
    }
  }, [currentStep, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/95 backdrop-blur-xl flex items-center justify-center z-50"
    >
      <div className="max-w-lg w-full mx-4">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-12"
        >
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              boxShadow: ['0 0 20px rgba(99, 102, 241, 0.3)', '0 0 40px rgba(99, 102, 241, 0.5)', '0 0 20px rgba(99, 102, 241, 0.3)']
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center"
          >
            <Brain className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground mb-2">AI 正在分析设计系统...</h2>
          <p className="text-muted-foreground">请稍候，我们正在检测您的设计稿</p>
        </motion.div>

        {/* Progress Ring */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="relative w-32 h-32 mx-auto mb-12"
        >
          <svg className="w-full h-full transform -rotate-90">
            <motion.circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="8"
            />
            <motion.circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="8"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: (currentStep + completedSteps.size) / (analysisSteps.length * 2) }}
              transition={{ duration: 0.5 }}
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--purple))" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-foreground">
              {completedSteps.size}/{analysisSteps.length}
            </span>
          </div>
        </motion.div>

        {/* Steps List */}
        <div className="space-y-3">
          <AnimatePresence>
            {analysisSteps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                  completedSteps.has(step.id)
                    ? 'bg-[hsl(var(--success)/0.1)] border border-[hsl(var(--success)/0.2)]'
                    : currentStep === index && isScanning
                    ? 'bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)]'
                    : 'bg-[hsl(var(--surface-secondary)/0.4)] border border-transparent'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  completedSteps.has(step.id)
                    ? 'bg-[hsl(var(--success))]'
                    : currentStep === index && isScanning
                    ? 'bg-primary animate-pulse'
                    : 'bg-[hsl(var(--surface))]'
                }`}>
                  {completedSteps.has(step.id) ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <step.icon className="w-5 h-5 text-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    completedSteps.has(step.id) ? 'text-[hsl(var(--success))]' : 'text-foreground'
                  }`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {currentStep === index && isScanning && (
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-primary"
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Scanning Effect */}
        {isScanning && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: [0, 0.5, 0], y: '100%' }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
          />
        )}
      </div>
    </motion.div>
  );
}

