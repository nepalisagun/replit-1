import { useState } from "react";
import { useListMemories, useCreateMemory, useUpdateMemory, useDeleteMemory, getListMemoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Star, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function MemoriesPage() {
  const queryClient = useQueryClient();
  const { data: memories = [], isLoading } = useListMemories();
  const createMemory = useCreateMemory();
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();
  
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<"preference"|"fact"|"workflow"|"lesson">("fact");
  
  const filteredMemories = memories.filter(m => 
    m.content.toLowerCase().includes(search.toLowerCase()) || 
    m.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    createMemory.mutate({
      data: {
        content: newContent,
        type: newType,
        owner: "user",
        importanceScore: 3
      }
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setNewContent("");
        queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteMemory.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey() })
    });
  };

  return (
    <div className="p-6 h-full flex flex-col max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Memory Bank</h1>
          <p className="text-muted-foreground text-sm mt-1">Core beliefs, facts, and learned workflows.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Memory</Button>
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
              />
              <select 
                className="w-full bg-background border border-input rounded-md p-2 text-sm focus:ring-1 focus:ring-ring"
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
              >
                <option value="fact">Fact</option>
                <option value="preference">Preference</option>
                <option value="workflow">Workflow</option>
                <option value="lesson">Lesson</option>
              </select>
              <Button className="w-full" onClick={handleCreate} disabled={!newContent.trim() || createMemory.isPending}>
                {createMemory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search memories..." 
          className="pl-9 bg-card border-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filteredMemories.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground border border-dashed border-border rounded-lg">
            No memories found.
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredMemories.map(m => (
              <div key={m.id} className="p-4 bg-card border border-border rounded-lg flex items-start justify-between group">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs uppercase bg-muted/50">{m.type}</Badge>
                    <Badge variant="secondary" className="text-xs capitalize">{m.owner}</Badge>
                    <div className="flex items-center text-yellow-500">
                      {Array.from({length: m.importanceScore || 0}).map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                    </div>
                  </div>
                  <p className="text-sm font-mono text-card-foreground leading-relaxed">{m.content}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  onClick={() => handleDelete(m.id)}
                  disabled={deleteMemory.isPending}
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
