"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  getVapidPublicKey,
  subscribeAdminPush,
  unsubscribeAdminPush,
  sendTestAdminPush,
} from "@/lib/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | "unsupported";
  isIOS: boolean;
  isStandalone: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  sendTestPush: () => Promise<boolean>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Initialize service worker and check existing push subscription
  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(isIosDevice);

    const isInstalled =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(isInstalled);

    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);

    if (!supported) {
      setPermission("unsupported");
      setIsLoading(false);
      return;
    }

    setPermission(Notification.permission);

    // Register /sw.js
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async (reg) => {
        swRegistrationRef.current = reg;
        try {
          const sub = await reg.pushManager.getSubscription();
          setIsSubscribed(!!sub);
        } catch {
          setIsSubscribed(false);
        } finally {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("[PWA SW]: Failed to register service worker:", err);
        setIsLoading(false);
      });
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error("Push notifications are not supported on this browser");
      return false;
    }

    // iOS requires the PWA to be installed to Home Screen before PushManager works
    if (isIOS && !isStandalone) {
      toast.info("Install to Home Screen Required", {
        description:
          "On iPhone/iPad: Tap the Share button (bottom bar) ➔ 'Add to Home Screen', then launch the app from your home screen.",
        duration: 8000,
      });
      return false;
    }

    setIsLoading(true);
    try {
      // 1. Request user permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        toast.error("Notification permission denied", {
          description: "Please allow notifications in your browser/device settings.",
        });
        setIsLoading(false);
        return false;
      }

      // 2. Fetch server VAPID public key
      const keyRes = await getVapidPublicKey();
      if (!keyRes.success || !keyRes.publicKey) {
        throw new Error("Failed to retrieve VAPID public key from server");
      }

      // 3. Ensure service worker is ready
      const reg = swRegistrationRef.current || (await navigator.serviceWorker.ready);
      swRegistrationRef.current = reg;

      // 4. Subscribe to PushManager
      const convertedKey = urlBase64ToUint8Array(keyRes.publicKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Invalid push subscription structure returned by browser");
      }

      // 5. Send subscription to Nepali Tales backend
      await subscribeAdminPush({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        userAgent: navigator.userAgent,
      });

      setIsSubscribed(true);
      toast.success("Order alerts enabled on this device!", {
        description: "You will be alerted when new orders arrive, even when the app is closed.",
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to enable notifications";
      console.error("[usePushNotifications]: Subscribe error:", err);
      toast.error("Subscription failed", { description: msg });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isIOS, isStandalone]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const reg = swRegistrationRef.current || (await navigator.serviceWorker.ready);
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        await unsubscribeAdminPush(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }

      setIsSubscribed(false);
      toast.info("Order push alerts disabled on this device");
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to disable notifications";
      toast.error("Unsubscribe error", { description: msg });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendTestPush = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const reg = swRegistrationRef.current || (await navigator.serviceWorker.ready);
      const sub = await reg.pushManager.getSubscription();
      const subJson = sub?.toJSON();

      const res = await sendTestAdminPush(
        subJson?.endpoint && subJson?.keys?.p256dh && subJson?.keys?.auth
          ? {
              endpoint: subJson.endpoint,
              keys: {
                p256dh: subJson.keys.p256dh,
                auth: subJson.keys.auth,
              },
            }
          : undefined,
      );

      if (res.success) {
        toast.success("Test notification sent!", {
          description: "Check your device lock screen or notifications shade.",
        });
        return true;
      } else {
        toast.warning(res.message || "Failed to trigger test alert");
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to trigger test alert";
      toast.error("Test notification failed", { description: msg });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    isIOS,
    isStandalone,
    subscribe,
    unsubscribe,
    sendTestPush,
  };
}
