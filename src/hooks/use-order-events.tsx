"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { getOrderLiveSummary } from "@/lib/api";
import { toast } from "sonner";
import { soundManager, type AudioSettings } from "@/lib/order-audio";

export interface OrderEventData {
  orderId: string;
  orderNumber: string;
  status: string;
  summary?: Record<string, unknown>;
  timestamp?: string;
}

export interface OrderLiveCounts {
  placed: number;
  preparing: number;
  ready: number;
  porterBooked: number;
  delivered: number;
  cancelled: number;
}

export type OrderEventListener = (event: { type: string; data: OrderEventData }) => void;

export interface OrderEventsContextValue {
  isConnected: boolean;
  counts: OrderLiveCounts | null;
  lastEvent: { type: string; data: OrderEventData } | null;
  audioSettings: AudioSettings;
  isAudioUnlocked: boolean;
  toggleSound: () => void;
  setAudioSettings: (newSettings: Partial<AudioSettings>) => void;
  testChime: () => Promise<boolean>;
  subscribe: (listener: OrderEventListener) => () => void;
}

const OrderEventsContext = createContext<OrderEventsContextValue | null>(null);

export interface UseOrderEventsOptions {
  onOrderChange?: (event: { type: string; data: OrderEventData }) => void;
  enableToasts?: boolean;
}

const POLL_INTERVAL_ACTIVE_MS = 15_000; // 15 seconds while active
const POLL_INTERVAL_HIDDEN_MS = 25_000; // 25 seconds in background tab

