import { useState } from "react";
import { useListDocuments, useCreateDocument, useDeleteDocument, getListDocumentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, FileText, Globe, CheckCircle2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const { data: documents = [], isLoading } = useListDocuments();
  const createDoc = useCreateDocument();
  const deleteDoc = useDeleteDocument();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newSource, setNewSource] = useState<"local"|"web"|"web_verified">("local");

  const handleCreate = () => {
    createDoc.mutate({
      data: {
        title: newTitle,
        content: newContent,
        source: newSource,
      }
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setNewTitle("");
        setNewContent("");
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteDoc.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() })
    });
  };

  const getSourceIcon = (source: string) => {
    if (source === "local") return <FileText className="w-3 h-3 mr-1" />;
    if (source === "web") return <Globe className="w-3 h-3 mr-1" />;
    if (source === "web_verified") return <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />;
    return null;
  };

  return (
    <div className="p-6 h-full flex flex-col max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground text-sm mt-1">Processed documents and web context.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Document</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Add Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <input 
                className="w-full bg-background border border-input rounded-md p-2 text-sm focus:ring-1 focus:ring-ring"
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <textarea 
                className="w-full bg-background border border-input rounded-md p-3 text-sm focus:ring-1 focus:ring-ring resize-none h-24"
                placeholder="Content..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
              <select 
                className="w-full bg-background border border-input rounded-md p-2 text-sm focus:ring-1 focus:ring-ring"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value as any)}
              >
                <option value="local">Local</option>
                <option value="web">Web</option>
                <option value="web_verified">Web Verified</option>
              </select>
              <Button className="w-full" onClick={handleCreate} disabled={!newTitle.trim() || !newContent.trim() || createDoc.isPending}>
                {createDoc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : documents.length === 0 ? (
          <div className="text-center p-12 border border-dashed border-border rounded-lg bg-card/50">
            <DatabaseIcon className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No documents loaded.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map(doc => (
              <div key={doc.id} className="p-4 bg-card border border-border rounded-lg flex flex-col group h-48">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="flex items-center font-normal">
                      {getSourceIcon(doc.source)}
                      <span className="capitalize">{doc.source.replace("_", " ")}</span>
                    </Badge>
                    {doc.canonicalCategory && (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        {doc.canonicalCategory}
                      </Badge>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-2 -mr-2"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleteDoc.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <h3 className="font-semibold text-sm mb-2 line-clamp-1">{doc.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-4 flex-1">
                  {doc.content}
                </p>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-3 truncate block">
                    {doc.url}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DatabaseIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  )
}
