"use client";

import React, { useState } from "react";
import {
  Volume2,
  VolumeX,
  Volume1,
  Play,
  Check,
  Bell,
  Sparkles,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useOrderEvents } from "@/hooks/use-order-events";

export function OrderAudioControl() {
  const {
    audioSettings,
    isAudioUnlocked,
    toggleSound,
    setAudioSettings,
    testChime,
  } = useOrderEvents();

  const [isPlayingTest, setIsPlayingTest] = useState(false);

  const handleTestChime = async () => {
    setIsPlayingTest(true);
    try {
      await testChime();
    } finally {
      setTimeout(() => {
        setIsPlayingTest(false);
      }, 1500);
    }
  };

  const volumePercent = Math.round(audioSettings.volume * 100);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="relative h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer"
          />
        }
      >
        {audioSettings.enabled ? (
          <>
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <Volume2 className="size-3.5 text-emerald-500" />
            <span className="hidden md:inline">Order Chimes</span>
          </>
        ) : (
          <>
            <VolumeX className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground hidden md:inline">Chimes Muted</span>
          </>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom" sideOffset={8} className="w-80 p-4">
        <PopoverHeader className="pb-2 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Bell className="size-4" />
              </div>
              <div>
                <PopoverTitle className="font-semibold text-sm">Order Audio Chimes</PopoverTitle>
                <p className="text-[11px] text-muted-foreground">Alerts when new orders arrive</p>
              </div>
            </div>
            <Badge
              variant={audioSettings.enabled ? "default" : "secondary"}
              className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0 ${
                audioSettings.enabled ? "bg-emerald-600/90 text-white" : ""
              }`}
            >
              {audioSettings.enabled ? "Active" : "Muted"}
            </Badge>
          </div>
        </PopoverHeader>

        <div className="flex flex-col gap-3.5 pt-3 text-xs">
          {/* Main Toggle Switch */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 p-2.5">
            <div className="space-y-0.5">
              <div className="font-medium text-foreground">Play Sound on New Orders</div>
              <p className="text-[11px] text-muted-foreground">
                Synthesized 3-tone kitchen alert chime
              </p>
            </div>
            <Switch
              checked={audioSettings.enabled}
              onCheckedChange={toggleSound}
              size="sm"
            />
          </div>

          {/* Test Sound Button */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>Preview Kitchen Alert</span>
              {!isAudioUnlocked && (
                <span className="text-amber-500 font-normal">Click to unlock audio</span>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestChime}
              disabled={isPlayingTest}
              className="w-full justify-center gap-2 h-8 text-xs font-medium cursor-pointer"
            >
              <Play className={`size-3.5 fill-current ${isPlayingTest ? "animate-spin" : ""}`} />
              {isPlayingTest ? "Playing chime..." : "Test Chime Sound"}
            </Button>
          </div>

          {/* Volume Preset Selector */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>Chime Volume</span>
              <span className="font-mono text-foreground">{volumePercent}%</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Quiet", value: 0.4 },
                { label: "Medium", value: 0.75 },
                { label: "Loud", value: 1.0 },
              ].map((lvl) => {
                const isSelected = Math.abs(audioSettings.volume - lvl.value) < 0.08;
                return (
                  <Button
                    key={lvl.label}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="xs"
                    onClick={() => setAudioSettings({ volume: lvl.value })}
                    className="h-7 text-[11px] cursor-pointer"
                  >
                    {isSelected && <Check className="size-3 mr-1" />}
                    {lvl.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Repeat Selector */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>Alert Pattern</span>
              <span className="text-[10px] text-muted-foreground">
                {audioSettings.repeat === 2 ? "Repeated twice" : "Single chime"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                type="button"
                variant={audioSettings.repeat === 2 ? "default" : "outline"}
                size="xs"
                onClick={() => setAudioSettings({ repeat: 2 })}
                className="h-7 text-[11px] cursor-pointer"
              >
                {audioSettings.repeat === 2 && <Check className="size-3 mr-1" />}
                2x Alert (Kitchen)
              </Button>
              <Button
                type="button"
                variant={audioSettings.repeat === 1 ? "default" : "outline"}
                size="xs"
                onClick={() => setAudioSettings({ repeat: 1 })}
                className="h-7 text-[11px] cursor-pointer"
              >
                {audioSettings.repeat === 1 && <Check className="size-3 mr-1" />}
                1x Chime
              </Button>
            </div>
          </div>

          {/* Audio Engine Status Footer */}
          <div className="pt-1 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sparkles className="size-2.5 text-primary" />
              Web Audio Synthesizer
            </span>
            <span>
              {isAudioUnlocked ? (
                <span className="text-emerald-500 font-medium">Ready</span>
              ) : (
                <span className="text-amber-500 font-medium">Tap to enable</span>
              )}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
