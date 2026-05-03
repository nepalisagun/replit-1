import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Send, Plus, Bot, User, Loader2, Trash2, BrainCircuit,
  FileText, Globe, Pin, PinOff, Archive, ArchiveRestore, ChevronDown, ChevronRight,
  Pencil, Check, X, Search, MessageSquare, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useListGeminiConversations,
  useCreateGeminiConversation,
  useDeleteGeminiConversation,
  usePinGeminiConversation,
  useArchiveGeminiConversation,
  useRenameGeminiConversation,
  useSearchGeminiMessages,
  getSearchGeminiMessagesQueryKey,
  useGetGeminiConversation,
  useListGeminiMessages,
  getListGeminiMessagesQueryKey,
  getGetGeminiConversationQueryKey,
  getListGeminiConversationsQueryKey,
} from "@workspace/api-client-react";

interface RagMeta { memoriesUsed: number; documentsUsed: number; webSourcesUsed: number; total: number; }

function RagContextBadge({ meta }: { meta: RagMeta }) {
  const parts: string[] = [];
  if (meta.memoriesUsed > 0) parts.push(`${meta.memoriesUsed} mem`);
  if (meta.documentsUsed > 0) parts.push(`${meta.documentsUsed} doc`);
  if (meta.webSourcesUsed > 0) parts.push(`${meta.webSourcesUsed} web`);
  if (parts.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 pl-12">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 font-medium">
        {meta.memoriesUsed > 0 && <BrainCircuit className="w-3 h-3" />}
        {meta.documentsUsed > 0 && <FileText className="w-3 h-3" />}
        {meta.webSourcesUsed > 0 && <Globe className="w-3 h-3" />}
        context: {parts.join(" · ")}
      </span>
    </div>
  );
}

type Convo = { id: number; title: string; pinned: boolean; archived: boolean; createdAt: string };

type MsgRow = { id: number; conversationId: number; role: string; content: string; createdAt: string };

