import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, Move, Crosshair } from 'lucide-react';
import { Issue } from './IssueList';

interface FigmaPreviewProps {
  selectedIssue?: Issue;
  onIssueHighlight?: (issue: Issue) => void;
  images?: string[];
}

export default function FigmaPreview({ selectedIssue, onIssueHighlight, images = [] }: FigmaPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative w-full h-full bg-[hsl(var(--surface-secondary))] rounded-xl overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Toolbar */}
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

      {/* View Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-[hsl(var(--surface))]/90 rounded-lg">
        <Move className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">拖动平移</span>
      </div>

      {/* Preview Area */}
      <div 
        className="w-full h-full overflow-hidden"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
            <div className="flex flex-col gap-4 p-4 bg-gray-100 rounded-2xl min-w-[400px]">
              {images.map((imgUrl, idx) => (
                <div key={idx} className="relative bg-white rounded-xl shadow-lg overflow-hidden">
                  <img
                    src={imgUrl}
                    alt={`Figma Frame ${idx + 1}`}
                    className="w-full h-auto object-contain"
                    style={{ minWidth: 400, maxWidth: 800 }}
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 rounded text-[10px] text-white">
                    画框 {idx + 1}
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
    </motion.div>
  );
}

