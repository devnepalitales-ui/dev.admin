"use client";

import { useState } from "react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellRing,
  BellOff,
  Smartphone,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Send,
} from "lucide-react";

export function PushNotificationControl() {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    isIOS,
    isStandalone,
    subscribe,
    unsubscribe,
    sendTestPush,
  } = usePushNotifications();

  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    await sendTestPush();
    setTesting(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative h-8 px-2.5 gap-1.5 text-xs font-medium cursor-pointer"
        title="Mobile Push Notifications"
      >
        {isSubscribed ? (
          <BellRing className="h-4 w-4 text-emerald-500 animate-pulse" />
        ) : (
          <Bell className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="hidden sm:inline">
          {isSubscribed ? "Push Alerts On" : "Push Alerts"}
        </span>
        <span
          className={`h-2 w-2 rounded-full ${
            isSubscribed ? "bg-emerald-500" : "bg-zinc-600"
          }`}
        />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <DialogTitle>Mobile Push Notifications</DialogTitle>
          </div>
          <DialogDescription>
            Get background order notifications on this device when new orders are placed, even when the app is closed or your phone is locked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-2.5">
              {isSubscribed ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Notification Status</p>
                <p className="text-xs text-muted-foreground">
                  {isSubscribed
                    ? "Active on this device"
                    : permission === "denied"
                    ? "Blocked in browser settings"
                    : "Not configured on this device"}
                </p>
              </div>
            </div>
            <Badge
              variant={isSubscribed ? "default" : "secondary"}
              className={isSubscribed ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            >
              {isSubscribed ? "Active" : "Inactive"}
            </Badge>
          </div>

          {/* iOS Safari Home Screen Requirement Guide */}
          {isIOS && !isStandalone && (
            <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                iPhone / iPad Setup Required
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Apple requires web apps to be installed to the Home Screen to receive push alerts when closed:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-1">
                <li>
                  Tap Safari&apos;s <span className="text-foreground font-medium">Share</span> button <Share2 className="inline h-3 w-3" /> (bottom bar).
                </li>
                <li>
                  Select <span className="text-foreground font-medium">&quot;Add to Home Screen&quot;</span>.
                </li>
                <li>Launch the app from your Home Screen and tap Enable Notifications.</li>
              </ol>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            {!isSubscribed ? (
              <Button
                onClick={() => subscribe()}
                disabled={isLoading || (!isSupported && !isIOS)}
                className="w-full gap-2 font-medium"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BellRing className="h-4 w-4" />
                )}
                Enable Push Notifications on this Device
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing || isLoading}
                  className="flex-1 gap-2 text-xs"
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Send Test Alert
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => unsubscribe()}
                  disabled={isLoading}
                  className="text-xs text-destructive hover:text-destructive"
                >
                  Disable
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}
