import { useState } from "react";
import {
  useListMemories,
  useCreateMemory,
  useDeleteMemory,
  useRunReflection,
  getListMemoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Star, Search, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function MemoriesPage() {
  const queryClient = useQueryClient();
  const { data: memories = [], isLoading } = useListMemories();
  const createMemory = useCreateMemory();
  const deleteMemory = useDeleteMemory();
  const runReflection = useRunReflection();

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<"preference" | "fact" | "workflow" | "lesson">("fact");
  const [reflectionResult, setReflectionResult] = useState<{
    messagesAnalyzed: number;
    memoriesCreated: number;
    summary: string;
  } | null>(null);

  const filteredMemories = memories.filter(
    (m) =>
      m.content.toLowerCase().includes(search.toLowerCase()) ||
      m.type.toLowerCase().includes(search.toLowerCase()) ||
      (m.category ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    createMemory.mutate(
      {
        data: {
          content: newContent,
          type: newType,
          owner: "user",
          importanceScore: 3,
        },
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setNewContent("");
          queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey() });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteMemory.mutate(
      { id },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey() }),
      }
    );
  };

  const handleReflect = () => {
    setReflectionResult(null);
    runReflection.mutate(
      { data: { lookbackHours: 24, maxMessages: 100 } },
      {
        onSuccess: (result) => {
          setReflectionResult({
            messagesAnalyzed: result.messagesAnalyzed,
            memoriesCreated: result.memoriesCreated,
            summary: result.summary,
          });
          queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey() });
        },
      }
    );
  };

  const typeColors: Record<string, string> = {
    preference: "text-violet-400 border-violet-400/30 bg-violet-400/10",
    fact: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    workflow: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    lesson: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  };

  return (
    <div className="p-6 h-full flex flex-col max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Memory Bank</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Core beliefs, facts, and learned workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReflect}
            disabled={runReflection.isPending}
            data-testid="button-run-reflection"
            className="border-violet-500/40 text-violet-300 hover:bg-violet-500/10 hover:text-violet-200"
          >
            {runReflection.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {runReflection.isPending ? "Reflecting..." : "Run Reflection"}
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-memory">
                <Plus className="w-4 h-4 mr-2" /> Add Memory
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Add Memory</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <textarea
                  className="w-full bg-background border border-input rounded-md p-3 text-sm focus:ring-1 focus:ring-ring resize-none h-24"
                  placeholder="Content..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  data-testid="input-memory-content"
                />
                <select
                  className="w-full bg-background border border-input rounded-md p-2 text-sm focus:ring-1 focus:ring-ring"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as typeof newType)}
                  data-testid="select-memory-type"
                >
                  <option value="fact">Fact</option>
                  <option value="preference">Preference</option>
                  <option value="workflow">Workflow</option>
                  <option value="lesson">Lesson</option>
                </select>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={!newContent.trim() || createMemory.isPending}
                  data-testid="button-save-memory"
                >
                  {createMemory.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {reflectionResult && (
        <div className="mb-5 p-4 rounded-lg border border-violet-500/30 bg-violet-500/5 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <p className="text-violet-300 font-medium">
              Reflection complete — {reflectionResult.memoriesCreated} new{" "}
              {reflectionResult.memoriesCreated === 1 ? "memory" : "memories"} from{" "}
              {reflectionResult.messagesAnalyzed} messages
            </p>
            <p className="text-muted-foreground">{reflectionResult.summary}</p>
          </div>
          <button
            onClick={() => setReflectionResult(null)}
            className="ml-auto text-muted-foreground hover:text-foreground text-xs shrink-0"
          >
            dismiss
          </button>
        </div>
      )}

      {runReflection.isError && (
        <div className="mb-5 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
          Reflection failed. Make sure you have some recent conversations to analyze.
        </div>
      )}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search memories..."
          className="pl-9 bg-card border-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-memories"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground border border-dashed border-border rounded-lg">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium mb-1">No memories yet</p>
            <p className="text-xs">
              Add one manually or run a reflection after chatting to extract them automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredMemories.map((m) => (
              <div
                key={m.id}
                className="p-4 bg-card border border-border rounded-lg flex items-start justify-between group hover:border-border/80 transition-colors"
                data-testid={`card-memory-${m.id}`}
              >
                <div className="space-y-2 flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-xs uppercase font-mono ${typeColors[m.type] ?? ""}`}
                    >
                      {m.type}
                    </Badge>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {m.owner}
                    </Badge>
                    {m.category && (
                      <span className="text-xs text-muted-foreground">{m.category}</span>
                    )}
                    <div className="flex items-center text-yellow-500/80 ml-auto">
                      {Array.from({ length: m.importanceScore ?? 0 }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-current" />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-card-foreground leading-relaxed">{m.content}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                  onClick={() => handleDelete(m.id)}
                  disabled={deleteMemory.isPending}
                  data-testid={`button-delete-memory-${m.id}`}
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
