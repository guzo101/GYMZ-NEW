/* @ts-nocheck */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, CheckCircle } from "lucide-react";

interface WaitingApprovalModalProps {
  open: boolean;
}

export function WaitingApprovalModal({ open }: WaitingApprovalModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md p-0 flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0 border-b p-6">
          <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            Payment Pending Approval
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 p-6 space-y-4">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">
                Payment Submitted Successfully
              </p>
              <p className="text-sm text-muted-foreground">
                The admin will approve you shortly. Thank you for choosing Gymz.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

