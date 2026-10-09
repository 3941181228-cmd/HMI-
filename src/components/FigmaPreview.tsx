import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, Move, Crosshair, Download, Image as ImageIcon, Layers } from 'lucide-react';
import JSZip from 'jszip';
import { Issue } from './IssueList';
import { fetchFigmaImageAsBlob } from '../services/figmaImageProxy';
import { FigmaImage } from './FigmaImage';

import type { FrameImage } from '../services/figmaStorage';
import type { DesignDataSnapshot } from '../services/figmaAnalyzer';
import { auditImageUrl, getIssueOverlay } from '../services/auditEvidence';

interface ExportAsset {
  id: string;
  name: string;
  url: string;
  format: string;
}

interface FigmaPreviewProps {
  selectedIssue?: Issue;
  onIssueHighlight?: (issue: Issue) => void;
  images?: FrameImage[];
  snapshot?: DesignDataSnapshot;
  exportAssets?: ExportAsset[];
}

type ViewMode = 'frames' | 'assets';

export default function FigmaPreview({ selectedIssue, onIssueHighlight, images = [], exportAssets = [], snapshot }: FigmaPreviewProps) {
  const frameRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>('frames');

  // 当有切图资源时，默认显示切图
  useEffect(() => {
    if (exportAssets.length > 0) {
      // 如果有切图但没有画板，自动切换到切图视图
      if (images.length === 0) {
        setViewMode('assets');
      }
    }
  }, [exportAssets.length, images.length]);

  useEffect(() => {
    if (!selectedIssue) return;
    setViewMode('frames');
    setPosition({ x: 0, y: 0 });
    setZoom(1);
    const frame = images.find(f => getIssueOverlay(selectedIssue, f, snapshot));
    if (frame) requestAnimationFrame(() => frameRefs.current[frame.id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }, [selectedIssue, images, snapshot]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const handleDownloadAll = async () => {
    if (isBatchDownloading || exportAssets.length === 0) return;
    setIsBatchDownloading(true);
    setBatchProgress({ current: 0, total: exportAssets.length });

    const zip = new JSZip();
    const usedNames = new Set<string>();
    const failed: string[] = [];
    const CONCURRENCY = 5;  // 浏览器同域名并发上限 6，留 1 个余量

    // 并发分批下载
    for (let i = 0; i < exportAssets.length; i += CONCURRENCY) {
      const batch = exportAssets.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (asset) => {
        try {
          const blob = await fetchFigmaImageAsBlob(asset.url);
          if (!blob || blob.size === 0) {
            failed.push(asset.name);
            return;
          }
          // 文件名安全化 + 冲突检测
          let filename = `${asset.name.replace(/[\\/:*?"<>|]/g, '_')}.${asset.format.toLowerCase()}`;
          if (usedNames.has(filename)) {
            const dot = filename.lastIndexOf('.');
            const base = dot > 0 ? filename.slice(0, dot) : filename;
            const ext = dot > 0 ? filename.slice(dot) : '';
            let suffix = 2;
            while (usedNames.has(`${base} (${suffix})${ext}`)) suffix++;
            filename = `${base} (${suffix})${ext}`;
          }
          usedNames.add(filename);
          zip.file(filename, blob);
        } catch (err) {
          console.error(`下载切图 "${asset.name}" 失败:`, err);
          failed.push(asset.name);
        }
        setBatchProgress(prev => ({ ...prev, current: Math.min(prev.current + 1, prev.total) }));
      }));
    }

    // 生成 ZIP 并触发下载
    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `切图打包_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      if (failed.length > 0) {
        console.warn(`部分切图下载失败（${failed.length}/${exportAssets.length}）:`, failed);
      }
    } catch (err) {
      console.error('打包 ZIP 失败:', err);
    } finally {
      setIsBatchDownloading(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative w-full h-full bg-[hsl(var(--surface-secondary))] rounded-xl overflow-hidden flex flex-col"
    >
      {/* 顶部工具栏 */}
      <div className="absolute top-4 left-4 flex gap-2 z-10">
        <button
          aria-label="放大" onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
          className="p-2 bg-[hsl(var(--surface))]/90 hover:bg-[hsl(var(--surface))] rounded-lg text-foreground transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          aria-label="缩小" onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
          className="p-2 bg-[hsl(var(--surface))]/90 hover:bg-[hsl(var(--surface))] rounded-lg text-foreground transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          aria-label="重置视图" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}
          className="p-2 bg-[hsl(var(--surface))]/90 hover:bg-[hsl(var(--surface))] rounded-lg text-foreground transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <span className="px-3 py-2 bg-[hsl(var(--surface))]/90 rounded-lg text-sm font-medium text-foreground">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* 视图切换Tab和操作按钮 */}
      {(images.length > 0 || exportAssets.length > 0) && (
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {/* Tab切换 */}
          <div className="flex bg-[hsl(var(--surface))]/90 rounded-lg p-1">
            <button
              onClick={() => setViewMode('frames')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'frames'
                  ? 'bg-[hsl(var(--primary))] text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              画板 ({images.length})
            </button>
            <button
              onClick={() => setViewMode('assets')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'assets'
                  ? 'bg-[hsl(var(--primary))] text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              切图 ({exportAssets.length})
            </button>
          </div>
          {/* 批量下载按钮（仅切图视图显示，使用主色高亮） */}
          {viewMode === 'assets' && exportAssets.length > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={isBatchDownloading}
              title="点击此按钮将所有切图打包成一个 ZIP 文件下载"
              className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-primary-foreground rounded-lg text-sm font-semibold shadow-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Download className={`w-4 h-4 ${isBatchDownloading ? 'animate-pulse' : ''}`} />
              {isBatchDownloading
                ? `正在打包 ${batchProgress.current}/${batchProgress.total}`
                : `全部下载 (打包 ZIP)`}
            </button>
          )}
        </div>
      )}

      {/* 拖动提示 */}
      {viewMode === 'frames' && (
        <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-[hsl(var(--surface))]/90 rounded-lg z-10">
          <Move className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">拖动平移</span>
        </div>
      )}

      {/* 预览区域 */}
      {viewMode === 'frames' ? (
        /* 画板预览视图 - 支持缩放拖动 */
        <div 
          className="w-full h-full min-h-[480px] overflow-auto"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <motion.div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              transformOrigin: 'top left',
            }}
            className="relative"
          >
            {selectedIssue && <div className="m-4 mt-16 p-3 rounded-lg bg-[hsl(var(--surface))] text-sm" role="status">
              <p className="font-medium">{selectedIssue.title}</p>
              {selectedIssue.figmaUrl && <a href={selectedIssue.figmaUrl} target="_blank" rel="noreferrer"
                className="text-cyan-500 underline">在 Figma 打开{selectedIssue.nodeId ? '节点 ' + selectedIssue.nodeId : '复核画板'}</a>}
              <p className="mt-1 text-muted-foreground">
                {images.some(f => getIssueOverlay(selectedIssue, f, snapshot))
                  ? '红框：实测规则偏差；黄框：待确认或未检测。框选来自真实节点边界，缩放同步。'
                  : selectedIssue.source === 'ai'
                    ? 'AI 仅描述截图位置，未验证具体节点，不绘制猜测框。'
                    : '该节点没有可显示的匹配截图或可见边界；请用问题卡片中的 Figma 链接定位。'}
              </p>
            </div>}
            {images.length > 0 ? (
              <div className="flex flex-col gap-6 p-4 pt-16 max-w-[1000px]">
                {images.map(frame => {
                  const overlay = getIssueOverlay(selectedIssue, frame, snapshot);
                  return <div key={frame.id} ref={element => { frameRefs.current[frame.id] = element; }}>
                    <p className="mb-2 text-sm text-muted-foreground">{frame.name} · {frame.id}</p>
                    <div className="relative border border-[hsl(var(--border))]">
                      {failedImages[frame.url]
                        ? <p className="p-8 text-sm text-muted-foreground">真实截图加载失败，未显示替代画面。请重新读取文件。</p>
                        : <img src={auditImageUrl(frame.url)} alt={frame.name} draggable={false}
                            className="block w-full h-auto" loading="eager"
                            onLoad={event => {
                              const img = event.currentTarget;
                              const b = frame.bounds;
                              const matches = !!b && Math.abs(img.naturalWidth / img.naturalHeight - b.width / b.height) < 0.01;
                              setLoadedImages(prev => ({ ...prev, [frame.url]: matches }));
                            }}
                            onError={() => setFailedImages(prev => ({ ...prev, [frame.url]: true }))} />}
                      {overlay && loadedImages[frame.url] && !failedImages[frame.url] && (
                        <div data-testid="issue-overlay" aria-label={'节点标注 ' + selectedIssue?.nodeId}
                          className={'absolute pointer-events-none border-2 ' + (selectedIssue?.status === 'open' ? 'border-red-500 bg-red-500/10' : 'border-amber-400 bg-amber-400/10')}
                          style={{ left: overlay.left + '%', top: overlay.top + '%', width: overlay.width + '%', height: overlay.height + '%' }}>
                          <span className="absolute top-0 left-0 bg-black/80 text-white text-xs px-1.5 py-0.5 whitespace-nowrap">{selectedIssue?.nodeId}</span>
                        </div>
                      )}
                    </div>
                  </div>;
                })}
              </div>
            ) : <p className="p-8 pt-20 text-sm text-muted-foreground">未获取到真实画板截图。节点检测仍可查看，不使用示意图替代。</p>}
          </motion.div>
        </div>
      ) : (
        /* 切图网格视图 */
        <div className="w-full h-full overflow-auto p-4 pt-16">
          {exportAssets.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {exportAssets.map((asset, idx) => (
                <motion.div
                  key={asset.id || idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative bg-[hsl(var(--surface))] rounded-xl border border-[hsl(var(--border))] overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* 图片预览 */}
                  <div className="aspect-square bg-[hsl(var(--surface-secondary))] flex items-center justify-center p-4 overflow-hidden">
                    <FigmaImage
                      url={asset.url}
                      alt={asset.name}
                      preview={true}
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                      onError={() => {
                        // 所有代理都失败
                      }}
                    />
                  </div>
                  {/* 信息栏 */}
                  <div className="p-3 border-t border-[hsl(var(--border))]">
                    <p className="text-xs font-medium text-foreground truncate mb-2" title={asset.name}>
                      {asset.name}
                    </p>
                    <span className="text-[10px] text-muted-foreground bg-[hsl(var(--surface-secondary))] px-2 py-0.5 rounded">
                      {asset.format}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[hsl(var(--surface))] flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-sm font-medium text-foreground mb-1">未发现切图资源</h3>
                <p className="text-xs text-muted-foreground">
                  在 Figma 中为图层添加 PNG 导出设置后，重新导入即可看到切图
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
