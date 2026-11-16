"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useOrderEvents } from "@/hooks/use-order-events";
import {
  getInventoryPrep,
  type InventoryPrepResponse,
  type InventoryPrepDish,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChefHat,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  AlertCircle,
  Search,
  CheckCircle2,
  UtensilsCrossed,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Get current date string in IST ("YYYY-MM-DD")
 */
function getIstTodayDateStr(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const getP = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${getP("year")}-${getP("month")}-${getP("day")}`;
}

/**
 * Add or subtract days from a YYYY-MM-DD date string safely
 */
function shiftDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a date string into a friendly readable label
 */
function formatHumanDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Currency formatter
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Condense standard dispatch slot label like "02:00 PM - 03:00 PM" -> "2–3 PM"
 * or "11:30 AM - 01:00 PM" -> "11:30 AM–1 PM"
 */
function formatSlotTimeShort(rawLabel: string): string {
  if (!rawLabel) return "";
  const parenMatch = rawLabel.match(/\((.*?)\)/);
  const candidate = parenMatch ? parenMatch[1] : rawLabel.split("(")[0].trim();

  const match = candidate.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[-–—to ]+\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i
  );
  if (match) {
    const [, startH, startM, startP, endH, endM, endP] = match;
    const startHour = parseInt(startH, 10);
    const endHour = parseInt(endH, 10);
    const startPeriod = startP.toUpperCase();
    const endPeriod = endP.toUpperCase();

    const startTime = startM && startM !== "00" ? `${startHour}:${startM}` : `${startHour}`;
    const endTime = endM && endM !== "00" ? `${endHour}:${endM}` : `${endHour}`;

    if (startPeriod === endPeriod) {
      return `${startTime}–${endTime} ${endPeriod}`;
    }
    return `${startTime} ${startPeriod}–${endTime} ${endPeriod}`;
  }
  return candidate.replace(/^0(\d)/, "$1").trim();
}

export default function InventoryPrepPage() {
  const todayStr = useMemo(() => getIstTodayDateStr(), []);
  const tomorrowStr = useMemo(() => shiftDateStr(todayStr, 1), [todayStr]);
  const dayAfterStr = useMemo(() => shiftDateStr(todayStr, 2), [todayStr]);

  // Default selection is Tomorrow (the primary inventory planning target!)
  const [selectedDate, setSelectedDate] = useState<string>(tomorrowStr);
  const [data, setData] = useState<InventoryPrepResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<"dishes" | "slots" | "notes" | "roster">("dishes");

  // Filter dishes by veg/non-veg and category
  const [foodFilter, setFoodFilter] = useState<"all" | "veg" | "non-veg">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "momo" | "jhol" | "shaphaley">("all");
  const [dishSearch, setDishSearch] = useState<string>("");

  // Batch needs display mode: "compact" (first 2 + popover) vs "expanded" (all chips)
  const [batchViewMode, setBatchViewMode] = useState<"compact" | "expanded">("compact");

  const fetchPrepPlan = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await getInventoryPrep(date);
      if (res.success) {
        setData(res);
      }
    } catch (err: any) {
      toast.error("Failed to load kitchen prep plan: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrepPlan(selectedDate);
  }, [fetchPrepPlan, selectedDate]);

  // Live real-time sync: silently refresh kitchen prep when new orders arrive
  useOrderEvents({
    onOrderChange: () => {
      fetchPrepPlan(selectedDate);
    },
  });

  // Kitchen Production Metrics: Item Breakdown by Category (Momo, Jhol Momo, Shaphaley) and Type (Veg, Chicken)
  const productionMetrics = useMemo(() => {
    const dishes = data?.dishes || [];

    const isShaphaley = (d: InventoryPrepDish) => {
      const slug = (d.categorySlug || "").toLowerCase();
      const name = (d.productName || "").toLowerCase();
      return slug.includes("shaphaley") || name.includes("shaphaley");
    };

    const isJhol = (d: InventoryPrepDish) => {
      const slug = (d.categorySlug || "").toLowerCase();
      const name = (d.productName || "").toLowerCase();
      return slug.includes("jhol") || name.includes("jhol");
    };

    let vegPlates = 0;
    let chickenPlates = 0;

    let momoVeg = 0;
    let momoChicken = 0;

    let jholVeg = 0;
    let jholChicken = 0;

    let shaphaleyVeg = 0;
    let shaphaleyChicken = 0;

    for (const d of dishes) {
      const plates = d.totalPortions || 0;
      const isVeg = d.type === "veg";

      if (isVeg) {
        vegPlates += plates;
      } else {
        chickenPlates += plates;
      }

      if (isShaphaley(d)) {
        if (isVeg) shaphaleyVeg += plates;
        else shaphaleyChicken += plates;
      } else if (isJhol(d)) {
        if (isVeg) jholVeg += plates;
        else jholChicken += plates;
      } else {
        if (isVeg) momoVeg += plates;
        else momoChicken += plates;
      }
    }

    const totalPlates = vegPlates + chickenPlates || data?.summary?.totalPortions || 0;
    const momoTotal = momoVeg + momoChicken;
    const jholTotal = jholVeg + jholChicken;
    const shaphaleyTotal = shaphaleyVeg + shaphaleyChicken;

    return {
      totalPlates,
      vegPlates,
      chickenPlates,
      categories: {
        momo: {
          total: momoTotal,
          veg: momoVeg,
          chicken: momoChicken,
          percentage: totalPlates > 0 ? Math.round((momoTotal / totalPlates) * 100) : 0,
        },
        jhol: {
          total: jholTotal,
          veg: jholVeg,
          chicken: jholChicken,
          percentage: totalPlates > 0 ? Math.round((jholTotal / totalPlates) * 100) : 0,
        },
        shaphaley: {
          total: shaphaleyTotal,
          veg: shaphaleyVeg,
          chicken: shaphaleyChicken,
          percentage: totalPlates > 0 ? Math.round((shaphaleyTotal / totalPlates) * 100) : 0,
        },
      },
      typeBreakdown: {
        veg: {
          momo: momoVeg,
          jhol: jholVeg,
          shaphaley: shaphaleyVeg,
        },
        chicken: {
          momo: momoChicken,
          jhol: jholChicken,
          shaphaley: shaphaleyChicken,
        },
      },
    };
  }, [data]);

  // Filtered dishes for display
  const filteredDishes = useMemo(() => {
    if (!data?.dishes) return [];
    return data.dishes.filter((dish) => {
      if (foodFilter !== "all" && dish.type !== foodFilter) return false;

      if (categoryFilter !== "all") {
        const slug = (dish.categorySlug || "").toLowerCase();
        const name = (dish.productName || "").toLowerCase();
        const isShaphaley = slug.includes("shaphaley") || name.includes("shaphaley");
        const isJhol = slug.includes("jhol") || name.includes("jhol");
        const isMomo = !isShaphaley && !isJhol;

        if (categoryFilter === "shaphaley" && !isShaphaley) return false;
        if (categoryFilter === "jhol" && !isJhol) return false;
        if (categoryFilter === "momo" && !isMomo) return false;
      }

      if (dishSearch.trim()) {
        const query = dishSearch.toLowerCase().trim();
        return (
          dish.productName.toLowerCase().includes(query) ||
          dish.categorySlug?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [data?.dishes, foodFilter, categoryFilter, dishSearch]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <ChefHat className="h-3.5 w-3.5" />
              Kitchen Production & Inventory
            </span>
            {selectedDate === tomorrowStr && (
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                Planning for Tomorrow
              </Badge>
            )}
            {selectedDate === todayStr && (
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                Today&apos;s Dispatch
              </Badge>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Inventory & Prep Planning
          </h2>
          <p className="text-muted-foreground text-sm">
            Calculate accurate ingredient requirements, dish plates, and batch schedules for upcoming kitchen pre-orders.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPrepPlan(selectedDate)}
            disabled={loading}
            className="text-xs gap-1.5 h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Selector Navigation Bar */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-3.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Quick Date Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant={selectedDate === todayStr ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDate(todayStr)}
                className="h-8 text-xs font-medium"
              >
                Today
              </Button>

              <Button
                variant={selectedDate === tomorrowStr ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDate(tomorrowStr)}
                className={`h-8 text-xs font-semibold ${
                  selectedDate === tomorrowStr
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "border-amber-500/30 text-amber-700 dark:text-amber-400"
                }`}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Tomorrow (Next Day)
              </Button>

              <Button
                variant={selectedDate === dayAfterStr ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDate(dayAfterStr)}
                className="h-8 text-xs font-medium"
              >
                Day After
              </Button>
            </div>

            {/* Stepper & Date Picker */}
            <div className="flex items-center gap-2 self-center sm:self-auto">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setSelectedDate((curr) => shiftDateStr(curr, -1))}
                className="h-8 w-8 p-0"
                title="Previous Day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted/30 text-xs font-semibold">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{formatHumanDate(selectedDate)}</span>
              </div>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => setSelectedDate((curr) => shiftDateStr(curr, 1))}
                className="h-8 w-8 p-0"
                title="Next Day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* Custom Date Input */}
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="w-36 h-8 text-xs font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Orders */}
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Confirmed Orders</span>
              <Calendar className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-2xl font-black text-foreground">
              {loading ? <Skeleton className="h-8 w-16" /> : data?.summary.totalOrders ?? 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <span>{data?.summary.deliveryOrders ?? 0} delivery</span>
              <span>•</span>
              <span>{data?.summary.pickupOrders ?? 0} pickup</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Plates to Cook */}
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Plates to Cook</span>
              <ChefHat className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {loading ? <Skeleton className="h-8 w-16" /> : data?.summary.totalPortions ?? 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
              <span className="text-emerald-600 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                {data?.summary.vegPortions ?? 0} Veg
              </span>
              <span>•</span>
              <span className="text-rose-600 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block" />
                {data?.summary.nonVegPortions ?? 0} Non-Veg
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Add-ons & Sides to Prep */}
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Add-ons & Dips</span>
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {loading ? <Skeleton className="h-8 w-16" /> : data?.summary.totalAddons ?? 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              <span>Chutneys, extra dips & beverages</span>
            </div>
          </CardContent>
        </Card>

        {/* Batch Timing / Value */}
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Batch Slots & Value</span>
              <Clock className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {loading ? <Skeleton className="h-8 w-20" /> : formatCurrency(data?.summary.totalRevenue ?? 0)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              <span>{data?.slots.length ?? 0} kitchen dispatch slots</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Kitchen Production Dashboard (Category × Type Matrix) ─── */}
      {!loading && data && data.summary.totalOrders > 0 && (
        <Card className="border-border/80 shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-amber-500" />
                  Kitchen Production Dashboard
                </CardTitle>
                <CardDescription className="text-xs">
                  Total plates required broken down by Category (Momo, Jhol Momo, Shaphaley) and Type (Veg, Chicken)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-bold font-mono px-2.5 py-1 bg-background border-amber-500/30">
                  Total: <span className="text-amber-500 ml-1">{productionMetrics.totalPlates} Plates to Cook</span>
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {/* 5 Quick-Glance Production Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. Veg Plates Total */}
              <div
                onClick={() => setFoodFilter(foodFilter === "veg" ? "all" : "veg")}
                className={`rounded-xl border p-3 cursor-pointer transition-all ${
                  foodFilter === "veg"
                    ? "border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/30"
                    : "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                }`}
                title="Click to filter table below by Veg"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Veg Plates
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                    TYPE
                  </Badge>
                </div>
                <div className="text-2xl font-black text-foreground">
                  {productionMetrics.vegPlates}
                  <span className="text-xs font-normal text-muted-foreground ml-1">plates</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 truncate">
                  Momo: {productionMetrics.typeBreakdown.veg.momo} • Jhol: {productionMetrics.typeBreakdown.veg.jhol} • Shaphaley: {productionMetrics.typeBreakdown.veg.shaphaley}
                </div>
              </div>

              {/* 2. Chicken Plates Total */}
              <div
                onClick={() => setFoodFilter(foodFilter === "non-veg" ? "all" : "non-veg")}
                className={`rounded-xl border p-3 cursor-pointer transition-all ${
                  foodFilter === "non-veg"
                    ? "border-rose-500 bg-rose-500/15 ring-2 ring-rose-500/30"
                    : "border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10"
                }`}
                title="Click to filter table below by Chicken / Non-Veg"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Chicken Plates
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold">
                    TYPE
                  </Badge>
                </div>
                <div className="text-2xl font-black text-foreground">
                  {productionMetrics.chickenPlates}
                  <span className="text-xs font-normal text-muted-foreground ml-1">plates</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 truncate">
                  Momo: {productionMetrics.typeBreakdown.chicken.momo} • Jhol: {productionMetrics.typeBreakdown.chicken.jhol} • Shaphaley: {productionMetrics.typeBreakdown.chicken.shaphaley}
                </div>
              </div>

              {/* 3. Momo Category */}
              <div
                onClick={() => setCategoryFilter(categoryFilter === "momo" ? "all" : "momo")}
                className={`rounded-xl border p-3 cursor-pointer transition-all ${
                  categoryFilter === "momo"
                    ? "border-primary bg-primary/15 ring-2 ring-primary/30"
                    : "border-border/80 bg-card hover:bg-muted/40"
                }`}
                title="Click to filter table below by Momo"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                  <span className="flex items-center gap-1.5">
                    🥟 Momo
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {productionMetrics.categories.momo.percentage}%
                  </span>
                </div>
                <div className="text-2xl font-black text-foreground">
                  {productionMetrics.categories.momo.total}
                  <span className="text-xs font-normal text-muted-foreground ml-1">plates</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{productionMetrics.categories.momo.veg} Veg</span>
                  <span>•</span>
                  <span className="text-rose-600 dark:text-rose-400 font-medium">{productionMetrics.categories.momo.chicken} Chicken</span>
                </div>
              </div>

              {/* 4. Jhol Momo Category */}
              <div
                onClick={() => setCategoryFilter(categoryFilter === "jhol" ? "all" : "jhol")}
                className={`rounded-xl border p-3 cursor-pointer transition-all ${
                  categoryFilter === "jhol"
                    ? "border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/30"
                    : "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                }`}
                title="Click to filter table below by Jhol Momo"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
                  <span className="flex items-center gap-1.5">
                    🍲 Jhol Momo
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {productionMetrics.categories.jhol.percentage}%
                  </span>
                </div>
                <div className="text-2xl font-black text-foreground">
                  {productionMetrics.categories.jhol.total}
                  <span className="text-xs font-normal text-muted-foreground ml-1">plates</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{productionMetrics.categories.jhol.veg} Veg</span>
                  <span>•</span>
                  <span className="text-rose-600 dark:text-rose-400 font-medium">{productionMetrics.categories.jhol.chicken} Chicken</span>
                </div>
              </div>

              {/* 5. Shaphaley Category */}
              <div
                onClick={() => setCategoryFilter(categoryFilter === "shaphaley" ? "all" : "shaphaley")}
                className={`rounded-xl border p-3 cursor-pointer transition-all col-span-2 lg:col-span-1 ${
                  categoryFilter === "shaphaley"
                    ? "border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-500/30"
                    : "border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10"
                }`}
                title="Click to filter table below by Shaphaley"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                  <span className="flex items-center gap-1.5">
                    🫓 Shaphaley
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {productionMetrics.categories.shaphaley.percentage}%
                  </span>
                </div>
                <div className="text-2xl font-black text-foreground">
                  {productionMetrics.categories.shaphaley.total}
                  <span className="text-xs font-normal text-muted-foreground ml-1">plates</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{productionMetrics.categories.shaphaley.veg} Veg</span>
                  <span>•</span>
                  <span className="text-rose-600 dark:text-rose-400 font-medium">{productionMetrics.categories.shaphaley.chicken} Chicken</span>
                </div>
              </div>
            </div>

            {/* Matrix Cross-Tabulation Table */}
            <div className="rounded-lg border border-border/70 overflow-hidden bg-background">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[34%] font-bold text-foreground text-xs">Production Item Category</TableHead>
                    <TableHead className="text-center font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                      Veg Plates
                    </TableHead>
                    <TableHead className="text-center font-bold text-rose-600 dark:text-rose-400 text-xs">
                      Chicken Plates
                    </TableHead>
                    <TableHead className="text-center font-bold text-foreground text-xs">
                      Total Plates
                    </TableHead>
                    <TableHead className="text-right font-bold text-muted-foreground text-xs">
                      Share of Kitchen Run
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {/* Row 1: Momo */}
                  <TableRow>
                    <TableCell className="font-semibold text-foreground flex items-center gap-2">
                      <span className="text-base">🥟</span>
                      <div>
                        <span>Momo</span>
                        <span className="text-[11px] text-muted-foreground font-normal ml-1.5">(Steamed & Kothey)</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      {productionMetrics.categories.momo.veg}
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium text-rose-600 dark:text-rose-400">
                      {productionMetrics.categories.momo.chicken}
                    </TableCell>
                    <TableCell className="text-center font-mono font-black text-foreground">
                      {productionMetrics.categories.momo.total} plates
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${productionMetrics.categories.momo.percentage}%` }}
                          />
                        </div>
                        <span className="font-mono text-muted-foreground w-8 text-right">
                          {productionMetrics.categories.momo.percentage}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Row 2: Jhol Momo */}
                  <TableRow>
                    <TableCell className="font-semibold text-foreground flex items-center gap-2">
                      <span className="text-base">🍲</span>
                      <div>
                        <span>Jhol Momo</span>
                        <span className="text-[11px] text-muted-foreground font-normal ml-1.5">(Spiced Soup Dumplings)</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      {productionMetrics.categories.jhol.veg}
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium text-rose-600 dark:text-rose-400">
                      {productionMetrics.categories.jhol.chicken}
                    </TableCell>
                    <TableCell className="text-center font-mono font-black text-foreground">
                      {productionMetrics.categories.jhol.total} plates
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${productionMetrics.categories.jhol.percentage}%` }}
                          />
                        </div>
                        <span className="font-mono text-muted-foreground w-8 text-right">
                          {productionMetrics.categories.jhol.percentage}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Row 3: Shaphaley */}
                  <TableRow>
                    <TableCell className="font-semibold text-foreground flex items-center gap-2">
                      <span className="text-base">🫓</span>
                      <div>
                        <span>Shaphaley</span>
                        <span className="text-[11px] text-muted-foreground font-normal ml-1.5">(Crispy Fried Pockets)</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      {productionMetrics.categories.shaphaley.veg}
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium text-rose-600 dark:text-rose-400">
                      {productionMetrics.categories.shaphaley.chicken}
                    </TableCell>
                    <TableCell className="text-center font-mono font-black text-foreground">
                      {productionMetrics.categories.shaphaley.total} plates
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${productionMetrics.categories.shaphaley.percentage}%` }}
                          />
                        </div>
                        <span className="font-mono text-muted-foreground w-8 text-right">
                          {productionMetrics.categories.shaphaley.percentage}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Summary Total Row */}
                  <TableRow className="bg-muted/50 font-bold border-t-2 border-border">
                    <TableCell className="text-foreground uppercase tracking-wider text-[11px] flex items-center gap-2 py-3">
                      <span className="text-base">📊</span>
                      <span>Total Production Run</span>
                    </TableCell>
                    <TableCell className="text-center font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      {productionMetrics.vegPlates} Veg
                    </TableCell>
                    <TableCell className="text-center font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                      {productionMetrics.chickenPlates} Chicken
                    </TableCell>
                    <TableCell className="text-center font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                      {productionMetrics.totalPlates} Plates
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-foreground">
                      100%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Special Dietary & Customer Instructions Alert Banner */}
      {!loading && data?.specialNotes && data.specialNotes.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                Kitchen Special Instructions & Requests ({data.specialNotes.length})
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-400/90 mb-2">
                Chefs, please review these specific customer notes before preparing today&apos;s food:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {data.specialNotes.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-background/80 border border-amber-500/20 text-foreground"
                  >
                    <div className="flex items-center justify-between font-semibold text-[11px] text-muted-foreground mb-0.5">
                      <span>Order #{item.orderNumber} • {item.customerName}</span>
                      <span className="font-mono text-primary uppercase">{item.orderType}</span>
                    </div>
                    <p className="font-medium text-amber-950 dark:text-amber-200 italic">
                      &ldquo;{item.note}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation View Tabs (Dishes, Batch Slots, Customer Notes, Full Roster) */}
      <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant={activeTab === "dishes" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("dishes")}
            className="h-8 text-xs font-medium"
          >
            <UtensilsCrossed className="h-3.5 w-3.5 mr-1.5" />
            Dishes & Add-ons ({data?.dishes.length ?? 0})
          </Button>

          <Button
            variant={activeTab === "slots" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("slots")}
            className="h-8 text-xs font-medium"
          >
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Cooking Batches / Slots ({data?.slots.length ?? 0})
          </Button>

          <Button
            variant={activeTab === "notes" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("notes")}
            className="h-8 text-xs font-medium"
          >
            <AlertCircle className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
            Kitchen Notes ({data?.specialNotes.length ?? 0})
          </Button>

          <Button
            variant={activeTab === "roster" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("roster")}
            className="h-8 text-xs font-medium"
          >
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Order Roster ({data?.orders.length ?? 0})
          </Button>
        </div>

        {/* Search for dishes */}
        {activeTab === "dishes" && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter Pills */}
            <div className="hidden sm:flex items-center gap-1 border border-border/80 rounded-md p-0.5 bg-muted/40">
              {(
                [
                  { key: "all", label: "All Categories" },
                  { key: "momo", label: "Momo" },
                  { key: "jhol", label: "Jhol Momo" },
                  { key: "shaphaley", label: "Shaphaley" },
                ] as const
              ).map((c) => (
                <Button
                  key={c.key}
                  variant={categoryFilter === c.key ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setCategoryFilter(c.key)}
                  className="h-6 text-[11px] font-medium px-2 cursor-pointer"
                >
                  {c.label}
                </Button>
              ))}
            </div>

            {/* Food Type Filter (Veg/Non-Veg) */}
            <div className="flex items-center gap-1 border border-border/80 rounded-md p-0.5 bg-muted/40">
              {(
                [
                  { key: "all", label: "All Types" },
                  { key: "veg", label: "Veg" },
                  { key: "non-veg", label: "Non-Veg" },
                ] as const
              ).map((f) => (
                <Button
                  key={f.key}
                  variant={foodFilter === f.key ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setFoodFilter(f.key)}
                  className="h-6 text-[11px] font-medium px-2 cursor-pointer"
                >
                  {f.label}
                </Button>
              ))}
            </div>

            <div className="relative w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search dish..."
                value={dishSearch}
                onChange={(e) => setDishSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <Card className="border-border/80">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : !data || data.summary.totalOrders === 0 ? (
        /* Empty State */
        <Card className="border-dashed border-2 border-border/80 text-center p-12">
          <CardContent className="space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <ChefHat className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              No Pre-Orders Scheduled for {formatHumanDate(selectedDate)}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              There are currently no confirmed pre-orders placed for this date.
              Customers may still place orders within the active ordering window.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(tomorrowStr)}
                className="text-xs"
              >
                Check Tomorrow
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(todayStr)}
                className="text-xs"
              >
                Check Today
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* TAB 1: PRODUCTION DISHES & ADDONS PREP SHEET */}
          {(activeTab === "dishes" || typeof window === "undefined") && (
            <div className="space-y-6">
              {/* Dishes Table */}
              <Card className="border-border/80 shadow-xs overflow-hidden">
                <CardHeader className="py-3.5 px-4 bg-muted/40 border-b border-border/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <span>Production Dishes Checklist</span>
                        <Badge variant="outline" className="text-[10px]">
                          {filteredDishes.length} Dishes
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Exact plate quantities to prepare for the {formatHumanDate(selectedDate)} kitchen run.
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Compact vs Show All Batches Toggle */}
                      <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setBatchViewMode("compact")}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                            batchViewMode === "compact"
                              ? "bg-muted text-foreground font-semibold shadow-2xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Compact Batches
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchViewMode("expanded")}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                            batchViewMode === "expanded"
                              ? "bg-muted text-foreground font-semibold shadow-2xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Show All Batches
                        </button>
                      </div>

                      <div className="text-xs font-semibold text-muted-foreground hidden md:block">
                        Total: <span className="text-foreground">{data.summary.totalPortions} Plates</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="w-[28%]">Dish / Item</TableHead>
                        <TableHead className="w-[10%] text-center">Type</TableHead>
                        <TableHead className="w-[14%] text-center bg-amber-500/5 dark:bg-amber-500/10 font-bold text-foreground">
                          Plates to Cook
                        </TableHead>
                        <TableHead className="w-[11%] text-center">
                          Total Pieces
                        </TableHead>
                        <TableHead className="w-[26%]">Dispatch Batch Needs</TableHead>
                        <TableHead className="w-[11%] text-right">Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDishes.map((dish) => (
                        <TableRow key={dish.productId} className="hover:bg-muted/30">
                          {/* Dish Name */}
                          <TableCell className="font-semibold text-foreground">
                            <div>
                              <span>{dish.productName}</span>
                              {dish.unitQuantity && (
                                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                                  ({dish.unitQuantity})
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Veg / Non-Veg Indicator */}
                          <TableCell className="text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                dish.type === "veg"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  dish.type === "veg" ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                              {dish.type}
                            </span>
                          </TableCell>

                          {/* Total Plates to Cook */}
                          <TableCell className="text-center font-black text-base text-amber-700 dark:text-amber-400 bg-amber-500/5 dark:bg-amber-500/10">
                            {dish.totalPortions}
                            <span className="text-xs font-normal text-muted-foreground ml-1">
                              {dish.totalPortions === 1 ? "plate" : "plates"}
                            </span>
                          </TableCell>

                          {/* Estimated Pieces Count */}
                          <TableCell className="text-center font-mono text-xs">
                            {dish.estimatedPieces ? (
                              <span className="font-bold text-foreground">
                                {dish.estimatedPieces} pcs
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>

                          {/* Slot Breakdown - Clean Compact Badges with Popover */}
                          <TableCell>
                            {dish.slots.length === 0 ? (
                              <span className="text-muted-foreground text-xs italic">
                                No batch assigned
                              </span>
                            ) : batchViewMode === "compact" && dish.slots.length > 2 ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {dish.slots.slice(0, 2).map((s, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md bg-muted/80 text-foreground border border-border/60 shadow-2xs"
                                    title={s.slotLabel}
                                  >
                                    <span className="text-muted-foreground font-medium">
                                      {formatSlotTimeShort(s.slotLabel)}
                                    </span>
                                    <span className="font-bold font-mono text-primary bg-primary/10 px-1 py-0.5 rounded text-[10px]">
                                      {s.quantity}
                                    </span>
                                  </span>
                                ))}

                                <Popover>
                                  <PopoverTrigger className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 hover:bg-amber-500/20 transition-all font-semibold cursor-pointer">
                                    <span>+{dish.slots.length - 2} more batches</span>
                                  </PopoverTrigger>
                                  <PopoverContent align="start" className="w-80 p-3 space-y-2.5 shadow-lg border-border">
                                    <div className="flex items-center justify-between border-b border-border pb-2">
                                      <div>
                                        <div className="font-bold text-xs text-foreground truncate max-w-[190px]">
                                          {dish.productName}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                          {dish.totalPortions} total {dish.totalPortions === 1 ? "plate" : "plates"}
                                        </div>
                                      </div>
                                      <Badge variant="outline" className="text-[10px] font-mono">
                                        {dish.slots.length} batches
                                      </Badge>
                                    </div>

                                    <div className="text-[11px] font-medium text-muted-foreground">
                                      Plates needed per dispatch window:
                                    </div>

                                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                      {dish.slots.map((s, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center justify-between p-1.5 rounded-md bg-muted/40 border border-border/40 text-xs"
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                            <span className="font-medium text-foreground">
                                              {formatSlotTimeShort(s.slotLabel)}
                                            </span>
                                          </div>
                                          <span className="font-bold font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[11px]">
                                            {s.quantity} {s.quantity === 1 ? "plate" : "plates"}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-1 w-full">
                                {dish.slots.map((s, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between px-1.5 py-0.5 rounded bg-muted/70 text-foreground border border-border/60 shadow-2xs text-[10.5px]"
                                    title={s.slotLabel}
                                  >
                                    <span className="text-muted-foreground font-medium truncate">
                                      {formatSlotTimeShort(s.slotLabel)}
                                    </span>
                                    <span className="font-bold font-mono text-primary ml-1">
                                      {s.quantity}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>

                          {/* Order Appearance Count */}
                          <TableCell className="text-right text-xs font-mono text-muted-foreground">
                            in {dish.orderCount} {dish.orderCount === 1 ? "order" : "orders"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Addons & Condiments Prep Table */}
              {data.addons.length > 0 && (
                <Card className="border-border/80 shadow-xs overflow-hidden">
                  <CardHeader className="py-3 px-4 bg-muted/40 border-b border-border/60">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-indigo-500" />
                      Add-ons, Chutneys & Condiments Required ({data.addons.length})
                    </CardTitle>
                  </CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead>Condiment / Add-on</TableHead>
                        <TableHead className="text-center font-bold">Total Units Required</TableHead>
                        <TableHead className="text-right">Orders Requesting</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.addons.map((a) => (
                        <TableRow key={a.addonId}>
                          <TableCell className="font-medium text-foreground">
                            {a.name}
                          </TableCell>
                          <TableCell className="text-center font-black text-indigo-600 dark:text-indigo-400 font-mono">
                            {a.totalQuantity} units
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground font-mono">
                            in {a.orderCount} orders
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>
          )}

          {/* TAB 2: BATCH / SLOT SCHEDULE (KITCHEN DISPATCH TIMINGS) */}
          {(activeTab === "slots" || typeof window === "undefined") && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.slots.map((slot) => (
                  <Card key={slot.slotId} className="border-border/80 shadow-xs">
                    <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-bold">
                            {slot.slotLabel}
                          </CardTitle>
                        </div>
                        <Badge variant="outline" className="text-xs font-mono font-semibold">
                          {slot.orderCount} {slot.orderCount === 1 ? "order" : "orders"}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs flex items-center gap-2 mt-1">
                        <span>Fulfillment: {slot.deliveryCount} delivery, {slot.pickupCount} pickup</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        Dishes to Cook for this Window:
                      </h5>
                      <div className="space-y-1.5 text-xs">
                        {slot.dishes.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-1.5 rounded bg-muted/40 border border-border/40"
                          >
                            <span className="font-medium flex items-center gap-1.5">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  item.type === "veg" ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                              {item.productName}
                            </span>
                            <span className="font-bold font-mono text-primary">
                              × {item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: KITCHEN SPECIAL NOTES & REQUESTS */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              {data.specialNotes.length === 0 ? (
                <Card className="p-8 text-center border-dashed">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <h4 className="font-semibold text-sm">No Special Requests</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    No custom dietary or delivery notes were provided for this date&apos;s orders.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.specialNotes.map((noteItem, idx) => (
                    <Card key={idx} className="border-amber-500/30 bg-amber-500/5">
                      <CardContent className="p-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">
                            Order #{noteItem.orderNumber}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {noteItem.orderType}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          Customer: {noteItem.customerName} ({noteItem.customerPhone}) • {noteItem.slotLabel}
                        </div>
                        <div className="p-2.5 rounded bg-background border border-amber-500/20 text-sm font-medium text-amber-950 dark:text-amber-200">
                          &ldquo;{noteItem.note}&rdquo;
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ORDER ROSTER FOR THE DAY */}
          {activeTab === "roster" && (
            <Card className="border-border/80 shadow-xs overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Fulfillment & Slot</TableHead>
                    <TableHead>Items Ordered</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((ord) => (
                    <TableRow key={ord.id}>
                      <TableCell className="font-mono font-bold text-foreground">
                        #{ord.orderNumber}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-semibold text-foreground">{ord.customerName}</div>
                        <div className="text-muted-foreground font-mono">{ord.customerPhone}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] uppercase font-semibold mr-1.5">
                          {ord.orderType}
                        </Badge>
                        <span className="text-muted-foreground">{ord.slotLabel}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="space-y-0.5">
                          {ord.items.map((it, i) => (
                            <div key={i} className="text-muted-foreground">
                              <span className="font-medium text-foreground">{it.productName}</span> × {it.quantity}
                              {it.addons && it.addons.length > 0 && (
                                <span className="text-[10px] ml-1 text-primary">
                                  ({it.addons.join(", ")})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {ord.notes && (
                          <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 italic">
                            Note: &ldquo;{ord.notes}&rdquo;
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground text-xs">
                        {formatCurrency(ord.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
