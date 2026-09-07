import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, Link2, CheckCircle2, RefreshCw, AlertCircle, Upload, Download, Trash2, FileJson, ChevronDown, Plus, X } from 'lucide-react';
import {
  CheckRules,
  DEFAULT_RULES,
  getSavedRules,
  getActiveRuleName,
  setActiveRule,
  saveRule,
  deleteRule,
  importRulesFromJSON,
  exportRulesToJSON,
  generateRuleTemplate,
} from '@/services/checkRules';

interface FigmaImportPanelProps {
  onImport: (url: string, rules?: CheckRules) => void;
  isConnecting: boolean;
  connectionStatus: 'idle' | 'connected' | 'error';
  currentFile?: string;
  currentPage?: string;
  errorMessage?: string;
}

export default function FigmaImportPanel({ onImport, isConnecting, connectionStatus, currentFile, currentPage, errorMessage }: FigmaImportPanelProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [showRulesDropdown, setShowRulesDropdown] = useState(false);
  const [ruleError, setRuleError] = useState('');
  const [savedRules, setSavedRules] = useState<CheckRules[]>(getSavedRules());
  const [activeRuleName, setActiveRuleNameState] = useState<string>(getActiveRuleName());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentRules = activeRuleName
    ? savedRules.find(r => r.name === activeRuleName) || DEFAULT_RULES
    : DEFAULT_RULES;

  const validateFigmaUrl = (inputUrl: string): boolean => {
    const figmaRegex = /^https?:\/\/(?:www\.)?figma\.com\/(file|proto|design)\/[a-zA-Z0-9-_]+\/?.*$/;
    return figmaRegex.test(inputUrl);
  };

  const handleConnect = () => {
    if (!url.trim()) {
      setError('请输入 Figma 链接');
      return;
    }
    if (!validateFigmaUrl(url)) {
      setError('请输入有效的 Figma 文件链接');
      return;
    }
    setError('');
    onImport(url, currentRules);
  };

  const handleRuleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonStr = event.target?.result as string;
        const imported = importRulesFromJSON(jsonStr);
        saveRule(imported);
        setActiveRule(imported.name);
        setActiveRuleNameState(imported.name);
        setSavedRules(getSavedRules());
        setRuleError('');
        setShowRulesDropdown(false);
      } catch (err) {
        setRuleError(err instanceof Error ? err.message : '规则文件解析失败');
      }
    };
    reader.onerror = () => {
      setRuleError('文件读取失败');
    };
    reader.readAsText(file);
    // 清空input以便同一文件可以重复选择
    e.target.value = '';
  };

  const handleSelectRule = (name: string) => {
    setActiveRule(name);
    setActiveRuleNameState(name);
    setShowRulesDropdown(false);
    setRuleError('');
  };

  const handleDeleteRule = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteRule(name);
    setSavedRules(getSavedRules());
    if (activeRuleName === name) {
      setActiveRuleNameState('');
    }
  };

  const handleExportRules = () => {
    const jsonStr = exportRulesToJSON(currentRules);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentRules.name || 'check-rules'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const jsonStr = generateRuleTemplate();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'check-rules-template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Figma Import Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Figma 导入</h3>
          <p className="text-sm text-muted-foreground">接入 Figma 设计稿进行 AI 检测</p>
        </div>
      </div>

      {/* Connection Status */}
      {connectionStatus === 'connected' && currentFile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[hsl(var(--success)/0.1)] border border-[hsl(var(--success)/0.2)] rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" />
            <div>
              <p className="text-sm font-medium text-foreground">已连接 Figma</p>
              <p className="text-xs text-muted-foreground">当前文件: {currentFile}</p>
              {currentPage && <p className="text-xs text-muted-foreground">当前页面: {currentPage}</p>}
            </div>
          </div>
        </motion.div>
      )}

      {connectionStatus === 'error' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.2)] rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[hsl(var(--destructive))]" />
            <div>
              <p className="text-sm font-medium text-[hsl(var(--destructive))]">连接失败</p>
              <p className="text-xs text-muted-foreground">{errorMessage || '请检查 Figma 链接是否正确，确保使用有效的 Figma 文件链接'}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* URL Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Figma 文件链接
        </label>
        <div className="relative">
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            placeholder="https://www.figma.com/file/..."
            className="w-full bg-[hsl(var(--surface-secondary)/0.4)] border border-[hsl(var(--border)/0.4)] rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] focus:border-primary transition-all"
          />
          {isConnecting && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <RefreshCw className="w-4 h-4 text-primary" />
            </motion.div>
          )}
        </div>
        {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
      </div>

      {/* Check Rules Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <FileJson className="w-4 h-4" />
          检测规则
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRulesDropdown(!showRulesDropdown)}
            className="w-full flex items-center justify-between bg-[hsl(var(--surface-secondary)/0.4)] border border-[hsl(var(--border)/0.4)] rounded-xl px-4 py-3 text-sm transition-all hover:border-primary/40"
          >
            <span className={activeRuleName ? 'text-foreground' : 'text-muted-foreground'}>
              {currentRules.name}
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showRulesDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showRulesDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-1 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-20 overflow-hidden"
            >
              {/* 默认规则 */}
              <button
                type="button"
                onClick={() => handleSelectRule('')}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-[hsl(var(--surface-secondary))] transition-colors ${!activeRuleName ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${!activeRuleName ? 'text-primary' : 'text-muted-foreground'}`} />
                  {DEFAULT_RULES.name}（默认）
                </span>
              </button>

              {/* 自定义规则列表 */}
              {savedRules.map(rule => (
                <div
                  key={rule.name}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm hover:bg-[hsl(var(--surface-secondary))] transition-colors ${activeRuleName === rule.name ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectRule(rule.name)}
                    className="flex-1 flex items-center gap-2 text-left"
                  >
                    <FileJson className={`w-4 h-4 ${activeRuleName === rule.name ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="truncate">{rule.name}</span>
                    {rule.description && <span className="text-xs text-muted-foreground truncate">— {rule.description}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteRule(rule.name, e)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors ml-2"
                    title="删除规则"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* 分隔线 */}
              <div className="border-t border-[hsl(var(--border))]" />

              {/* 导入规则按钮 */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors"
              >
                <Upload className="w-4 h-4" />
                导入规则文件 (JSON)
              </button>

              {/* 下载模板 */}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-[hsl(var(--surface-secondary))] transition-colors"
              >
                <Plus className="w-4 h-4" />
                下载规则模板
              </button>

              {/* 导出当前规则 */}
              <button
                type="button"
                onClick={handleExportRules}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-[hsl(var(--surface-secondary))] transition-colors"
              >
                <Download className="w-4 h-4" />
                导出当前规则
              </button>
            </motion.div>
          )}
        </div>

        {ruleError && (
          <p className="text-xs text-[hsl(var(--destructive))] flex items-center gap-1">
            <X className="w-3 h-3" />{ruleError}
          </p>
        )}

        {/* 规则描述 */}
        {currentRules.description && (
          <p className="text-xs text-muted-foreground">{currentRules.description}</p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleRuleFileUpload}
        className="hidden"
      />

      {/* Connect Button */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={handleConnect}
        disabled={isConnecting}
        className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
      >
        {isConnecting ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            连接中...
          </>
        ) : (
          <>连接 Figma</>
        )}
      </motion.button>

      {/* Tips */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>支持格式:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Figma 文件链接</li>
          <li>Figma 原型链接</li>
          <li>自定义检测规则 (JSON)</li>
        </ul>
      </div>
    </motion.div>
  );
}
