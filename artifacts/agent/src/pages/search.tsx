import { useState } from "react";
import {
  useRunWebSearch,
  useListWebSources,
  useDeleteWebSource,
  getListWebSourcesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  ExternalLink,
  ShieldCheck,
  FileText,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type VerificationStatus = "verified" | "uncertain" | "conflicted";

const STATUS_CONFIG: Record<
  VerificationStatus,
  { icon: typeof CheckCircle2; label: string; color: string; border: string; bg: string }
> = {
  verified: {
    icon: CheckCircle2,
    label: "Verified",
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
  },
  uncertain: {
    icon: AlertTriangle,
    label: "Uncertain",
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
  },
  conflicted: {
    icon: XCircle,
    label: "Conflicted",
    color: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/5",
  },
};

function TrustBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

function VerificationBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as VerificationStatus];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

export default function SearchPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [lastResult, setLastResult] = useState<{
    query: string;
    verificationStatus: string;
    consolidatedSummary: string;
    sourcesChecked: number;
    sources: Array<{ url: string; title: string; snippet: string; trustScore: number; verificationStatus: string }>;
    savedToDocuments: boolean;
  } | null>(null);

  const runSearch = useRunWebSearch();
  const { data: savedSources = [], isLoading: sourcesLoading } = useListWebSources();
  const deleteSource = useDeleteWebSource();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || runSearch.isPending) return;
    setLastResult(null);
    runSearch.mutate(
      { data: { query: query.trim(), minSources: 2 } },
      {
        onSuccess: (result) => {
          setLastResult(result);
          queryClient.invalidateQueries({ queryKey: getListWebSourcesQueryKey() });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteSource.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListWebSourcesQueryKey() }),
    });
  };

  const statusCfg = lastResult
    ? STATUS_CONFIG[lastResult.verificationStatus as VerificationStatus]
    : null;

  return (
    <div className="p-6 h-full flex flex-col max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Web Search</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Multi-source verified search — Gemini fetches, cross-references, and scores each result before storing.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search the web and verify across sources..."
            className="pl-9 bg-card border-border"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={runSearch.isPending}
            data-testid="input-search-query"
          />
        </div>
        <Button type="submit" disabled={!query.trim() || runSearch.isPending} data-testid="button-search">
          {runSearch.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Search
            </>
          )}
        </Button>
      </form>

      {/* Progress state */}
      {runSearch.isPending && (
        <div className="mb-6 p-4 rounded-lg border border-border bg-card space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Asking Gemini for relevant sources...</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground/60 pl-6">
            Fetching content via Jina Reader, then cross-referencing claims...
          </div>
        </div>
      )}

      {/* Error state */}
      {runSearch.isError && (
        <div className="mb-6 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
          Search failed. The verification pipeline could not complete. Try a different query.
        </div>
      )}

      {/* Result */}
      {lastResult && statusCfg && (
        <div
          className={`mb-6 p-4 rounded-lg border ${statusCfg.border} ${statusCfg.bg} space-y-4`}
          data-testid="search-result"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <VerificationBadge status={lastResult.verificationStatus} />
                <span className="text-xs text-muted-foreground">
                  {lastResult.sourcesChecked} source{lastResult.sourcesChecked !== 1 ? "s" : ""} checked
                </span>
                {lastResult.savedToDocuments && (
                  <span className="inline-flex items-center gap-1 text-xs text-violet-400">
                    <FileText className="w-3 h-3" />
                    saved to knowledge base
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed">{lastResult.consolidatedSummary}</p>
            </div>
          </div>

          <div className="grid gap-2 pt-2 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sources</p>
            {lastResult.sources.map((s, i) => (
              <div key={i} className="p-3 rounded-md bg-background/60 border border-border/50 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary hover:underline truncate flex items-center gap-1"
                    data-testid={`link-source-${i}`}
                  >
                    <Globe className="w-3 h-3 shrink-0" />
                    {s.title || new URL(s.url).hostname}
                    <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                  </a>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{s.snippet}</p>
                <TrustBar score={s.trustScore} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stored sources */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Source History
          </h2>
          <span className="text-xs text-muted-foreground">{savedSources.length} stored</span>
        </div>

        {sourcesLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : savedSources.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground border border-dashed border-border rounded-lg">
            <Globe className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium mb-1">No sources stored yet</p>
            <p className="text-xs">Run a search above to fetch and verify web content.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {savedSources.map((s) => (
              <div
                key={s.id}
                className="p-3 bg-card border border-border rounded-lg flex items-start gap-3 group hover:border-border/80 transition-colors"
                data-testid={`card-source-${s.id}`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{s.query}</span>
                    <VerificationBadge status={s.verificationStatus} />
                    <span className="text-xs text-muted-foreground ml-auto">
                      trust {Math.round(s.trustScore * 100)}%
                    </span>
                  </div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                  >
                    <Globe className="w-3 h-3 shrink-0" />
                    {s.title}
                    <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                  </a>
                  <p className="text-xs text-muted-foreground line-clamp-1">{s.snippet}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                  onClick={() => handleDelete(s.id)}
                  disabled={deleteSource.isPending}
                  data-testid={`button-delete-source-${s.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
