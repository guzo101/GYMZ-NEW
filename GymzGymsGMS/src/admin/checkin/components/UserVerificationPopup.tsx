/**
 * UserVerificationPopup Component
 * Displays user verification result with color-coded status
 */

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckInResult } from "../api/checkin";
import { Calendar, User, Crown, X, CheckCircle2, AlertTriangle, Clock, Shield, RefreshCw, Dumbbell, CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface UserVerificationPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: CheckInResult | null;
  onRenewMembership?: () => void;
  onOverrideAccess?: () => void;
}

export function UserVerificationPopup({
  open,
  onOpenChange,
  result,
  onRenewMembership,
  onOverrideAccess,
}: UserVerificationPopupProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  if (!result) return null;

  const getStatusStyles = () => {
    switch (result.color) {
      case "green":
        return "bg-green-50 dark:bg-green-950/20 border-primary";
      case "yellow":
        return "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500";
      case "red":
        return "bg-red-50 dark:bg-red-950/20 border-red-500";
      case "grey":
        return "bg-gray-50 dark:bg-gray-950/20 border-gray-500";
      default:
        return "bg-gray-50 dark:bg-gray-950/20 border-gray-500";
    }
  };

  const getStatusIcon = () => {
    if (result.status === "approved") {
      if (result.color === "yellow") {
        return <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />;
      }
      return <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />;
    }
    return <X className="h-6 w-6 text-red-600 dark:text-red-400" />;
  };

  const handleRenewMembership = () => {
    if (onRenewMembership) {
      onRenewMembership();
    } else {
      navigate("/members");
    }
    onOpenChange(false);
  };

  const handleOverrideAccess = () => {
    if (onOverrideAccess) {
      onOverrideAccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {getStatusIcon()}
            {result.status === "approved" ? "Access Approved" : "Access Denied"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {result.status === "approved"
              ? "Member verification successful"
              : "Member verification failed"}
          </DialogDescription>
        </DialogHeader>

        <div className={`rounded-lg border-2 p-4 flex-1 overflow-y-auto ${getStatusStyles()}`}>
          {/* User Photo and Name */}
          <div className="flex flex-col items-center gap-3 mb-4">
            <Avatar className="h-20 w-20 border-3 border-background shadow-lg">
              <AvatarImage src={result.user.photoUrl || undefined} alt={result.user.fullName} />
              <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                {result.user.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h3 className="text-lg font-bold">{result.user.fullName}</h3>
              {result.user.membershipPlan && (
                <Badge variant="outline" className="mt-1 text-xs">
                  <Crown className="h-3 w-3 mr-1" />
                  {result.user.membershipPlan}
                </Badge>
              )}
            </div>
          </div>

          {/* Status Reason - Bold and Prominent */}
          <div className="text-center mb-4">
            <p
              className={`text-base font-bold leading-tight ${
                result.status === "approved"
                  ? result.color === "yellow"
                    ? "text-yellow-700 dark:text-yellow-400"
                    : "text-green-700 dark:text-green-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {result.reason}
            </p>
          </div>

          {/* Already checked in today */}
          {result.alreadyCheckedInToday && result.checkInTimeToday && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Already checked in today at {format(new Date(result.checkInTimeToday), "h:mm a")}
                </span>
              </div>
            </div>
          )}

          {/* Gym & Event Access Status (when available from unified QR) */}
          {(result.gymAccess || result.eventAccess) && (
            <div className="space-y-2 bg-background/50 rounded-lg p-3 mb-3">
              {result.gymAccess && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Gym Access</span>
                  </div>
                  <span className={`text-xs font-medium ${result.gymAccess.active ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                    {result.gymAccess.label}
                    {result.gymAccess.detail && ` (${result.gymAccess.detail})`}
                  </span>
                </div>
              )}
              {result.eventAccess && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Event Access</span>
                  </div>
                  <span className={`text-xs font-medium ${result.eventAccess.active ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                    {result.eventAccess.label}
                    {result.eventAccess.detail && ` - ${result.eventAccess.detail}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Membership Details */}
          {(result.user.expiryDate || result.user.daysLeft > 0 || result.user.overdueDays > 0) && (
            <div className="space-y-2 bg-background/50 rounded-lg p-3 mb-3">
              {result.user.expiryDate && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Expiry Date</span>
                  </div>
                  <span className="text-xs font-medium">
                    {format(new Date(result.user.expiryDate), "MMM dd, yyyy")}
                  </span>
                </div>
              )}

              {result.user.daysLeft > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Days Left</span>
                  </div>
                  <span className="text-xs font-medium">{result.user.daysLeft} days</span>
                </div>
              )}

              {result.user.overdueDays > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                    <span>Overdue Days</span>
                  </div>
                  <span className="text-xs font-medium text-red-600">
                    {result.user.overdueDays} days
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Rejection Details - Only show if status is rejected and reason is different from main message */}
          {result.status === "rejected" && (
            <div className="p-2.5 bg-red-100 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-900 dark:text-red-200">
                    Access Denied
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2 pt-3 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:flex-1 text-sm py-2"
          >
            Close
          </Button>

          {result.status === "rejected" && (
            <>
              <Button
                variant="outline"
                onClick={handleRenewMembership}
                className="w-full sm:flex-1 text-sm py-2"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Renew Membership
              </Button>
              {isAdmin && (
                <Button
                  variant="default"
                  onClick={handleOverrideAccess}
                  className="w-full sm:flex-1 bg-orange-600 hover:bg-orange-700 text-sm py-2"
                >
                  <Shield className="h-3.5 w-3.5 mr-2" />
                  Override Access
                </Button>
              )}
            </>
          )}

          {result.status === "approved" && result.color === "yellow" && (
            <Button
              variant="outline"
              onClick={handleRenewMembership}
              className="w-full sm:flex-1 text-sm py-2"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Renew Membership
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

