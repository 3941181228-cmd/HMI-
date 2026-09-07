import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, Move, Crosshair, Download, Image as ImageIcon, Layers } from 'lucide-react';
import JSZip from 'jszip';
import { Issue } from './IssueList';
import { fetchFigmaImageAsBlob } from '../services/figmaImageProxy';
import { FigmaImage } from './FigmaImage';

interface FrameImage {
  id: string;
  name: string;
  url: string;
}

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
  exportAssets?: ExportAsset[];
}

type ViewMode = 'frames' | 'assets';

export default function FigmaPreview({ selectedIssue, onIssueHighlight, images = [], exportAssets = [] }: FigmaPreviewProps) {
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
    if (selectedIssue?.position) {
      // Center on the selected issue
      const centerX = (window.innerWidth / 2) - (selectedIssue.position.x + selectedIssue.position.width / 2);
      const centerY = (window.innerHeight / 2) - (selectedIssue.position.y + selectedIssue.position.height / 2);
      setPosition({ x: centerX, y: centerY });
      setZoom(1.5);
    }
  }, [selectedIssue]);

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
          onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
          className="p-2 bg-[hsl(var(--surface))]/90 hover:bg-[hsl(var(--surface))] rounded-lg text-foreground transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
          className="p-2 bg-[hsl(var(--surface))]/90 hover:bg-[hsl(var(--surface))] rounded-lg text-foreground transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}
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
          className="w-full h-full overflow-hidden"
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
              transformOrigin: 'center center',
            }}
            className="relative"
          >
            {/* Preview Content */}
            {images.length > 0 ? (
              <div className="flex flex-col gap-4 p-4 bg-[hsl(var(--surface-secondary))] rounded-2xl min-w-[400px] max-w-[800px]">
                {images.map((frame, idx) => (
                  <div key={frame.id || idx} className="relative bg-[hsl(var(--surface))] rounded-xl shadow-lg overflow-hidden border border-[hsl(var(--border))]">
                    <FigmaImage
                      url={frame.url}
                      alt={frame.name}
                      preview={true}
                      className="w-full h-auto object-contain"
                      loading="eager"
                      onError={() => {
                        // 所有代理都失败
                      }}
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-[11px] text-white font-medium max-w-[80%] truncate">
                      {frame.name}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
            <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[800px] h-[600px]">
              {/* HMI Dashboard Mock */}
              <div className="w-full h-full flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />
                    <div>
                      <p className="font-semibold text-gray-900">HMI Dashboard</p>
                      <p className="text-xs text-gray-500">Charging Dashboard</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 grid grid-cols-2 gap-4">
                  {/* Left Panel */}
                  <div className="space-y-4">
                    <div className="h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Battery Level</p>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-gray-900">85%</span>
                        <span className="text-xs text-green-600">Charging</span>
                      </div>
                    </div>
                    <div className="h-24 bg-gray-100 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Range</p>
                      <span className="text-2xl font-bold text-gray-900">420 km</span>
                    </div>
                  </div>

                  {/* Right Panel */}
                  <div className="space-y-4">
                    <div className="h-24 bg-gray-100 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Charging Speed</p>
                      <span className="text-2xl font-bold text-gray-900">120 kW</span>
                    </div>
                    <div className="h-32 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">ETA</p>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-gray-900">25 min</span>
                        <span className="text-xs text-gray-500">to full</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex gap-3">
                  <button className="flex-1 h-12 bg-gray-900 text-white rounded-xl font-medium">
                    Start Charging
                  </button>
                  <button className="flex-1 h-12 bg-gray-100 text-gray-900 rounded-xl font-medium">
                    Schedule
                  </button>
                  <button className="w-12 h-12 bg-gray-100 text-gray-900 rounded-xl">
                    ⋮
                  </button>
                </div>
              </div>

              {/* Issue Highlight Overlay */}
              <AnimatePresence>
                {selectedIssue?.position && (
                  <>
                    {/* Blur Background */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-none"
                      style={{
                        clipPath: `polygon(
                          0 0, 
                          100% 0, 
                          100% 100%, 
                          0 100%, 
                          0 0, 
                          ${selectedIssue.position.x}px ${selectedIssue.position.y}px, 
                          ${selectedIssue.position.x + selectedIssue.position.width}px ${selectedIssue.position.y}px, 
                          ${selectedIssue.position.x + selectedIssue.position.width}px ${selectedIssue.position.y + selectedIssue.position.height}px, 
                          ${selectedIssue.position.x}px ${selectedIssue.position.y + selectedIssue.position.height}px, 
                          ${selectedIssue.position.x}px ${selectedIssue.position.y}px
                        )`
                      }}
                    />
                    
                    {/* Highlight Box */}
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="absolute border-2 border-red-500 bg-red-500/10 rounded-lg"
                      style={{
                        left: selectedIssue.position.x,
                        top: selectedIssue.position.y,
                        width: selectedIssue.position.width,
                        height: selectedIssue.position.height,
                      }}
                    >
                      {/* Scan Animation */}
                      <motion.div
                        animate={{ y: ['0%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 bg-gradient-to-b from-red-500/20 to-transparent"
                      />
                      
                      {/* Corner Markers */}
                      <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-red-500" />
                      <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-red-500" />
                      <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-red-500" />
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-red-500" />
                    </motion.div>

                    {/* Issue Info Popup */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bg-white rounded-xl shadow-xl p-4 max-w-xs z-20"
                      style={{
                        left: Math.min(selectedIssue.position.x + selectedIssue.position.width + 10, 600),
                        top: selectedIssue.position.y,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Crosshair className="w-4 h-4 text-red-500" />
                        <span className="font-medium text-gray-900">{selectedIssue.title}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{selectedIssue.description}</p>
                      <div className="flex items-center gap-2 text-xs text-green-600">
                        <span className="font-medium">建议:</span>
                        {selectedIssue.suggestion}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            )}
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
