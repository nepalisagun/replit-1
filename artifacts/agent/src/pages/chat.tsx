import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Plus, Bot, User, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  useListGeminiConversations, 
  useCreateGeminiConversation,
  useDeleteGeminiConversation,
  useGetGeminiConversation,
  useListGeminiMessages,
  getListGeminiMessagesQueryKey,
  getGetGeminiConversationQueryKey,
  getListGeminiConversationsQueryKey
} from "@workspace/api-client-react";

export default function ChatPage() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: loadingConvos } = useListGeminiConversations();
  const createConvo = useCreateGeminiConversation();
  const deleteConvo = useDeleteGeminiConversation();
  
  // Use useGetGeminiConversation to fetch conversation details
  const { data: activeConvo } = useGetGeminiConversation(
    activeId as number,
    { query: { enabled: !!activeId, queryKey: getGetGeminiConversationQueryKey(activeId as number) } }
  );

  const { data: messages = [], isLoading: loadingMessages } = useListGeminiMessages(
    activeId as number,
    { query: { enabled: !!activeId, queryKey: getListGeminiMessagesQueryKey(activeId as number) } }
  );

  useEffect(() => {
    if (conversations?.length && !activeId) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBuffer]);

  const handleCreateConvo = () => {
    createConvo.mutate({ data: { title: "New Conversation" } }, {
      onSuccess: (convo) => {
        setActiveId(convo.id);
        queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
      }
    });
  };

  const handleDeleteConvo = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConvo.mutate({ id }, {
      onSuccess: () => {
        if (activeId === id) setActiveId(null);
        queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
      }
    });
  };

  const handleSend = async () => {
    if (!input.trim() || !activeId || isStreaming) return;
    
    const userMessage = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamBuffer("");

    // Optimistically show user message
    const tempMessages = [...messages, { id: -1, conversationId: activeId, role: "user", content: userMessage, createdAt: new Date().toISOString() }];
    queryClient.setQueryData(getListGeminiMessagesQueryKey(activeId), tempMessages);

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
            if (json.content) {
              setStreamBuffer((prev) => prev + json.content);
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsStreaming(false);
      setStreamBuffer("");
      queryClient.invalidateQueries({ queryKey: getListGeminiMessagesQueryKey(activeId) });
      queryClient.invalidateQueries({ queryKey: getGetGeminiConversationQueryKey(activeId) });
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <Button onClick={handleCreateConvo} className="w-full justify-start" variant="outline" disabled={createConvo.isPending}>
            {createConvo.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingConvos ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : conversations?.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer group flex items-center justify-between ${
                  activeId === c.id ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="truncate flex-1">{c.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => handleDeleteConvo(c.id, e)}
                  disabled={deleteConvo.isPending}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col bg-background">
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select or create a conversation
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-6 pb-4">
                {loadingMessages ? (
                  <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.role === 'model' && (
                        <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center shrink-0">
                          <Bot className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div className={`px-4 py-3 rounded-lg max-w-[80%] text-sm ${
                        m.role === 'user' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-foreground'
                      }`}>
                        {m.content}
                      </div>
                      {m.role === 'user' && (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                {isStreaming && streamBuffer && (
                  <div className="flex gap-4 justify-start">
                    <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div className="px-4 py-3 rounded-lg max-w-[80%] text-sm bg-muted text-foreground whitespace-pre-wrap">
                      {streamBuffer}
                    </div>
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Message Nexus Agent..."
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
