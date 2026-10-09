import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export default function AIAnalysisAnimation({ onComplete }: { onComplete: () => void }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    onComplete();
  }, [onComplete]);
  return <div role="status" className="fixed inset-0 bg-background/95 flex items-center justify-center z-50">
    <div className="text-center space-y-3"><Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
      <p className="text-lg">正在计算已读取文件的规则结果</p>
      <p className="text-sm text-muted-foreground">无预设结论；缺失数据会标为未能检测。</p>
    </div>
  </div>;
}
