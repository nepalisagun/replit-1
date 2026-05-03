import { useState, useEffect } from "react";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { Loader2, Save, RotateCcw, BrainCircuit, Globe, Zap, Clock, User, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai",
  "Asia/Kolkata", "Australia/Sydney",
];

export default function SettingsPage() {
  const { data: settings, isLoading } = useGetSettings();
  const { mutateAsync: save, isPending: saving } = useUpdateSettings();
  const { toast } = useToast();

  const [form, setForm] = useState({
    agentName: "",
    persona: "",
    defaultModel: "gemini-2.5-flash",
    memoryEnabled: true,
    webSearchEnabled: true,
    reflectionEnabled: true,
    maxContextMessages: 20,
    timezone: "UTC",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        agentName: settings.agentName,
        persona: settings.persona,
        defaultModel: settings.defaultModel,
        memoryEnabled: settings.memoryEnabled,
        webSearchEnabled: settings.webSearchEnabled,
        reflectionEnabled: settings.reflectionEnabled,
        maxContextMessages: settings.maxContextMessages,
        timezone: settings.timezone,
      });
      setDirty(false);
    }
  }, [settings]);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  function reset() {
    if (!settings) return;
    setForm({
      agentName: settings.agentName,
      persona: settings.persona,
      defaultModel: settings.defaultModel,
      memoryEnabled: settings.memoryEnabled,
      webSearchEnabled: settings.webSearchEnabled,
      reflectionEnabled: settings.reflectionEnabled,
      maxContextMessages: settings.maxContextMessages,
      timezone: settings.timezone,
    });
    setDirty(false);
  }

  async function handleSave() {
    try {
      await save({ data: form });
      setDirty(false);
      toast({ title: "Settings saved", description: "Your agent configuration has been updated." });
    } catch {
      toast({ title: "Save failed", description: "Could not save settings. Please try again.", variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto max-w-3xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure your agent's identity and behavior.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset} disabled={!dirty || saving}>
            <RotateCcw className="w-3.5 h-3.5 mr-2" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Identity */}
      <Card className="bg-card border-border shadow-none">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Identity
          </CardTitle>
          <CardDescription className="text-xs">How your agent introduces and presents itself.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="agentName" className="text-xs font-medium">Agent Name</Label>
            <Input
              id="agentName"
              value={form.agentName}
              onChange={(e) => set("agentName", e.target.value)}
              placeholder="Nexus"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="persona" className="text-xs font-medium">Persona / System Prompt</Label>
            <Textarea
              id="persona"
              value={form.persona}
              onChange={(e) => set("persona", e.target.value)}
              rows={5}
              className="text-sm resize-none"
              placeholder="Describe how your agent should behave..."
            />
            <p className="text-xs text-muted-foreground">This is injected as the system prompt for every conversation.</p>
          </div>
        </CardContent>
      </Card>

      {/* Chat */}
      <Card className="bg-card border-border shadow-none">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Chat
          </CardTitle>
          <CardDescription className="text-xs">Model and context window settings.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="maxContext" className="text-xs font-medium">Max Context Messages</Label>
            <Input
              id="maxContext"
              type="number"
              min={5}
              max={100}
              value={form.maxContextMessages}
              onChange={(e) => set("maxContextMessages", parseInt(e.target.value) || 20)}
              className="h-8 text-sm w-32"
            />
            <p className="text-xs text-muted-foreground">How many recent messages to send as context per request.</p>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card className="bg-card border-border shadow-none">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Features
          </CardTitle>
          <CardDescription className="text-xs">Enable or disable agent capabilities.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <ToggleRow
            id="memory"
            label="Memory"
            description="Store and recall facts, preferences, and lessons from conversations."
            icon={BrainCircuit}
            checked={form.memoryEnabled}
            onCheckedChange={(v) => set("memoryEnabled", v)}
          />
          <ToggleRow
            id="search"
            label="Web Search"
            description="Verify information using real-time multi-source web search."
            icon={Globe}
            checked={form.webSearchEnabled}
            onCheckedChange={(v) => set("webSearchEnabled", v)}
          />
          <ToggleRow
            id="reflect"
            label="Reflection"
            description="Periodically analyse conversations to extract and store new memories."
            icon={Zap}
            checked={form.reflectionEnabled}
            onCheckedChange={(v) => set("reflectionEnabled", v)}
          />
        </CardContent>
      </Card>

      {/* Locale */}
      <Card className="bg-card border-border shadow-none">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Locale
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="timezone" className="text-xs font-medium">Timezone</Label>
            <select
              id="timezone"
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              className="flex h-8 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <div className="bg-card border border-border rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg">
            <span className="text-xs text-muted-foreground">You have unsaved changes</span>
            <Button size="sm" variant="outline" onClick={reset} disabled={saving}>Reset</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  id, label, description, icon: Icon, checked, onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-medium cursor-pointer">{label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
