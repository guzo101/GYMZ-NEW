import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Settings as SettingsIcon,
  Palette,
  Globe,
  Bell,
  Moon,
  Sun,
  Volume2,
  Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserPreferences {
  iconStyle?: string;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  notificationSounds?: boolean;
}

// ── SANITIZATION LAYER (Absolute Harmony Standard) ─────────────────────────
const mapPreferences = (data: any): UserPreferences => ({
  iconStyle: data.icon_style || 'default',
  theme: data.theme || 'system',
  language: data.language || 'en',
  notificationSounds: data.notification_sounds !== undefined ? data.notification_sounds : true,
});

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    iconStyle: 'default',
    theme: 'system',
    language: 'en',
    notificationSounds: true,
  });

  useEffect(() => {
    fetchPreferences();
    // Apply theme on mount
    const savedPrefs = localStorage.getItem('user_preferences');
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        if (prefs.theme) {
          applyTheme(prefs.theme);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Try localStorage as fallback
        const savedPrefs = localStorage.getItem('user_preferences');
        if (savedPrefs) {
          try {
            const prefs = JSON.parse(savedPrefs);
            setPreferences((prev) => ({ ...prev, ...prefs }));
          } catch (e) {
            // Ignore parse errors
          }
        }
        setLoading(false);
        return;
      }

      // Try to fetch from user preferences table, or use defaults
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.warn("Preferences table may not exist:", error);
        // Try localStorage as fallback
        const savedPrefs = localStorage.getItem('user_preferences');
        if (savedPrefs) {
          try {
            const prefs = JSON.parse(savedPrefs);
            setPreferences((prev) => ({ ...prev, ...prefs }));
          } catch (e) {
            // Ignore parse errors
          }
        }
      } else if (data) {
        const sanitized = mapPreferences(data);
        setPreferences((prev) => ({ ...prev, ...sanitized }));
        if (sanitized.theme) {
          applyTheme(sanitized.theme);
        }
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
      // Try localStorage as fallback
      const savedPrefs = localStorage.getItem('user_preferences');
      if (savedPrefs) {
        try {
          const prefs = JSON.parse(savedPrefs);
          setPreferences((prev) => ({ ...prev, ...prefs }));
          if (prefs.theme) {
            applyTheme(prefs.theme);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();

      // Always save to localStorage as backup
      localStorage.setItem('user_preferences', JSON.stringify(preferences));

      if (!user) {
        toast.success("Preferences saved locally");
        return;
      }

      const { error } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: user.id,
            icon_style: preferences.iconStyle,
            theme: preferences.theme,
            language: preferences.language,
            notification_sounds: preferences.notificationSounds,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) {
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          // Table doesn't exist, already saved to localStorage
          toast.success("Preferences saved locally");
        } else {
          throw error;
        }
      } else {
        toast.success("Preferences saved successfully!");
      }
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      // Already saved to localStorage, so just notify
      toast.success("Preferences saved locally");
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof UserPreferences, value: any) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      // Auto-save on change
      setTimeout(() => {
        savePreferences();
      }, 300);
      return updated;
    });
  };

  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updatePreference('theme', theme);
    applyTheme(theme);
  };

  const playTestSound = () => {
    // Create a simple notification sound
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error("Error playing test sound:", error);
      toast.error("Could not play test sound");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <SettingsIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Customize your experience
        </p>
      </div>

      {/* Settings Cards */}
      <div className="grid gap-6">
        {/* Icon Style */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Icon Style
            </CardTitle>
            <CardDescription>
              Choose your preferred icon style
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="icon-style" className="text-base">
                  Icon Style
                </Label>
                <p className="text-sm text-muted-foreground">
                  Select how icons appear throughout the app
                </p>
              </div>
              <Select
                value={preferences.iconStyle || 'default'}
                onValueChange={(value) => updatePreference('iconStyle', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                  <SelectItem value="filled">Filled</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Theme */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Theme
            </CardTitle>
            <CardDescription>
              Choose your preferred color theme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="theme" className="text-base">
                  Color Theme
                </Label>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark mode
                </p>
              </div>
              <Select
                value={preferences.theme || 'system'}
                onValueChange={(value) => handleThemeChange(value as 'light' | 'dark' | 'system')}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <SettingsIcon className="h-4 w-4" />
                      System
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Language
            </CardTitle>
            <CardDescription>
              Select your preferred language
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="language" className="text-base">
                  Language
                </Label>
                <p className="text-sm text-muted-foreground">
                  Choose the language for the interface
                </p>
              </div>
              <Select
                value={preferences.language || 'en'}
                onValueChange={(value) => updatePreference('language', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notification Sounds */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Sounds
            </CardTitle>
            <CardDescription>
              Control audio notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="notification-sounds" className="text-base">
                  Enable Notification Sounds
                </Label>
                <p className="text-sm text-muted-foreground">
                  Play sounds when notifications arrive
                </p>
              </div>
              <div className="flex items-center gap-3">
                {preferences.notificationSounds && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={playTestSound}
                    className="gap-2"
                  >
                    <Volume2 className="h-4 w-4" />
                    Test Sound
                  </Button>
                )}
                <Switch
                  id="notification-sounds"
                  checked={preferences.notificationSounds !== false}
                  onCheckedChange={(checked) => updatePreference('notificationSounds', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={savePreferences}
          disabled={saving}
          className="min-w-[120px]"
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
