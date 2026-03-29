/**
 * SelfCheckInNotificationPopup
 * Shows admin a popup when a member scans the gym/event barcode (valid or invalid)
 * Redesigned with generous padding, membership details (days left, renewal date), and polished layout
 */

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, User, Calendar, Clock, Dumbbell, CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { verifyMemberHasAccess } from "@/services/attendanceService";
import { generateOnboardingAssessmentPdf } from "@/services/memberAssessmentReportService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface SelfCheckInNotification {
  id: string;
  user_id?: string;
  member_name: string | null;
  success: boolean;
  reason: string;
  source: "gym" | "event";
}

interface SelfCheckInNotificationPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: SelfCheckInNotification | null;
}

export function SelfCheckInNotificationPopup({
  open,
  onOpenChange,
  notification,
}: SelfCheckInNotificationPopupProps) {
  const { user } = useAuth();
  const [memberDetails, setMemberDetails] = useState<{
    membershipStatus?: string | null;
    renewalDueDate?: string | null;
    daysRemaining?: number | null;
  } | null>(null);

  // Fetch member details when popup opens (success case with user_id)
  useEffect(() => {
    if (!open || !notification?.success || !notification.user_id) {
      setMemberDetails(null);
      return;
    }
    let cancelled = false;
    verifyMemberHasAccess(notification.user_id).then((data) => {
      if (!cancelled) {
        setMemberDetails({
          membershipStatus: data.membershipStatus,
          renewalDueDate: data.renewalDueDate,
          daysRemaining: data.daysRemaining,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, notification?.id, notification?.success, notification?.user_id]);

  if (!notification) return null;

  const isSuccess = notification.success;
  const sourceLabel = notification.source === "event" ? "Event Check-In" : "Gym Check-In";

  const daysText =
    memberDetails?.daysRemaining != null
      ? memberDetails.daysRemaining === 0
        ? "Renews today"
        : memberDetails.daysRemaining === 1
          ? "1 day left"
          : `${memberDetails.daysRemaining} days left`
      : null;

  const dueDateText = memberDetails?.renewalDueDate
    ? format(new Date(memberDetails.renewalDueDate), "MMM d, yyyy")
    : null;

  const statusLabel = memberDetails?.membershipStatus
    ? String(memberDetails.membershipStatus).charAt(0).toUpperCase() +
      String(memberDetails.membershipStatus).slice(1).toLowerCase()
    : null;

  const handlePrintAssessment = async () => {
    if (!notification?.user_id) {
      toast.error("Unable to print assessment: member ID unavailable.");
      return;
    }
    try {
      await generateOnboardingAssessmentPdf(notification.user_id, user?.name || user?.email || "Admin");
      toast.success("Onboarding assessment generated.");
    } catch (error: any) {
      console.error("Failed to generate onboarding assessment:", error);
      toast.error(error?.message || "Failed to generate onboarding assessment.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-md w-[calc(100vw-32px)] sm:w-full p-0 gap-0 overflow-hidden ${
          isSuccess
            ? "border-2 border-green-500/80 dark:border-green-600/80 shadow-lg shadow-green-500/10"
            : "border-2 border-red-500/80 dark:border-red-600/80 shadow-lg shadow-red-500/10"
        }`}
      >
        {/* Header with generous padding (pr-12 for close button) */}
        <DialogHeader className="px-6 pt-6 pb-4 pr-12">
          <DialogTitle className="flex items-center gap-3 text-xl">
            {isSuccess ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
            )}
            <span>{isSuccess ? "Member Checked In" : "Scan Failed"}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Content with generous padding */}
        <div className="px-6 pb-6 space-y-5">
          {/* Member info card */}
          <div
            className={`rounded-xl p-5 ${
              isSuccess
                ? "bg-green-50/80 dark:bg-green-950/20 border border-green-200/60 dark:border-green-800/40"
                : "bg-red-50/80 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/80">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-base">
                  {notification.member_name || "Member"}
                </p>
                <p
                  className={`text-sm font-medium ${
                    isSuccess
                      ? "text-green-700 dark:text-green-300"
                      : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {notification.reason}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {notification.source === "event" ? (
                <CalendarCheck className="h-4 w-4 shrink-0" />
              ) : (
                <Dumbbell className="h-4 w-4 shrink-0" />
              )}
              <span className="capitalize">{sourceLabel}</span>
            </div>
          </div>

          {/* Membership details (success only, when we have data) */}
          {isSuccess && (daysText || dueDateText || statusLabel) && (
            <div className="rounded-xl border bg-muted/30 dark:bg-muted/10 p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Membership
              </p>
              <div className="space-y-3">
                {statusLabel && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4 shrink-0" />
                      <span>Status</span>
                    </div>
                    <span className="text-sm font-medium">{statusLabel}</span>
                  </div>
                )}
                {daysText && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>Access</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {daysText}
                    </span>
                  </div>
                )}
                {dueDateText && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span>Renewal due</span>
                    </div>
                    <span className="text-sm font-medium">{dueDateText}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {isSuccess && notification.user_id && (
            <Button className="w-full" onClick={handlePrintAssessment}>
              Print Onboarding Assessment
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
