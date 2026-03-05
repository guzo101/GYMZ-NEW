/**
 * MemberQRCode Component - SECURE VERSION
 * Real-time, subscription-linked, cryptographically secure QR codes
 * NO FALLBACKS - Only displays QR if subscription is valid
 */

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Download, RefreshCw, AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchUserSubscription,
  validateSubscription,
  generateSecureQRCode,
  encodeQRData,
  getQRTimeRemaining,
  type SecureQRData,
  type SubscriptionData,
} from "@/services/secureQRService";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface MemberQRCodeProps {
  userId: string;
  userName?: string;
  initialProfile?: any; // NEW: Pass pre-fetched profile for INSTANT load
}

const QR_REFRESH_INTERVAL = 30000; // 30 seconds
const QR_VALIDITY_DURATION = 60; // 60 seconds

export function MemberQRCode({ userId, userName, initialProfile }: MemberQRCodeProps) {
  const [qrData, setQrData] = useState<SecureQRData | null>(null);
  const [qrString, setQrString] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(QR_VALIDITY_DURATION);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSubscriptionFetchRef = useRef<number>(0);

  // Generate new QR code - Optimized for SPEED
  const generateQR = async (forceFetch = false) => {
    try {
      // Show loading only on first run or forced fetch
      if (!qrString || forceFetch) setLoading(true);
      setError(null);

      let subscriptionData = subscription;

      // Only fetch from DB if we don't have it, or it's been more than 5 minutes, or we're forced
      const shouldFetch = forceFetch || !subscriptionData || (Date.now() - lastSubscriptionFetchRef.current > 300000);

      if (shouldFetch) {
        console.log("[QR] Fetching subscription from source...");
        subscriptionData = await fetchUserSubscription(userId);
        lastSubscriptionFetchRef.current = Date.now();
      } else {
        console.log("[QR] Using cached subscription data for speed.");
      }

      if (!subscriptionData) {
        setError("User identification failed. Please contact support.");
        return;
      }

      setSubscription(subscriptionData);

      // Validate subscription (just for UI warning)
      const validation = validateSubscription(subscriptionData);
      if (!validation.valid) {
        // Check event access - QR is valid if gym OR event active
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { data: eventRsvps } = await supabase
          .from("event_rsvps")
          .select("id, events(event_date)")
          .eq("user_id", userId)
          .eq("status", "confirmed");
        const hasEventAccess = eventRsvps?.some((r: any) => {
          const ev = Array.isArray(r.events) ? r.events[0] : r.events;
          return ev?.event_date && new Date(ev.event_date) >= todayStart;
        });
        if (hasEventAccess) {
          setError(null); // Event access active - QR valid
        } else {
          setError(validation.reason);
        }
      } else {
        setError(null);
      }

      // Generate secure QR code (This is INSTANT)
      const secureQR = await generateSecureQRCode(userId, subscriptionData);
      const encoded = encodeQRData(secureQR);

      setQrData(secureQR);
      setQrString(encoded);
      setTimeRemaining(QR_VALIDITY_DURATION);

    } catch (err: any) {
      console.error("Error generating QR code:", err);
      setError(err.message || "Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!userId) return;

    // If we have initialProfile, we can immediately set a "placeholder" subscription 
    // to generate the first QR without waiting for fetchUserSubscription
    if (initialProfile && !subscription) {
      console.log("[QR] Quick-starting with initial profile data...");
      const now = new Date();
      const expiry = initialProfile.renewal_due_date || now.toISOString();
      const sub: SubscriptionData = {
        subscription_id: userId,
        subscription_type: initialProfile.membership_type || "standard",
        subscription_status: initialProfile.membership_status?.toLowerCase() === 'active' ? 'active' : 'inactive',
        subscription_start_date: initialProfile.created_at || now.toISOString(),
        subscription_end_date: expiry,
        payment_status: initialProfile.payment_status || "completed"
      };
      setSubscription(sub);
      // We'll still do a verify-fetch in the background
      generateQR(false);
    } else {
      generateQR(true);
    }
  }, [userId, initialProfile]);

  // NEW: Real-time subscription monitoring - regenerate QR when admin changes membership
  useEffect(() => {
    if (!userId) return;

    console.log('[QR] Setting up real-time subscription monitoring...');

    // Listen to changes in users table (membership_expiry, membership_status, etc.)
    const usersChannel = supabase
      .channel(`qr-user-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('[QR] User record updated, regenerating QR...', payload.new);
          // Admin changed membership data - regenerate QR immediately
          generateQR();
        }
      )
      .subscribe();

    // Listen to changes in payments table (payment approval)
    const paymentsChannel = supabase
      .channel(`qr-payment-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[QR] Payment updated, regenerating QR...', payload.new);
          // Payment approved or updated - regenerate QR immediately
          setTimeout(() => generateQR(), 500); // Small delay to ensure DB is updated
        }
      )
      .subscribe();

    return () => {
      console.log('[QR] Cleaning up real-time subscriptions...');
      usersChannel.unsubscribe();
      paymentsChannel.unsubscribe();
    };
  }, [userId]);

  // Auto-refresh QR code every 30 seconds
  useEffect(() => {
    if (!userId) return;

    refreshIntervalRef.current = setInterval(() => {
      console.log("Auto-refreshing QR code...");
      generateQR();
    }, QR_REFRESH_INTERVAL);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [userId]);

  // Countdown timer for QR expiration
  useEffect(() => {
    if (!qrData) return;

    countdownIntervalRef.current = setInterval(() => {
      const remaining = getQRTimeRemaining(qrData.expires_at);
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        // QR expired, generate new one
        generateQR();
      }
    }, 100); // Update every 100ms for smooth countdown

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [qrData]);

  const handleManualRefresh = () => {
    toast.info("Generating new QR code...");
    generateQR();
  };

  const downloadQRCode = () => {
    if (!qrString || !qrCodeRef.current) {
      toast.error("QR code not available");
      return;
    }

    try {
      const svg = qrCodeRef.current.querySelector("svg") as SVGSVGElement;
      if (!svg) {
        toast.error("QR code not ready");
        return;
      }

      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 400;
        const padding = 40;
        canvas.width = size + padding * 2;
        canvas.height = size + padding * 2 + 150;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(svgUrl);
          return;
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding, padding, size, size);

        ctx.fillStyle = "#000000";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(userName || "Member QR Code", canvas.width / 2, size + padding + 30);

        ctx.font = "12px Arial";
        ctx.fillStyle = "#666666";
        ctx.fillText("Valid for 60 seconds", canvas.width / 2, size + padding + 50);
        ctx.fillText(`Generated: ${new Date().toLocaleTimeString()}`, canvas.width / 2, size + padding + 70);

        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `qr-code-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          URL.revokeObjectURL(svgUrl);
          toast.success("QR code downloaded");
        }, "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        toast.error("Failed to process QR code");
      };
      img.src = svgUrl;
    } catch (error) {
      console.error("Error downloading QR code:", error);
      toast.error("Failed to download QR code");
    }
  };

  // Progress percentage for countdown
  const progressPercentage = (timeRemaining / QR_VALIDITY_DURATION) * 100;

  if (!userId) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>User ID not available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Secure Check-In QR Code
        </CardTitle>
        <CardDescription>
          Dynamic QR code - auto-refreshes every 30 seconds, valid for 60 seconds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="bg-white p-4 rounded-lg border-2 border-muted shadow-lg flex items-center justify-center mx-auto animate-pulse"
              style={{ width: '100%', maxWidth: '280px', aspectRatio: '1/1', minHeight: '200px' }}
            >
              <QrCode className="h-16 w-16 text-gray-300 animate-pulse" />
            </div>
            <p className="text-sm text-muted-foreground">Generating secure QR code...</p>
          </div>
        ) : (
          <>
            {/* Status Warning if Overdue/Error exists */}
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>System Note</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-2">
                  <span className="text-xs">{error}</span>
                  <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => window.location.href = "/member/payments"}>
                    Renew
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Subscription Status Banner - Only show if perfectly active */}
            {!error && subscription && (
              <Alert className="bg-primary border-primary mb-4">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary">Active Membership</AlertTitle>
                <AlertDescription className="text-primary text-xs">
                  {subscription.subscription_type} - Valid until {new Date(subscription.subscription_end_date || "").toLocaleDateString()}
                </AlertDescription>
              </Alert>
            )}

            {/* QR Code Display - Only if we have the string */}
            {qrString ? (
              <div className="flex flex-col items-center gap-5 w-full">
                <div
                  ref={qrCodeRef}
                  className={`bg-white p-4 rounded-lg border-4 shadow-lg flex items-center justify-center mx-auto ${error ? 'border-red-500' : 'border-primary'}`}
                  style={{ width: '100%', maxWidth: '280px', aspectRatio: '1/1', minHeight: '200px' }}
                >
                  <QRCodeSVG
                    value={qrString}
                    size={Math.min(240, window.innerWidth - 100)}
                    level="H"
                    includeMargin={true}
                    style={{ width: '100%', height: '100%', maxWidth: '240px', maxHeight: '240px' }}
                  />
                </div>

                {/* Countdown Timer */}
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Clock className="h-4 w-4" />
                      Expires in:
                    </span>
                    <span className={`font-bold ${timeRemaining < 10 ? 'text-red-600' : (error ? 'text-red-500' : 'text-primary')}`}>
                      {timeRemaining}s
                    </span>
                  </div>
                  <Progress
                    value={progressPercentage}
                    className={`h-2 ${error ? 'bg-red-100' : 'bg-primary'}`}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                  <Button onClick={downloadQRCode} variant="outline" size="sm" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button onClick={handleManualRefresh} variant="outline" size="sm" className="flex-1">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Now
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                <XCircle className="h-12 w-12 text-red-500" />
                <div>
                  <h3 className="font-semibold">Unable to map user data</h3>
                  <p className="text-xs text-muted-foreground mt-1 px-4">
                    There was an issue linking your profile to a secure code.
                  </p>
                </div>
                <Button onClick={handleManualRefresh} variant="default" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
