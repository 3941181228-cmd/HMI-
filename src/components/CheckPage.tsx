import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ArrowRight, Sparkles, LayoutGrid, Type, Palette, Boxes, Upload, CheckCircle2, X, FileJson } from 'lucide-react';
import FigmaImportPanel from './FigmaImportPanel';
import AIAnalysisAnimation from './AIAnalysisAnimation';
import DesignScore from './DesignScore';
import IssueList, { Issue } from './IssueList';
import FigmaPreview from './FigmaPreview';
import CheckLayoutPage from './CheckLayoutPage';
import CheckTypographyPage from './CheckTypographyPage';
import CheckColorPage from './CheckColorPage';
import CheckSpacingPage from './CheckSpacingPage';
import { analyzeFigmaDocument, AnalysisResult, CheckIssue, getIssuesByCategory } from '../services/figmaAnalyzer';
import { saveFigmaState, loadFigmaState, clearFigmaState } from '../services/figmaStorage';

const FIGMA_API_BASE_URL = '/api/figma';

interface CheckPageProps {
  activeSection?: string;
  onNavigate?: (target: string) => void;
}

const subPageConfig: Record<string, { icon: typeof LayoutGrid; title: string; description: string }> = {
  layout: { icon: LayoutGrid, title: '布局对齐检查', description: '请先导入 Figma 设计稿并完成检测' },
  typography: { icon: Type, title: '字体规范检查', description: '请先导入 Figma 设计稿并完成检测' },
  color: { icon: Palette, title: '色彩对比检查', description: '请先导入 Figma 设计稿并完成检测' },
  spacing: { icon: Boxes, title: '间距系统检查', description: '请先导入 Figma 设计稿并完成检测' },
}

