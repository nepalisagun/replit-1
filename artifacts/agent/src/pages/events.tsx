import { useState } from "react";
import { useListAgentEvents } from "@workspace/api-client-react";
import { Activity, Loader2, Filter, AlertCircle, CheckCircle2, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function EventsPage() {
  const [filter, setFilter] = useState<string>("all");
  
  const queryParams = filter === "all" ? {} : { status: filter as any };
  const { data: events = [], isLoading } = useListAgentEvents(queryParams);

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "success": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "error": return <AlertCircle className="w-4 h-4 text-destructive" />;
      case "retrying": return <RotateCw className="w-4 h-4 text-yellow-500 animate-spin" />;
      case "degraded": return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default: return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "success": return "border-green-500/20 bg-green-500/10 text-green-500";
      case "error": return "border-destructive/20 bg-destructive/10 text-destructive";
      case "retrying": return "border-yellow-500/20 bg-yellow-500/10 text-yellow-500";
      case "degraded": return "border-orange-500/20 bg-orange-500/10 text-orange-500";
      default: return "border-border bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="p-6 h-full flex flex-col max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agent Event Log</h1>
          <p className="text-muted-foreground text-sm mt-1">Live telemetry of tool calls and internal processes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select 
            className="bg-card border border-border rounded-md px-3 py-1.5 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="retrying">Retrying</option>
            <option value="degraded">Degraded</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-card border border-border rounded-lg">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground">
            No events recorded yet.
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Context ID</th>
                <th className="px-4 py-3 font-medium">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30 transition-colors font-mono">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleTimeString([], { hour12: false })}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {e.eventType}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(e.status)}
                      <span className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(e.status)} capitalize`}>
                        {e.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.contextId || '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {e.payload || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
