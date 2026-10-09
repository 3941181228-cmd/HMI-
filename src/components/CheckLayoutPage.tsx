import IssueList from './IssueList';
import type { CheckIssue } from '../services/figmaAnalyzer';

export default function CheckLayoutPage({ checkIssues = [], onSelectIssue = () => {} }: {
  checkIssues?: CheckIssue[];
  onSelectIssue?: (issue: CheckIssue, nodeId?: string) => void;
}) {
  return <section className="space-y-4">
    <h2 className="text-xl font-semibold">布局对齐检查</h2>
    <p className="text-sm text-muted-foreground">仅展示本次文件快照的实际检测记录。提示与未检测项不等于通过。</p>
    <IssueList issues={checkIssues} onSelectIssue={onSelectIssue} />
  </section>;
}