export default function CheckPage({ activeSection = 'full', onNavigate }: CheckPageProps) {
  const savedState = loadFigmaState();
  
  const [importStep, setImportStep] = useState<'import' | 'analyzing' | 'result'>(
    (savedState.importStep as 'import' | 'analyzing' | 'result') || 'import'
  );
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>(
    (savedState.connectionStatus as 'idle' | 'connected' | 'error') || 'idle'
  );
  const [connectionError, setConnectionError] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState<string>(savedState.figmaUrl || '');
  const [currentFile, setCurrentFile] = useState<string>(savedState.figmaFileName || '');
  const [currentPage, setCurrentPage] = useState<string>('');
  const [selectedIssue, setSelectedIssue] = useState<Issue | undefined>();
  const [showPreview, setShowPreview] = useState(false);
  const [specFile, setSpecFile] = useState<{ name: string; size: string; content: string } | null>(null);
  const [specFileError, setSpecFileError] = useState<string>('');
  const [figmaDocument, setFigmaDocument] = useState<any>(savedState.figmaDocument || null);
  const [figmaFileKey, setFigmaFileKey] = useState<string>(savedState.figmaFileKey || '');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    savedState.analysisResult || null
  );
  const [frameImages, setFrameImages] = useState<string[]>(savedState.frameImages || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (savedState.connectionStatus === 'connected' && savedState.figmaFileKey) {
      setConnectionStatus('connected');
      if (savedState.importStep === 'result') {
        setImportStep('result');
      }
    }
  }, []);

  const handleSpecFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpecFileError('')
    const file = e.target.files?.[0]
    if (!file) return
    const validTypes = ['application/json', 'text/csv', 'text/plain']
    const validExts = ['.json', '.csv', '.txt']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      setSpecFileError('仅支持 JSON、CSV、TXT 格式的规范文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setSpecFileError('文件大小不能超过 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      setSpecFile({
        name: file.name,
        size: file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        content,
      })
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveSpecFile = () => {
    setSpecFile(null)
    setSpecFileError('')
  }

  const handleFigmaImport = async (url: string) => {
    setIsConnecting(true);
    setConnectionStatus('idle');
    setConnectionError('');
    setFigmaUrl(url);

    const figmaUrlRegex = /https?:\/\/(?:www\.)?figma\.com\/(file|proto|design)\/([a-zA-Z0-9-_]+)\/?.*$/;
    const match = url.match(figmaUrlRegex);
    const fileKey = match ? match[2] : '';

    if (!fileKey) {
      setConnectionStatus('error');
      setConnectionError('无法从链接中提取文件 Key，请确认链接格式正确');
      setIsConnecting(false);
      return;
    }

    try {
      const response = await fetch(`${FIGMA_API_BASE_URL}/files/${fileKey}`);

      if (response.status === 403) {
        throw new Error('Token 无效或无权访问该文件（403）');
      }
      if (response.status === 404) {
        throw new Error('文件不存在（404），请检查链接是否正确');
      }
      if (!response.ok) {
        throw new Error(`API 返回错误: ${response.status}`);
      }

      const data = await response.json();
      setFigmaDocument(data);
      setFigmaFileKey(fileKey);
      setCurrentFile(data.name || '未命名文件');
      setCurrentPage('所有页面');

      let fetchedImages: string[] = [];
      try {
        const topFrameIds: string[] = [];
        for (const page of data.document.children || []) {
          if (page.children) {
            for (const node of page.children) {
              if (node.type === 'FRAME') topFrameIds.push(node.id);
            }
          }
        }
        if (topFrameIds.length > 0) {
          const idsParam = topFrameIds.slice(0, 10).join(',');
          const imgResponse = await fetch(
            `${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${idsParam}&format=png&scale=1`
          );
          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            if (imgData.images) {
              fetchedImages = Object.values(imgData.images) as string[];
              setFrameImages(fetchedImages);
            }
          }
        }
      } catch {}

      setConnectionStatus('connected');
      setIsConnecting(false);
      saveFigmaState({
        figmaUrl,
        figmaFileKey: fileKey,
        figmaFileName: data.name || '未命名文件',
        figmaDocument: data,
        frameImages: fetchedImages,
        connectionStatus: 'connected',
        importStep: 'analyzing',
      });
      setTimeout(() => setImportStep('analyzing'), 500);
    } catch (error) {
      const errMsg = error instanceof TypeError && error.message === 'Failed to fetch'
        ? '网络请求失败，请检查 CORS 代理配置是否正确'
        : (error instanceof Error ? error.message : '未知错误');
      console.error('Figma API error:', error);
      setConnectionStatus('error');
      setConnectionError(errMsg);
      setIsConnecting(false);
      setCurrentFile('无法连接');
    }
  };

  const handleAnalysisComplete = () => {
    if (figmaDocument) {
      const result = analyzeFigmaDocument(figmaDocument);
      setAnalysisResult(result);
      saveFigmaState({
        analysisResult: result,
        importStep: 'result',
      });
    }
    setImportStep('result');
  };

  const handleDisconnect = () => {
    clearFigmaState();
    setImportStep('import');
    setConnectionStatus('idle');
    setConnectionError('');
    setFigmaUrl('');
    setCurrentFile('');
    setCurrentPage('');
    setFigmaDocument(null);
    setFigmaFileKey('');
    setAnalysisResult(null);
    setFrameImages([]);
    setSpecFile(null);
    setSpecFileError('');
  };

  const handleSelectIssue = (issue: Issue) => {
    setSelectedIssue(issue);
    setShowPreview(true);
  };

  const calculateOverallScore = () => {
    if (analysisResult) return analysisResult.overallScore;
    return 0;
  };

  const getLevel = (score: number): string => {
    if (analysisResult) return analysisResult.level;
    if (score >= 90) return '优秀';
    if (score >= 80) return '专业级';
    if (score >= 70) return '良好';
    return '需改进';
  };

  const renderCheckPage = () => {
    if (['layout', 'typography', 'color', 'spacing'].includes(activeSection) && importStep !== 'result') {
      const config = subPageConfig[activeSection]
      if (config) {
        const Icon = config.icon
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex items-center justify-center"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
                <Icon className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">{config.title}</h3>
              <p className="text-sm text-muted-foreground mb-6">{config.description}</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate?.('check:full')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-shadow"
              >
                <Sparkles className="w-4 h-4" />
                前往导入检测
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        )
      }
    }

    switch (activeSection) {
      case 'layout':
        return <CheckLayoutPage checkIssues={analysisResult ? getIssuesByCategory(analysisResult.issues, 'layout') : []} />;
      case 'typography':
        return <CheckTypographyPage checkIssues={analysisResult ? getIssuesByCategory(analysisResult.issues, 'typography') : []} />;
      case 'color':
        return <CheckColorPage checkIssues={analysisResult ? getIssuesByCategory(analysisResult.issues, 'color') : []} />;
      case 'spacing':
        return <CheckSpacingPage checkIssues={analysisResult ? getIssuesByCategory(analysisResult.issues, 'spacing') : []} />;
      case 'full':
      default:
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">AI 设计自检</h2>
                  <p className="text-sm text-muted-foreground">检测设计稿规范问题，输出优化建议</p>
                </div>
              </div>

              {importStep === 'result' && (
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setImportStep('import')}
                    className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--surface-secondary))] hover:bg-[hsl(var(--surface))] rounded-xl text-sm font-medium transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    重新检测
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDisconnect}
                    className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--destructive)/0.1)] hover:bg-[hsl(var(--destructive)/0.2)] rounded-xl text-sm font-medium text-[hsl(var(--destructive))] transition-colors"
                  >
                    <X className="w-4 h-4" />
                    断开连接
                  </motion.button>
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-6">
              {/* Left Panel - Import / Results */}
              <div className="w-80 flex-shrink-0 space-y-6">
                <AnimatePresence mode="wait">
                  {importStep === 'import' && (
                    <motion.div
                      key="import"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <FigmaImportPanel
                        onImport={handleFigmaImport}
                        isConnecting={isConnecting}
                        connectionStatus={connectionStatus}
                        currentFile={currentFile}
                        currentPage={currentPage}
                        errorMessage={connectionError}
                      />

                      {/* Spec File Import */}
                      <div className="mt-6 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <FileJson className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">导入规范文件</h3>
                            <p className="text-xs text-muted-foreground">自定义检测标准（可选）</p>
                          </div>
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json,.csv,.txt"
                          onChange={handleSpecFileUpload}
                          className="hidden"
                        />

                        {specFile ? (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--success)/0.08)] border border-[hsl(var(--success)/0.2)]"
                          >
                            <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))] flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{specFile.name}</p>
                              <p className="text-[10px] text-muted-foreground">{specFile.size}</p>
                            </div>
                            <button
                              onClick={handleRemoveSpecFile}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/20 transition-colors"
                            >
                              <X className="w-3 h-3 text-muted-foreground hover:text-red-400" />
                            </button>
                          </motion.div>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-[hsl(var(--border)/0.4)] hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"
                          >
                            <Upload className="w-4 h-4" />
                            点击上传规范文件
                          </motion.button>
                        )}

                        {specFileError && (
                          <p className="text-xs text-[hsl(var(--destructive))]">{specFileError}</p>
                        )}

                        <p className="text-[10px] text-muted-foreground/60">
                          支持 JSON / CSV / TXT 格式，最大 5MB
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {importStep === 'result' && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <DesignScore
                        categories={analysisResult ? analysisResult.categories.map(c => ({
                          id: c.id,
                          icon: c.id === 'layout' ? LayoutGrid : c.id === 'typography' ? Type : c.id === 'color' ? Palette : Boxes,
                          label: c.label,
                          score: c.score,
                          maxScore: c.maxScore,
                        })) : []}
                        overallScore={calculateOverallScore()}
                        level={getLevel(calculateOverallScore())}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Middle Panel - Issue List */}
              {importStep === 'result' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-96 flex-shrink-0 bg-[hsl(var(--surface))] rounded-xl border border-[hsl(var(--border)/0.4)] p-4"
                >
                  <IssueList
                    issues={analysisResult?.issues as Issue[] || []}
                    onSelectIssue={handleSelectIssue}
                    selectedIssueId={selectedIssue?.id}
                  />
                </motion.div>
              )}

              {/* Right Panel - Figma Preview */}
              {importStep === 'result' && showPreview && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 bg-[hsl(var(--surface))] rounded-xl border border-[hsl(var(--border)/0.4)]"
                >
                  <FigmaPreview
                    selectedIssue={selectedIssue}
                    onIssueHighlight={handleSelectIssue}
                    images={frameImages}
                  />
                </motion.div>
              )}

              {importStep === 'result' && !showPreview && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 bg-[hsl(var(--surface))] rounded-xl border border-[hsl(var(--border)/0.4)] flex items-center justify-center"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">选择一个问题</h3>
                    <p className="text-sm text-muted-foreground">点击左侧问题列表中的项目，查看详细定位和优化建议</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Analysis Animation Overlay */}
            <AnimatePresence>
              {importStep === 'analyzing' && (
                <AIAnalysisAnimation onComplete={handleAnalysisComplete} />
              )}
            </AnimatePresence>
          </motion.div>
        );
    }
  };

  return renderCheckPage();
}

