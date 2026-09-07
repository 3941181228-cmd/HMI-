import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ArrowRight, Sparkles, LayoutGrid, Type, Palette, Boxes, Upload, CheckCircle2, X, RefreshCw } from 'lucide-react';
import FigmaImportPanel from './FigmaImportPanel';
import AIAnalysisAnimation from './AIAnalysisAnimation';
import AnalysisReport from './AnalysisReport';
import IssueList, { Issue } from './IssueList';
import FigmaPreview from './FigmaPreview';
import CheckLayoutPage from './CheckLayoutPage';
import CheckTypographyPage from './CheckTypographyPage';
import CheckColorPage from './CheckColorPage';
import CheckSpacingPage from './CheckSpacingPage';
import { analyzeFigmaDocument, AnalysisResult, CheckIssue, getIssuesByCategory } from '../services/figmaAnalyzer';
import { saveFigmaState, loadFigmaState, clearFigmaState } from '../services/figmaStorage';
import { getStoredFigmaToken } from '../services/apiStorage';
import { getProxiedFigmaImageUrl } from '../services/figmaImageProxy';
import { CheckRules, DEFAULT_RULES, getActiveRules } from '../services/checkRules';

const FIGMA_API_BASE_URL = '/api/figma';

/**
 * 带超时的 fetch 封装
 * 防止网络不通时 fetch 无限等待，导致导入流程卡死
 * @param url 请求地址
 * @param options fetch 配置
 * @param timeoutMs 超时毫秒数（默认 30 秒）
 */
async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface CheckPageProps {
  activeSection?: string;
  onNavigate?: (target: string) => void;
}

const subPageConfig: Record<string, { icon: typeof LayoutGrid; title: string; description: string }> = {
  layout: { icon: LayoutGrid, title: '布局对齐检查', description: '请先导入 Figma 设计稿并完成检测' },
  typography: { icon: Type, title: '字体规范检查', description: '请先导入 Figma 设计稿并完成检测' },
  color: { icon: Palette, title: '色彩对比检查', description: '请先导入 Figma 设计稿并完成检测' },
  spacing: { icon: Boxes, title: '间距系统检查', description: '请先导入 Figma 设计稿并完成检测' },
  effects: { icon: Sparkles, title: '视觉效果检查', description: '请先导入 Figma 设计稿并完成检测' },
}

