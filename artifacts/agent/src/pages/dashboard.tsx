import { useState } from "react";
import {
  useGetDashboardStats,
  useGetToolHealth,
  useGetRecentActivity,
  useGetFeedbackStats,
} from "@workspace/api-client-react";
import { MessageSquare, BrainCircuit, Database, AlertTriangle, Activity, Loader2, CheckCircle, Cpu, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BackfillProgress {
  phase: "start" | "progress" | "done" | "error";
  done?: number;
  total?: number;
  source?: string;
  message?: string;
}

function BackfillCard() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BackfillProgress | null>(null);

  const handleBackfill = async () => {
    setRunning(true);
    setProgress(null);

    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const response = await fetch(`${BASE}/api/rag/backfill`, { method: "POST" });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const evt = JSON.parse(line.slice(6)) as BackfillProgress;
              setProgress(evt);
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setProgress({ phase: "error", message: "Connection failed" });
    } finally {
      setRunning(false);
    }
  };

  const pct = progress?.total && progress.total > 0
    ? Math.round(((progress.done ?? 0) / progress.total) * 100)
    : 0;

  return (
    <Card className="bg-card border-border shadow-none">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          Embedding Backfill
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Generate missing vector embeddings for all memories, documents, and web sources so they are
          fully searchable via semantic RAG retrieval.
        </p>

        {progress && progress.phase !== "start" && (
          <div className="space-y-2">
            {progress.phase === "progress" || progress.phase === "done" ? (
              <>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progress.phase === "done" ? "Complete" : `Embedding ${progress.source}…`}</span>
                  <span>{progress.done ?? 0} / {progress.total ?? 0}</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progress.phase === "done" ? "bg-emerald-500" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {progress.phase === "done" && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {progress.total} items embedded successfully
                  </p>
                )}
              </>
            ) : progress.phase === "error" ? (
              <p className="text-xs text-destructive">{progress.message ?? "Backfill failed"}</p>
            ) : null}
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={handleBackfill}
          disabled={running}
          className="w-full"
          data-testid="button-backfill"
        >
          {running ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              Running backfill…
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Run Embedding Backfill
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function FeedbackPanel() {
  const { data: fb, isLoading } = useGetFeedbackStats();

  const total = (fb?.totalHelpful ?? 0) + (fb?.totalUnhelpful ?? 0);
  const helpfulPct = total > 0 ? Math.round(((fb?.totalHelpful ?? 0) / total) * 100) : 0;

  const maxDay = Math.max(...(fb?.last7Days ?? []).map((d) => d.helpful + d.unhelpful), 1);

  return (
    <Card className="bg-card border-border shadow-none">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ThumbsUp className="w-4 h-4 text-primary" />
          Response Feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-5">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : total === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No reactions yet — rate assistant messages with 👍 or 👎</p>
        ) : (
          <>
            {/* Totals */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-green-400">
                <ThumbsUp className="w-4 h-4" />
                <span className="text-xl font-bold">{fb?.totalHelpful ?? 0}</span>
                <span className="text-xs text-muted-foreground">helpful</span>
              </div>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${helpfulPct}%` }}
                />
              </div>
              <div className="flex items-center gap-1.5 text-red-400">
                <span className="text-xl font-bold">{fb?.totalUnhelpful ?? 0}</span>
                <ThumbsDown className="w-4 h-4" />
                <span className="text-xs text-muted-foreground">not helpful</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {helpfulPct}% satisfaction rate across {total} rated {total === 1 ? "response" : "responses"}
            </p>

            {/* 7-day bar chart */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Last 7 days</p>
              <div className="flex items-end gap-1 h-16">
                {(fb?.last7Days ?? []).map((d) => {
                  const dayTotal = d.helpful + d.unhelpful;
                  const heightPct = dayTotal > 0 ? Math.round((dayTotal / maxDay) * 100) : 0;
                  const hPct = dayTotal > 0 ? Math.round((d.helpful / dayTotal) * 100) : 0;
                  const label = new Date(d.date + "T12:00:00").toLocaleDateString([], { weekday: "short" });
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm overflow-hidden flex flex-col-reverse"
                        style={{ height: `${heightPct}%`, minHeight: dayTotal > 0 ? "4px" : "0" }}
                        title={`${d.date}: ${d.helpful} helpful, ${d.unhelpful} not helpful`}
                      >
                        <div className="bg-green-500" style={{ height: `${hPct}%` }} />
                        <div className="bg-red-500" style={{ height: `${100 - hPct}%` }} />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top conversations */}
            {(fb?.topConversations ?? []).length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Top rated conversations</p>
                <div className="space-y-1.5">
                  {(fb?.topConversations ?? []).slice(0, 5).map((c) => {
                    const cTotal = c.helpful + c.unhelpful;
                    const cPct = cTotal > 0 ? Math.round((c.helpful / cTotal) * 100) : 0;
                    return (
                      <div key={c.conversationId} className="flex items-center gap-2 text-xs">
                        <span className="truncate flex-1 text-muted-foreground">{c.title}</span>
                        <span className="text-green-400 shrink-0">{c.helpful}👍</span>
                        <span className="text-red-400 shrink-0">{c.unhelpful}👎</span>
                        <span className="text-muted-foreground shrink-0 w-8 text-right">{cPct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: loadingStats } = useGetDashboardStats();
  const { data: toolHealth = [], isLoading: loadingHealth } = useGetToolHealth();
  const { data: activities = [], isLoading: loadingActivity } = useGetRecentActivity();

  if (loadingStats || loadingHealth || loadingActivity) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Command Center</h1>
        <p className="text-muted-foreground text-sm mt-1">System overview and analytics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Conversations" value={stats?.totalConversations} icon={MessageSquare} />
        <StatCard title="Memories" value={stats?.totalMemories} icon={BrainCircuit} />
        <StatCard title="Documents" value={stats?.totalDocuments} icon={Database} />
        <StatCard title="Recent Errors" value={stats?.recentErrors} icon={AlertTriangle} isError={stats?.recentErrors ? stats.recentErrors > 0 : false} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border shadow-none">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Tool Health
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 p-0">
            <div className="divide-y divide-border">
              {toolHealth.map((tool) => (
                <div key={tool.toolName} className="flex items-center justify-between p-4 hover:bg-muted/20">
                  <div className="flex items-center gap-3">
                    {tool.status === "healthy" ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : tool.status === "degraded" ? (
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="font-mono text-sm">{tool.toolName}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{(tool.successRate * 100).toFixed(1)}% SR</span>
                    {tool.recentFailures > 0 && (
                      <span className="text-destructive bg-destructive/10 px-2 py-0.5 rounded text-xs">{tool.recentFailures} fails</span>
                    )}
                  </div>
                </div>
              ))}
              {toolHealth.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No tools registered</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-none">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 p-0">
            <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
              {activities.map((act) => (
                <div key={act.id} className="p-4 flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm">{act.type}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(act.createdAt as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{act.description}</p>
                </div>
              ))}
              {activities.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No recent activity</div>}
            </div>
          </CardContent>
        </Card>

        <BackfillCard />
        <FeedbackPanel />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, isError = false }: { title: string; value?: number; icon: React.ElementType; isError?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${isError ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Icon className={`w-4 h-4 ${isError ? "text-destructive" : "text-primary"}`} />
      </div>
      <div className={`text-2xl font-bold ${isError ? "text-destructive" : "text-foreground"}`}>
        {value ?? "-"}
      </div>
    </div>
  );
}