export function OrderEventsProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [counts, setCounts] = useState<OrderLiveCounts | null>(null);
  const [lastEvent, setLastEvent] = useState<{ type: string; data: OrderEventData } | null>(null);
  const [audioSettings, setAudioSettingsState] = useState<AudioSettings>(() => soundManager.getSettings());
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  const listenersRef = useRef<Set<OrderEventListener>>(new Set());
  const prevCountsRef = useRef<OrderLiveCounts | null>(null);

  // Sync audio settings when changed
  useEffect(() => {
    return soundManager.subscribe((newSettings) => {
      setAudioSettingsState(newSettings);
    });
  }, []);

  // Update audio unlock state on user interaction
  useEffect(() => {
    const updateUnlock = () => setIsAudioUnlocked(soundManager.isUnlocked());
    updateUnlock();
    window.addEventListener("pointerdown", updateUnlock, { passive: true });
    window.addEventListener("keydown", updateUnlock, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", updateUnlock);
      window.removeEventListener("keydown", updateUnlock);
    };
  }, []);

  const subscribe = useCallback((listener: OrderEventListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const toggleSound = useCallback(() => {
    const next = !audioSettings.enabled;
    soundManager.saveSettings({ enabled: next });
    if (next) {
      soundManager.testChime();
    }
  }, [audioSettings.enabled]);

  const setAudioSettings = useCallback((newSettings: Partial<AudioSettings>) => {
    soundManager.saveSettings(newSettings);
  }, []);

  const testChime = useCallback(async () => {
    const ok = await soundManager.testChime();
    setIsAudioUnlocked(soundManager.isUnlocked());
    return ok;
  }, []);

  const handleIncomingEvent = useCallback(
    (type: string, data: OrderEventData) => {
      setLastEvent({ type, data });

      // 1. Play Web Audio Chime on New Order
      if (type === "order_created") {
        soundManager.playOrderChime();
      }

      // 2. Global notification toast
      if (type === "order_created") {
        toast.success(`New Order #${data.orderNumber} placed!`, {
          description: `Status: ${data.status.toUpperCase()} • Click to view in orders dashboard.`,
          duration: 7000,
          action: {
            label: "View Orders",
            onClick: () => {
              if (typeof window !== "undefined" && window.location.pathname !== "/orders") {
                window.location.href = "/orders";
              }
            },
          },
        });
      } else if (type === "order_cancelled") {
        toast.warning(`Order #${data.orderNumber} cancelled`, {
          description: `Status: ${data.status}`,
          duration: 5000,
        });
      } else if (type === "porter_status_updated") {
        toast.info(`Delivery update for #${data.orderNumber}: ${data.status}`);
      }

      // 3. Notify all subscribed component listeners
      listenersRef.current.forEach((cb) => {
        try {
          cb({ type, data });
        } catch (err) {
          console.error("Error in order event listener:", err);
        }
      });
    },
    [],
  );

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isUnmounted = false;
    let lastCheckedServerTime = 0;
    let inFlight = false;

    async function sync() {
      if (isUnmounted || inFlight) return;
      inFlight = true;

      try {
        const res = await getOrderLiveSummary(lastCheckedServerTime > 0 ? lastCheckedServerTime : undefined);
        if (isUnmounted) return;

        setIsConnected(true);

        let hasOrderCreatedEvent = false;

        if (lastCheckedServerTime > 0 && Array.isArray(res.events) && res.events.length > 0) {
          for (const ev of res.events) {
            if (ev.type === "order_created") {
              hasOrderCreatedEvent = true;
            }
            handleIncomingEvent(ev.type, {
              orderId: ev.orderId,
              orderNumber: ev.orderNumber,
              status: ev.status,
              summary: ev.summary,
              timestamp: ev.timestamp,
            });
          }
        }

        // Secondary fallback safeguard: if placed count increased and no order_created event was in the batch
        if (res.counts) {
          if (
            lastCheckedServerTime > 0 &&
            prevCountsRef.current &&
            res.counts.placed > prevCountsRef.current.placed &&
            !hasOrderCreatedEvent
          ) {
            soundManager.playOrderChime();
            toast.success("New Order Received!", {
              description: `${res.counts.placed} orders currently waiting in kitchen queue.`,
              duration: 7000,
            });
          }
          prevCountsRef.current = res.counts;
          setCounts(res.counts);
        }

        if (res.serverTime) {
          lastCheckedServerTime = res.serverTime;
        }
      } catch {
        // Network or server glitch: maintain state and retry next tick
      } finally {
        inFlight = false;
      }
    }

    function restartPolling() {
      if (intervalId) clearInterval(intervalId);
      const interval = document.hidden ? POLL_INTERVAL_HIDDEN_MS : POLL_INTERVAL_ACTIVE_MS;
      intervalId = setInterval(sync, interval);
    }

    function handleVisibility() {
      if (!document.hidden) {
        sync(); // Instant sync when user returns to tab
      }
      restartPolling();
    }

    document.addEventListener("visibilitychange", handleVisibility);

    // Initial sync immediately
    sync();
    restartPolling();

    return () => {
      isUnmounted = true;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [handleIncomingEvent]);

  const value: OrderEventsContextValue = {
    isConnected,
    counts,
    lastEvent,
    audioSettings,
    isAudioUnlocked,
    toggleSound,
    setAudioSettings,
    testChime,
    subscribe,
  };

  return <OrderEventsContext.Provider value={value}>{children}</OrderEventsContext.Provider>;
}

export function useOrderEvents(options: UseOrderEventsOptions = {}) {
  const context = useContext(OrderEventsContext);
  const { onOrderChange } = options;

  useEffect(() => {
    if (!context || !onOrderChange) return;
    return context.subscribe(onOrderChange);
  }, [context, onOrderChange]);

  if (!context) {
    return {
      isConnected: true,
      counts: null,
      lastEvent: null,
      audioSettings: soundManager.getSettings(),
      isAudioUnlocked: soundManager.isUnlocked(),
      toggleSound: () => {},
      setAudioSettings: () => {},
      testChime: async () => false,
    };
  }

  return {
    isConnected: context.isConnected,
    counts: context.counts,
    lastEvent: context.lastEvent,
    audioSettings: context.audioSettings,
    isAudioUnlocked: context.isAudioUnlocked,
    toggleSound: context.toggleSound,
    setAudioSettings: context.setAudioSettings,
    testChime: context.testChime,
  };
}
