import { 
  useGetDashboardStats, 
  useGetToolHealth, 
  useGetRecentActivity 
} from "@workspace/api-client-react";
import { MessageSquare, BrainCircuit, Database, AlertTriangle, Activity, Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{act.description}</p>
                </div>
              ))}
              {activities.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No recent activity</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, isError = false }: any) {
  return (
    <div className={`p-4 rounded-xl border ${isError ? 'border-destructive bg-destructive/5' : 'border-border bg-card'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Icon className={`w-4 h-4 ${isError ? 'text-destructive' : 'text-primary'}`} />
      </div>
      <div className={`text-2xl font-bold ${isError ? 'text-destructive' : 'text-foreground'}`}>
        {value ?? '-'}
      </div>
    </div>
  );
}