export default function CheckPage({ activeSection = 'full', onNavigate }: CheckPageProps) {
  const savedState = loadFigmaState();
  
  // importStep 始终从 'import' 开始，不依赖 localStorage 中保存的旧状态
  // 因为 figmaDocument 和 analysisResult 数据量大，不再持久化到 localStorage
  const [importStep, setImportStep] = useState<'import' | 'analyzing' | 'result'>('import');
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
  // figmaDocument 和 analysisResult 不从 localStorage 恢复（数据量大）
  const [figmaDocument, setFigmaDocument] = useState<any>(null);
  const [figmaFileKey, setFigmaFileKey] = useState<string>(savedState.figmaFileKey || '');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [frameImages, setFrameImages] = useState<Array<{ id: string; name: string; url: string }>>(savedState.frameImages || []);
  const [exportAssets, setExportAssets] = useState<Array<{ id: string; name: string; url: string; format: string }>>([]);
  const [selectedRules, setSelectedRules] = useState<CheckRules>(getActiveRules());

  // 递归查找所有带有PNG导出设置的节点（切图）
  const findExportableNodes = (node: any): Array<{ id: string; name: string; format: string }> => {
    const results: Array<{ id: string; name: string; format: string }> = [];
    
    // 检查当前节点是否有PNG导出设置
    if (node.exportSettings && Array.isArray(node.exportSettings)) {
      const pngSetting = node.exportSettings.find((s: any) => s.format === 'PNG');
      if (pngSetting) {
        results.push({
          id: node.id,
          name: node.name || '未命名切图',
          format: 'PNG'
        });
      }
    }
    
    // 递归遍历子节点
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        results.push(...findExportableNodes(child));
      }
    }
    
    return results;
  };

  // 当 activeSection 变为 'full'（导入检测）时，确保显示导入界面
  useEffect(() => {
    if (activeSection === 'full' && !figmaDocument) {
      setImportStep('import');
    }
  }, [activeSection, figmaDocument]);

  const handleFigmaImport = async (url: string, rules?: CheckRules) => {
    setIsConnecting(true);
    setConnectionStatus('idle');
    setConnectionError('');
    setFigmaUrl(url);
    // 保存用户选择的检测规则
    if (rules) {
      setSelectedRules(rules);
    }

    // 检查是否配置了Figma Token
    const figmaToken = getStoredFigmaToken();
    if (!figmaToken) {
      setConnectionStatus('error');
      setConnectionError('请先在「系统设置 → API 配置」中配置 Figma Personal Access Token');
      setIsConnecting(false);
      return;
    }

    const figmaUrlRegex = /https?:\/\/(?:www\.)?figma\.com\/(file|proto|design)\/([a-zA-Z0-9-_]+)\/?.*$/;
    const match = url.match(figmaUrlRegex);
    const fileKey = match ? match[2] : '';

    if (!fileKey) {
      setConnectionStatus('error');
      setConnectionError('无法从链接中提取文件 Key，请确认链接格式正确（应为 https://www.figma.com/file/xxx/...）');
      setIsConnecting(false);
      return;
    }

    try {
      // 请求头带上用户的Figma Token
      const headers: Record<string, string> = {
        'X-Figma-Token': figmaToken,
        'Content-Type': 'application/json',
      };

      // 调用真实Figma API获取文件数据（带 60 秒超时，防止大文件卡死）
      const response = await fetchWithTimeout(
        `${FIGMA_API_BASE_URL}/files/${fileKey}`,
        { headers },
        60000,
      );

      // 根据HTTP状态码给出明确错误提示
      if (response.status === 401) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Figma Token 无效或已过期（401 Unauthorized）。${errData.err || ''}请前往设置重新生成并配置 Token。`);
      }
      if (response.status === 403) {
        throw new Error('无权访问该文件（403 Forbidden）。请确认文件链接正确，且您的 Figma 账号有该文件的访问权限，或文件已设置为「任何人可查看」。');
      }
      if (response.status === 404) {
        throw new Error('文件不存在（404 Not Found）。请检查链接是否正确，文件可能已被删除。');
      }
      if (response.status === 429) {
        throw new Error('Figma API 请求频率超限（429 Too Many Requests），请稍后重试。');
      }
      if (!response.ok) {
        let errMsg = `Figma API 返回错误: HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.message || errData.err) {
            errMsg += ` - ${errData.message || errData.err}`;
          }
        } catch {}
        throw new Error(errMsg);
      }

      const data = await response.json();

      // Figma API成功返回后，data包含{name, document, ...}
      // document是DOCUMENT节点，其children是PAGES
      if (!data.document) {
        throw new Error('Figma API 返回数据格式异常，未找到 document 节点');
      }

      setFigmaDocument(data);
      setFigmaFileKey(fileKey);
      setCurrentFile(data.name || '未命名文件');
      setCurrentPage(data.document.children?.length === 1
        ? (data.document.children[0]?.name || '所有页面')
        : `${data.document.children?.length || 0} 个页面`
      );

      // 获取画板缩略图（带 30 秒超时，失败不阻塞主流程）
      let fetchedImages: Array<{ id: string; name: string; url: string }> = [];
      try {
        // 收集顶层画板的 ID 和名称
        const topFrames: Array<{ id: string; name: string }> = [];
        for (const page of data.document.children || []) {
          if (page.children) {
            for (const node of page.children) {
              if (node.type === 'FRAME' || node.type === 'COMPONENT') {
                topFrames.push({ id: node.id, name: node.name || '未命名画板' });
              }
            }
          }
        }
        if (topFrames.length > 0) {
          const idsParam = topFrames.slice(0, 20).map(f => f.id).join(',');
          const imgResponse = await fetchWithTimeout(
            `${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${encodeURIComponent(idsParam)}&format=png&scale=1`,
            { headers },
            30000,
          );
          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            if (imgData.images) {
              // 将画板 ID/名称与缩略图 URL 关联，使用代理URL避免S3访问被阻止
              fetchedImages = topFrames
                .filter(f => imgData.images[f.id] && imgData.images[f.id] !== 'null')
                .map(f => ({ id: f.id, name: f.name, url: imgData.images[f.id] }));
              setFrameImages(fetchedImages);
            }
          }
        }
      } catch (imgErr) {
        console.warn('获取Figma画板缩略图失败:', imgErr);
        // 图片获取失败不影响主流程
      }

      // 切图资源获取改为非阻塞：后台异步获取，不等待完成即进入分析步骤
      // 避免大量切图节点导致串行请求卡死整个导入流程
      const exportableNodes = findExportableNodes(data.document);
      if (exportableNodes.length > 0) {
        // 后台异步获取切图 URL，不阻塞主流程
        (async () => {
          try {
            const batchSize = 50;
            const allAssets: Array<{ id: string; name: string; url: string; format: string }> = [];
            // 并行请求所有批次（而非串行），每批带 30 秒超时
            const batches: Array<typeof exportableNodes> = [];
            for (let i = 0; i < exportableNodes.length; i += batchSize) {
              batches.push(exportableNodes.slice(i, i + batchSize));
            }
            const batchResults = await Promise.allSettled(
              batches.map(async (batch) => {
                const idsParam = batch.map(n => n.id).join(',');
                const exportImgResponse = await fetchWithTimeout(
                  `${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${encodeURIComponent(idsParam)}&format=png&scale=2`,
                  { headers },
                  30000,
                );
                if (!exportImgResponse.ok) return [];
                const exportImgData = await exportImgResponse.json();
                if (!exportImgData.images) return [];
                return batch
                  .filter(n => exportImgData.images[n.id] && exportImgData.images[n.id] !== 'null')
                  .map(n => ({ id: n.id, name: n.name, url: exportImgData.images[n.id], format: n.format }));
              }),
            );
            for (const result of batchResults) {
              if (result.status === 'fulfilled') {
                allAssets.push(...result.value);
              }
            }
            if (allAssets.length > 0) {
              setExportAssets(allAssets);
            }
          } catch (exportErr) {
            console.warn('后台获取Figma切图资源失败:', exportErr);
          }
        })();
      }

      // 立即设置连接成功状态，不等切图资源
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
      // 处理超时错误
      const isTimeout = error instanceof DOMException && error.name === 'AbortError';
      const errMsg = isTimeout
        ? '请求超时，Figma API 响应时间过长。请检查网络连接后重试，或尝试使用较小的 Figma 文件。'
        : error instanceof TypeError && error.message === 'Failed to fetch'
        ? '网络请求失败，请检查网络连接或开发服务器是否正常运行'
        : (error instanceof Error ? error.message : '未知错误');
      console.error('Figma API error:', error);
      setConnectionStatus('error');
      setConnectionError(errMsg);
      setIsConnecting(false);
      setCurrentFile('连接失败');
    }
  };

  const handleAnalysisComplete = () => {
    if (figmaDocument) {
      const result = analyzeFigmaDocument(figmaDocument, figmaFileKey, selectedRules);
      setAnalysisResult(result);
      saveFigmaState({
        analysisResult: result,
        importStep: 'result',
      });
    }
    setImportStep('result');
  };

  // 使用已有的Figma数据重新运行分析（不需要重新导入）
  const handleReanalyze = () => {
    if (figmaDocument) {
      const result = analyzeFigmaDocument(figmaDocument, figmaFileKey, selectedRules);
      setAnalysisResult(result);
      saveFigmaState({
        analysisResult: result,
      });
    }
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
    setExportAssets([]);
  };

  const handleSelectIssue = (issue: Issue) => {
    setSelectedIssue(issue);
    setShowPreview(true);
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
                    onClick={handleReanalyze}
                    className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--surface-secondary))] hover:bg-[hsl(var(--surface))] rounded-xl text-sm font-medium transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    重新分析
                  </motion.button>
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
                    </motion.div>
                  )}

                  {importStep === 'result' && analysisResult && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <AnalysisReport
                        categories={analysisResult.categories}
                        highlights={analysisResult.highlights}
                        suggestions={analysisResult.suggestions}
                        documentInfo={analysisResult.documentInfo}
                        frameCount={analysisResult.frameCount}
                        textCount={analysisResult.textCount}
                        totalNodes={analysisResult.totalNodes}
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
                    exportAssets={exportAssets}
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

