/**
 * CheckInPage Component
 * Main page for user check-in and verification system
 * Supports two methods: QR Code Scan and Name Search
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { QRScanner } from "../components/QRScanner";
import { UserVerificationPopup } from "../components/UserVerificationPopup";
import { SelfCheckInNotificationPopup, SelfCheckInNotification } from "../components/SelfCheckInNotificationPopup";
import { GymCheckInBarcodeDisplay } from "../components/GymCheckInBarcodeDisplay";
import { EventCheckInBarcodeDisplay } from "../components/EventCheckInBarcodeDisplay";
import { verifyUserCheckIn, searchUsersByName, CheckInResult } from "../api/checkin";
import { QrCode, Search, Loader2, Zap, ZapOff, MonitorSmartphone, CalendarCheck, Volume2, VolumeX } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useAudioFeedback, SoundProfile } from "@/hooks/useAudioFeedback";
import { supabase } from "@/integrations/supabase/client";
import { generateOnboardingAssessmentPdf } from "@/services/memberAssessmentReportService";

export function CheckInPage() {
  const { user } = useAuth();
  const { playSuccess, playError, ensureAudioResumed, profile, setProfile, soundEnabled, setSoundEnabled } = useAudioFeedback();
  const [verificationResult, setVerificationResult] = useState<CheckInResult | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // QR Code Scanner state
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<{
    status: "approved" | "rejected" | "verifying";
    message: string;
    overdueDays?: number;
  } | null>(null);

  // Name Search state
  const [nameSearchOpen, setNameSearchOpen] = useState(false);
  const [nameSearchQuery, setNameSearchQuery] = useState("");
  const [nameSearchResults, setNameSearchResults] = useState<Array<{ id: string; name: string; email: string | null; photoUrl: string | null }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [handsFreeMode, setHandsFreeMode] = useState(false);

  // Self-check-in notifications (when member scans gym/event barcode)
  const [selfCheckInNotification, setSelfCheckInNotification] = useState<SelfCheckInNotification | null>(null);
  const [selfCheckInPopupOpen, setSelfCheckInPopupOpen] = useState(false);
  const gymId = (user as any)?.gymId;

  // Realtime: admin sees popup when member scans gym/event barcode
  useEffect(() => {
    if (!gymId) return;

    const channel = supabase
      .channel("self-checkin-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "self_checkin_notifications",
          filter: `gym_id=eq.${gymId}`,
        },
        (payload) => {
          console.log("🔔 Realtime notification received:", payload);
          const row = payload.new as {
            id: string;
            user_id: string;
            member_name: string | null;
            success: boolean;
            reason: string;
            source: string;
          };
          // Ensure audio is ready then play exactly one sound: success or error
          ensureAudioResumed().then(() => {
            if (row.success) {
              playSuccess();
            } else {
              playError();
            }
          });
          setSelfCheckInNotification({
            id: row.id,
            user_id: row.user_id,
            member_name: row.member_name,
            success: row.success,
            reason: row.reason,
            source: row.source === "event" ? "event" : "gym",
          });
          setSelfCheckInPopupOpen(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gymId, playSuccess, playError, ensureAudioResumed]);

  // Debounced search for name search
  useEffect(() => {
    if (!nameSearchQuery || nameSearchQuery.length < 2) {
      setNameSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchUsersByName(nameSearchQuery);
        setNameSearchResults(results);
      } catch (error) {
        console.error("Error searching users:", error);
        setNameSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [nameSearchQuery]);

  const handleVerify = useCallback(async (identifier: string) => {
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || trimmedIdentifier.length === 0) {
      toast.error("Please provide a valid identifier");
      return;
    }

    console.log("🔍 Starting verification for:", trimmedIdentifier);
    setIsVerifying(true);
    setScanStatus({ status: "verifying", message: "Verifying member..." });

    try {
      const result = await verifyUserCheckIn(trimmedIdentifier);
      console.log("✅ Verification result:", result);
      setVerificationResult(result);

      // Update scan status for the QR overlay
      setScanStatus({
        status: result.status === "approved" ? "approved" : "rejected",
        message: result.reason,
        overdueDays: result.user.overdueDays
      });

      // In hands-free mode, we don't open the popup, only rely on the scanner overlay
      if (!handsFreeMode) {
        setIsPopupOpen(true);
      }

      // Show toast and play sound based on result
      if (result.status === "approved") {
        playSuccess();
        toast.success(`Access granted: ${result.user.fullName}`, {
          description: result.reason,
        });
      } else {
        playError();
        toast.error(`Access denied: ${result.user.fullName}`, {
          description: result.reason,
        });
      }
    } catch (error: any) {
      console.error("❌ Verification error:", error);
      playError();
      const errorMessage = error.message || "User not found or verification failed";

      setScanStatus({
        status: "rejected",
        message: errorMessage
      });

      toast.error("Verification failed", {
        description: errorMessage,
        duration: 5000,
      });
      // Still show popup with error if possible
      setVerificationResult(null);
    } finally {
      setIsVerifying(false);
      // NOTE: We no longer close the scanner/search immediately to allow for continuous/multiple scans
      // setQrScannerOpen(false);
      setNameSearchOpen(false);

      // Clear scan status after a delay so it disappears from the scanner
      setTimeout(() => {
        setScanStatus(null);
      }, 5000);
    }
  }, [playSuccess, playError]);

  // Handle QR Code scan: verify then play success or error sound only (no extra click sound)
  const handleQRScan = useCallback((qrCode: string) => {
    console.log("📷 QR Code scanned:", qrCode);
    handleVerify(qrCode);
  }, [handleVerify]);

  // Track active tab so we unmount the scanner when switching away (stops camera)
  const [scanTabValue, setScanTabValue] = useState("qr");

  // Handle Name Search selection
  const handleNameSelect = useCallback((userId: string) => {
    handleVerify(userId);
    setNameSearchQuery("");
    setNameSearchResults([]);
  }, [handleVerify]);

  const performSearch = useCallback(async () => {
    if (!nameSearchQuery || nameSearchQuery.length < 2) return;
    setIsSearching(true);
    try {
      const results = await searchUsersByName(nameSearchQuery);
      setNameSearchResults(results);
      if (results.length === 0) {
        toast.error("No members found with that name/ID");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [nameSearchQuery]);

  // Handle renew membership - send notification with payment link
  const handleRenewMembership = async () => {
    if (!verificationResult || !verificationResult.userId) {
      toast.error("Unable to send notification - user ID not found");
      return;
    }

    try {
      // Send notification to user with payment link
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: verificationResult.userId,
          message: `Please renew your membership to continue accessing the gym. Click here to make a payment.`,
          type: "payment",
          action_url: "/member/payments", // Link to payment section
          action_label: "Go to Payments"
        });

      if (notifError) {
        console.error("Error sending notification:", notifError);
        toast.error("Failed to send notification", {
          description: notifError.message || "An error occurred",
        });
      } else {
        toast.success("Notification sent", {
          description: `Payment link sent to ${verificationResult.user.fullName}`,
        });
      }
      setIsPopupOpen(false);
      setVerificationResult(null);
    } catch (error: any) {
      console.error("Renew membership error:", error);
      toast.error("Failed to send notification", {
        description: error.message || "An error occurred",
      });
    }
  };

  // Handle override access (admin only)
  const handleOverrideAccess = async () => {
    if (!verificationResult || !user || user.role !== "admin") {
      return;
    }

    try {
      // Log the override action (you might want to add an audit log table)
      toast.success("Access override granted", {
        description: `Override access granted to ${verificationResult.user.fullName}`,
      });
      setIsPopupOpen(false);
      setVerificationResult(null);
    } catch (error: any) {
      console.error("Override error:", error);
      toast.error("Failed to override access", {
        description: error.message || "An error occurred",
      });
    }
  };

  const handlePrintAssessment = async () => {
    if (!verificationResult?.userId) {
      toast.error("Unable to print assessment: member ID not found.");
      return;
    }

    try {
      await generateOnboardingAssessmentPdf(verificationResult.userId, user?.name || user?.email || "Admin");
      toast.success("Onboarding assessment generated.");
    } catch (error: any) {
      console.error("Failed to generate onboarding assessment:", error);
      toast.error(error?.message || "Failed to generate onboarding assessment.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Check-In & Verification</h1>
        <p className="text-muted-foreground mt-1">
          Verify gym members at the entrance using QR code or name search
        </p>
      </div>

      {/* Gym & Event Barcodes for Member Self-Check-in */}
      <Tabs defaultValue="gym-barcode" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="gym-barcode" className="flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4" />
            Gym QR Code
          </TabsTrigger>
          <TabsTrigger value="event-barcode" className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />
            Event QR Code
          </TabsTrigger>
        </TabsList>
        <TabsContent value="gym-barcode">
          <GymCheckInBarcodeDisplay />
        </TabsContent>
        <TabsContent value="event-barcode">
          <EventCheckInBarcodeDisplay />
        </TabsContent>
      </Tabs>

      {/* Two Input Methods Tabs */}
      <Tabs value={scanTabValue} onValueChange={setScanTabValue} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="qr">
            <QrCode className="h-4 w-4 mr-2" />
            QR Code Scan
          </TabsTrigger>
          <TabsTrigger value="name">
            <Search className="h-4 w-4 mr-2" />
            Name Search
          </TabsTrigger>
        </TabsList>

        {/* QR Code Scanner Tab */}
        <TabsContent value="qr" className="mt-6 space-y-4">
          <div className="flex items-center justify-end space-x-3 px-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-3 gap-2 rounded-full border-border bg-muted/50">
                  {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-xs font-semibold capitalize">{profile} Sound</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm">Scan sounds</h4>
                    <p className="text-xs text-muted-foreground">Click the page once to enable; choose a style below.</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sound-enabled" className="text-xs font-medium">Sound on</Label>
                    <Switch
                      id="sound-enabled"
                      checked={soundEnabled}
                      onCheckedChange={setSoundEnabled}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Style</p>
                    <div className="grid gap-1.5">
                      {([
                        { id: "modern" as SoundProfile, label: "Modern", desc: "Single soft beep" },
                        { id: "retro" as SoundProfile, label: "Retro", desc: "Two-tone classic" },
                        { id: "minimal" as SoundProfile, label: "Minimal", desc: "Short tick" },
                      ]).map(({ id, label, desc }) => (
                        <Button
                          key={id}
                          variant={profile === id ? "default" : "outline"}
                          size="sm"
                          className="justify-start h-auto py-2 text-xs font-medium"
                          onClick={() => {
                            setProfile(id);
                            if (soundEnabled) setTimeout(() => playSuccess(), 50);
                          }}
                        >
                          {profile === id && <Volume2 className="mr-2 h-3.5 w-3.5 shrink-0" />}
                          <span className="flex flex-col items-start">
                            <span>{label}</span>
                            <span className="text-[10px] font-normal opacity-70">{desc}</span>
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => { ensureAudioResumed().then((ok) => ok && playSuccess()); }}
                  >
                    Test sound
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border h-9">
                    {handsFreeMode ? <Zap className="h-4 w-4 text-yellow-500" /> : <ZapOff className="h-4 w-4 text-muted-foreground" />}
                    <Label htmlFor="hands-free" className="text-xs font-semibold cursor-pointer">Hands-free</Label>
                    <Switch
                      id="hands-free"
                      checked={handsFreeMode}
                      onCheckedChange={setHandsFreeMode}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px]">
                  When on, no popup after each scan—result shows on the scanner only. Good for rapid check-ins.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {scanTabValue === "qr" && (
            <QRScanner onScan={handleQRScan} onUnlockAudio={ensureAudioResumed} lastResult={scanStatus} />
          )}
        </TabsContent>

        {/* Name Search Tab */}
        <TabsContent value="name" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Name Search
              </CardTitle>
              <CardDescription>
                Search for a member by name to verify their status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Popover open={nameSearchOpen} onOpenChange={setNameSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={nameSearchOpen}
                    className="w-full justify-between"
                    disabled={isVerifying}
                  >
                    {nameSearchQuery || "Search by Name, ID, or Email..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[95vw] sm:w-[400px] p-0" align="start">
                  <Command shouldFilter={false} className="flex flex-col">
                    <div className="flex items-center border-b px-3 relative">
                      <CommandInput
                        placeholder="Search by Name, ID, or Email..."
                        value={nameSearchQuery}
                        onValueChange={setNameSearchQuery}
                        className="flex-1"
                        onKeyDown={(e: any) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            performSearch();
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 ml-1"
                        onClick={(e) => {
                          e.preventDefault();
                          performSearch();
                        }}
                      >
                        Search
                      </Button>
                      {isSearching && (
                        <div className="absolute right-[70px] top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CommandList>
                      {isSearching && (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                      {!isSearching && nameSearchResults.length === 0 && nameSearchQuery.length >= 2 && (
                        <CommandEmpty>No members found.</CommandEmpty>
                      )}
                      {!isSearching && nameSearchQuery.length < 2 && (
                        <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
                      )}
                      {!isSearching && nameSearchResults.length > 0 && (
                        <CommandGroup>
                          {nameSearchResults.map((member) => (
                            <CommandItem
                              key={member.id}
                              value={member.id}
                              onSelect={() => handleNameSelect(member.id)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={member.photoUrl || undefined} />
                                  <AvatarFallback>
                                    {member.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium">{member.name}</div>
                                    {(member as any).unique_id && (
                                      <Badge variant="secondary" className="text-[10px] h-4">
                                        {(member as any).unique_id}
                                      </Badge>
                                    )}
                                  </div>
                                  {member.email && (
                                    <div className="text-xs text-muted-foreground">
                                      {member.email}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Start typing a member's name to see real-time search results. Click on a result to verify.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Verification Result Popup */}
      <UserVerificationPopup
        open={isPopupOpen}
        onOpenChange={(open) => {
          setIsPopupOpen(open);
        }}
        result={verificationResult}
        onRenewMembership={handleRenewMembership}
        onOverrideAccess={handleOverrideAccess}
        onPrintAssessment={handlePrintAssessment}
      />

      {/* Self-check-in notification popup (member scanned gym/event barcode) */}
      <SelfCheckInNotificationPopup
        open={selfCheckInPopupOpen}
        onOpenChange={setSelfCheckInPopupOpen}
        notification={selfCheckInNotification}
      />
    </div>
  );
}