function exportConversation(title: string, msgs: MsgRow[], format: "md" | "txt") {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = title.replace(/[^a-z0-9_\-]/gi, "_").slice(0, 60);

  let content: string;
  if (format === "md") {
    const lines = [`# ${title}`, `*Exported ${date}*`, ""];
    for (const m of msgs) {
      const role = m.role === "assistant" || m.role === "model" ? "**Assistant**" : "**You**";
      lines.push(`${role}\n\n${m.content}`, "---", "");
    }
    content = lines.join("\n");
  } else {
    const lines = [title, `Exported ${date}`, "=".repeat(40), ""];
    for (const m of msgs) {
      const role = m.role === "assistant" || m.role === "model" ? "ASSISTANT" : "YOU";
      lines.push(`[${role}]`, m.content, "", "-".repeat(40), "");
    }
    content = lines.join("\n");
  }

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}_${date}.${format === "md" ? "md" : "txt"}`;
  a.click();
  URL.revokeObjectURL(url);
}

function highlightMatch(text: string, query: string) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function ConvoItem({
  c, active, onSelect, onDelete, onPin, onArchive, onRename,
  deletePending, pinPending, archivePending,
}: {
  c: Convo; active: boolean;
  onSelect: () => void; onDelete: (e: React.MouseEvent) => void;
  onPin: (e: React.MouseEvent) => void; onArchive: (e: React.MouseEvent) => void;
  onRename: (newTitle: string) => void;
  deletePending: boolean; pinPending: boolean; archivePending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.title);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(c.title);
    setEditing(true);
    setTimeout(() => { inputRef.current?.select(); }, 0);
  }

  function commit(e?: React.MouseEvent) {
    e?.stopPropagation();
    const trimmed = draft.trim();
    if (trimmed && trimmed !== c.title) onRename(trimmed);
    setEditing(false);
  }

  function cancel(e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditing(false);
    setDraft(c.title);
  }

  if (editing) {
    return (
      <div className={`w-full px-2 py-1 rounded-md flex items-center gap-1 ${active ? "bg-primary/20" : "bg-muted"}`}>
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") cancel();
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-background border border-ring rounded px-2 py-0.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0"
          maxLength={100}
        />
        <Button variant="ghost" size="icon" className="w-5 h-5 shrink-0 text-green-400 hover:bg-green-400/10"
          onClick={commit} title="Save">
          <Check className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon" className="w-5 h-5 shrink-0 text-muted-foreground hover:bg-muted"
          onClick={cancel} title="Cancel">
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      onDoubleClick={startEdit}
      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer group flex items-center gap-1 ${
        active ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {c.pinned && <Pin className="w-3 h-3 shrink-0 text-amber-400" />}
      {c.archived && !c.pinned && <Archive className="w-3 h-3 shrink-0 text-muted-foreground/60" />}
      <span className="truncate flex-1">{c.title}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
        <Button variant="ghost" size="icon" className="w-5 h-5 hover:text-foreground hover:bg-muted"
          onClick={startEdit} title="Rename">
          <Pencil className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon" className="w-5 h-5 hover:text-amber-400 hover:bg-amber-400/10"
          onClick={onPin} disabled={pinPending} title={c.pinned ? "Unpin" : "Pin"}>
          {c.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </Button>
        <Button variant="ghost" size="icon" className="w-5 h-5 hover:text-blue-400 hover:bg-blue-400/10"
          onClick={onArchive} disabled={archivePending} title={c.archived ? "Unarchive" : "Archive"}>
          {c.archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
        </Button>
        <Button variant="ghost" size="icon" className="w-5 h-5 hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete} disabled={deletePending}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [pendingRagMeta, setPendingRagMeta] = useState<RagMeta | null>(null);
  const [ragMetaMap, setRagMetaMap] = useState<Record<number, RagMeta>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: allConvos = [], isLoading: loadingConvos } = useListGeminiConversations();
  const createConvo = useCreateGeminiConversation();
  const deleteConvo = useDeleteGeminiConversation();
  const pinConvo = usePinGeminiConversation();
  const archiveConvo = useArchiveGeminiConversation();
  const renameConvo = useRenameGeminiConversation();

  const { data: searchResults = [], isFetching: searchFetching } = useSearchGeminiMessages(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length > 0, queryKey: getSearchGeminiMessagesQueryKey({ q: debouncedQuery }) } }
  );

  const typedConvos = allConvos as Convo[];
  const pinned = typedConvos.filter((c) => c.pinned && !c.archived);
  const regular = typedConvos.filter((c) => !c.pinned && !c.archived);
  const archived = typedConvos.filter((c) => c.archived);

  const { data: activeConvo } = useGetGeminiConversation(
    activeId as number,
    { query: { enabled: !!activeId, queryKey: getGetGeminiConversationQueryKey(activeId as number) } }
  );

  const { data: messages = [], isLoading: loadingMessages } = useListGeminiMessages(
    activeId as number,
    { query: { enabled: !!activeId, queryKey: getListGeminiMessagesQueryKey(activeId as number) } }
  );

  useEffect(() => {
    if (typedConvos.length && !activeId) {
      const first = pinned[0] ?? regular[0];
      if (first) setActiveId(first.id);
    }
  }, [typedConvos, activeId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamBuffer]);
  useEffect(() => { setRagMetaMap({}); setPendingRagMeta(null); }, [activeId]);

  function invalidateConvos() {
    queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
  }

  const handleCreateConvo = () => {
    createConvo.mutate({ data: { title: "New Conversation" } }, {
      onSuccess: (convo) => { setActiveId(convo.id); invalidateConvos(); }
    });
  };

  const handleDeleteConvo = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConvo.mutate({ id }, { onSuccess: () => { if (activeId === id) setActiveId(null); invalidateConvos(); } });
  };

  const handlePin = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    pinConvo.mutate({ id }, { onSuccess: invalidateConvos });
  };

  const handleArchive = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    archiveConvo.mutate({ id }, {
      onSuccess: (data) => {
        const updated = data as Convo;
        if (updated.archived && activeId === id) setActiveId(null);
        invalidateConvos();
      }
    });
  };

  const handleRename = (id: number, newTitle: string) => {
    renameConvo.mutate({ id, data: { title: newTitle } }, {
      onSuccess: invalidateConvos,
    });
  };

  const handleSend = async () => {
    if (!input.trim() || !activeId || isStreaming) return;
    const userMessage = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamBuffer("");
    setPendingRagMeta(null);

    const tempMessages = [...messages, { id: -1, conversationId: activeId, role: "user", content: userMessage, createdAt: new Date().toISOString() }];
    queryClient.setQueryData(getListGeminiMessagesQueryKey(activeId), tempMessages);

    let capturedRagMeta: RagMeta | null = null;

    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const response = await fetch(`${BASE}/api/gemini/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const json = JSON.parse(line.slice(6));
            if (json.done) break;
            if (json.ragContext) { capturedRagMeta = json.ragContext as RagMeta; setPendingRagMeta(capturedRagMeta); }
            if (json.titleUpdate) {
              queryClient.setQueryData(
                getListGeminiConversationsQueryKey(),
                (old: Convo[] | undefined) =>
                  old?.map((c) => c.id === json.titleUpdate.id ? { ...c, title: json.titleUpdate.title } : c) ?? old
              );
            }
            if (json.content) setStreamBuffer((prev) => prev + json.content);
          }
        }
      }
    } catch (e) { console.error(e); }
    finally {
      setIsStreaming(false);
      setStreamBuffer("");
      await queryClient.invalidateQueries({ queryKey: getListGeminiMessagesQueryKey(activeId) });
      await queryClient.invalidateQueries({ queryKey: getGetGeminiConversationQueryKey(activeId) });
      if (capturedRagMeta) {
        setRagMetaMap((prev) => ({ ...prev, [tempMessages.length]: capturedRagMeta! }));
      }
      setPendingRagMeta(null);
    }
  };

  const assistantIndices = messages
    .map((m, i) => ({ role: m.role, i }))
    .filter((m) => m.role === "assistant" || m.role === "model")
    .map((m) => m.i);

  function renderConvoItem(c: Convo) {
    return (
      <ConvoItem
        key={c.id} c={c} active={activeId === c.id}
        onSelect={() => setActiveId(c.id)}
        onDelete={(e) => handleDeleteConvo(c.id, e)}
        onPin={(e) => handlePin(c.id, e)}
        onArchive={(e) => handleArchive(c.id, e)}
        onRename={(newTitle) => handleRename(c.id, newTitle)}
        deletePending={deleteConvo.isPending}
        pinPending={pinConvo.isPending}
        archivePending={archiveConvo.isPending}
      />
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border space-y-2">
          <Button onClick={handleCreateConvo} className="w-full justify-start" variant="outline" size="sm" disabled={createConvo.isPending}>
            {createConvo.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            New Chat
          </Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setSearchQuery(""); }}
              placeholder="Search messages…"
              className="w-full bg-background border border-input rounded-md pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {searchQuery ? (
            <div className="p-2 space-y-0.5">
              {searchFetching ? (
                <div className="flex items-center justify-center p-4 gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">No messages found for "{debouncedQuery}"</div>
              ) : (
                <>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                  </div>
                  {searchResults.map((r) => (
                    <button
                      key={r.messageId}
                      onClick={() => { setActiveId(r.conversationId); setSearchQuery(""); }}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors group"
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <MessageSquare className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                        <span className="text-xs font-medium text-foreground truncate">{r.conversationTitle}</span>
                        <span className="text-[10px] text-muted-foreground/50 shrink-0 ml-auto capitalize">{r.role}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 pl-4.5">
                        {highlightMatch(r.excerpt, debouncedQuery)}
                      </p>
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {loadingConvos ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  {/* Pinned */}
                  {pinned.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                        <Pin className="w-3 h-3" /> Pinned
                      </div>
                      {pinned.map(renderConvoItem)}
                      {(regular.length > 0 || archived.length > 0) && <div className="my-1 border-t border-border/50" />}
                    </>
                  )}

                  {/* Regular */}
                  {regular.map(renderConvoItem)}

                  {/* Archived toggle */}
                  {archived.length > 0 && (
                    <>
                      <div className="my-1 border-t border-border/50" />
                      <button
                        onClick={() => setShowArchived((v) => !v)}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider hover:text-muted-foreground transition-colors"
                      >
                        {showArchived ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        <Archive className="w-3 h-3" />
                        Archived ({archived.length})
                      </button>
                      {showArchived && archived.map(renderConvoItem)}
                    </>
                  )}

                  {typedConvos.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground">No conversations yet</div>
                  )}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-background">
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Bot className="w-10 h-10 opacity-20" />
            <p className="text-sm">Select or create a conversation</p>
            <Button variant="outline" size="sm" onClick={handleCreateConvo} disabled={createConvo.isPending}>
              <Plus className="w-4 h-4 mr-2" /> New Chat
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            {activeConvo && (() => {
              const convoMeta = typedConvos.find((c) => c.id === activeConvo.id);
              const typedMessages = messages as MsgRow[];
              return (
                <div className="h-12 px-4 border-b border-border flex items-center justify-between shrink-0">
                  <span className="text-sm font-medium truncate">{activeConvo.title}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-amber-400"
                      onClick={(e) => handlePin(activeConvo.id, e)} title={convoMeta?.pinned ? "Unpin" : "Pin"}>
                      {convoMeta?.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-blue-400"
                      onClick={(e) => handleArchive(activeConvo.id, e)} title={convoMeta?.archived ? "Unarchive" : "Archive"}>
                      {convoMeta?.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost" size="icon"
                          className="w-7 h-7 text-muted-foreground hover:text-foreground"
                          disabled={typedMessages.length === 0}
                          title="Export conversation"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => exportConversation(activeConvo.title, typedMessages, "md")}
                          className="gap-2 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Export as Markdown
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => exportConversation(activeConvo.title, typedMessages, "txt")}
                          className="gap-2 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Export as Plain Text
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })()}

            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-1 pb-4">
                {loadingMessages ? (
                  <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : (
                  messages.map((m, idx) => {
                    const isAssistant = m.role === "assistant" || m.role === "model";
                    const assistantOrder = assistantIndices.indexOf(idx);
                    const ragMeta = isAssistant && assistantOrder >= 0
                      ? ragMetaMap[messages.findIndex((_, i) => i === idx - 1) + 1] ?? ragMetaMap[idx]
                      : undefined;
                    return (
                      <div key={m.id} className="space-y-0.5">
                        {isAssistant && ragMeta && <RagContextBadge meta={ragMeta} />}
                        <div className={`flex gap-4 ${isAssistant ? "justify-start" : "justify-end"} mb-4`}>
                          {isAssistant && (
                            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center shrink-0">
                              <Bot className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div className={`px-4 py-3 rounded-lg max-w-[80%] text-sm whitespace-pre-wrap ${
                            isAssistant ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
                          }`}>
                            {m.content}
                          </div>
                          {!isAssistant && (
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                              <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                {isStreaming && (
                  <div className="space-y-0.5">
                    {pendingRagMeta && <RagContextBadge meta={pendingRagMeta} />}
                    {streamBuffer ? (
                      <div className="flex gap-4 justify-start mb-4">
                        <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center shrink-0">
                          <Bot className="w-5 h-5 text-primary" />
                        </div>
                        <div className="px-4 py-3 rounded-lg max-w-[80%] text-sm bg-muted text-foreground whitespace-pre-wrap">
                          {streamBuffer}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4 justify-start mb-4">
                        <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center shrink-0">
                          <Bot className="w-5 h-5 text-primary animate-pulse" />
                        </div>
                        <div className="px-4 py-3 rounded-lg text-sm bg-muted text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-border bg-card">
              <div className="max-w-3xl mx-auto relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Message Nexus..."
                  className="w-full bg-background border border-input rounded-md px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none h-[52px] max-h-32"
                  rows={1}
                />
                <Button
                  size="icon"
                  className="absolute right-2 top-[10px] h-8 w-8 rounded bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
