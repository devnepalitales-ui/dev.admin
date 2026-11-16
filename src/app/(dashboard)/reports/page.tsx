"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  getMonthlyReports,
  type MonthlyReportsResponse,
  type ReportTimelinePoint,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  IndianRupee,
  UtensilsCrossed,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  PackageCheck,
  Activity,
  CalendarCheck,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  revenue: {
    label: "Gross Revenue",
    color: "#10b981", // Emerald
  },
  orders: {
    label: "Paid Orders",
    color: "#3b82f6", // Blue
  },
  cancelledOrders: {
    label: "Cancelled Orders",
    color: "#f43f5e", // Rose
  },
} satisfies ChartConfig;

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Format a Date object to "YYYY-MM-DD" local/IST date string.
 */
function formatDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format a Date object to "YYYY-MM" string.
 */
function formatMonthKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export default function ReportsPage() {
  // Mode switcher: "daily" vs "monthly"
  const [reportMode, setReportMode] = useState<"daily" | "monthly">("daily");

  // Selected date for daily mode
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Selected month for monthly mode
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => new Date());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState<number>(() => new Date().getFullYear());

  const [activeChartMetric, setActiveChartMetric] = useState<"revenue" | "orders">("revenue");
  const [reportData, setReportData] = useState<MonthlyReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedDateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const selectedMonthKey = useMemo(() => formatMonthKey(selectedMonth), [selectedMonth]);

  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  const isCurrentMonth = useMemo(() => {
    const today = new Date();
    return (
      selectedMonth.getMonth() === today.getMonth() &&
      selectedMonth.getFullYear() === today.getFullYear()
    );
  }, [selectedMonth]);

  const formattedDateDisplay = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(selectedDate);
  }, [selectedDate]);

  const formattedDayFull = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(selectedDate);
  }, [selectedDate]);

  const formattedMonthFull = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
    }).format(selectedMonth);
  }, [selectedMonth]);

  // Fetch report data based on daily or monthly mode
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMonthlyReports(
        reportMode === "daily"
          ? { date: selectedDateKey }
          : { month: selectedMonthKey }
      );
      setReportData(res);
    } catch (err: any) {
      toast.error("Failed to load analytics: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [reportMode, selectedDateKey, selectedMonthKey]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Daily Stepper
  const handleShiftDay = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    if (next > new Date()) return;
    setSelectedDate(next);
  };

  // Monthly Stepper
  const handleShiftMonth = (delta: number) => {
    const next = new Date(selectedMonth);
    next.setMonth(next.getMonth() + delta);
    const now = new Date();
    if (
      next.getFullYear() > now.getFullYear() ||
      (next.getFullYear() === now.getFullYear() && next.getMonth() > now.getMonth())
    ) {
      return;
    }
    setSelectedMonth(next);
    setMonthPickerYear(next.getFullYear());
  };

  const handleSelectMonth = (monthIndex: number) => {
    const next = new Date(monthPickerYear, monthIndex, 1);
    setSelectedMonth(next);
    setMonthPickerOpen(false);
  };

  const summary = reportData?.summary;
  const topProducts = reportData?.topProducts || [];
  const timeline: ReportTimelinePoint[] = reportData?.timeline || [];

  const maxProductRevenue = Math.max(
    ...topProducts.map((p) => p.revenueGenerated),
    1,
  );

  // Peak statistics from timeline (hours for daily, days for monthly)
  const peakStats = useMemo(() => {
    if (!timeline || timeline.length === 0) {
      return { peakRevenue: 0, peakRevenueLabel: "—", peakOrders: 0, peakOrdersLabel: "—" };
    }
    let maxRev = 0;
    let maxRevItem: ReportTimelinePoint | null = null;
    let maxOrd = 0;
    let maxOrdItem: ReportTimelinePoint | null = null;

    for (const t of timeline) {
      if (t.revenue > maxRev) {
        maxRev = t.revenue;
        maxRevItem = t;
      }
      if (t.orders > maxOrd) {
        maxOrd = t.orders;
        maxOrdItem = t;
      }
    }

    return {
      peakRevenue: maxRev,
      peakRevenueLabel: maxRevItem ? `${maxRevItem.label} (₹${maxRev.toLocaleString("en-IN")})` : "—",
      peakOrders: maxOrd,
      peakOrdersLabel: maxOrdItem ? `${maxOrdItem.label} (${maxOrd} orders)` : "—",
    };
  }, [timeline]);

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Page Header with Mode Switcher & Date/Month Pickers ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              {reportMode === "daily" ? "Daily Reports & Analytics" : "Monthly Reports & Analytics"}
            </h2>
            <Badge variant="outline" className="border-primary/40 text-primary text-xs font-mono">
              Live Reports
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            {reportMode === "daily"
              ? `Gross revenue, orders volume, hourly trend, and top-selling momos for ${formattedDayFull}.`
              : `Total monthly revenue, order volume, daily performance trend, and top-selling momos for ${formattedMonthFull}.`}
          </p>
        </div>

        {/* Controls: Daily/Monthly Mode Toggle + Stepper */}
        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          {/* Daily vs Monthly Mode Switcher */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
            <Button
              type="button"
              variant={reportMode === "daily" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setReportMode("daily")}
              className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Daily
            </Button>
            <Button
              type="button"
              variant={reportMode === "monthly" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setReportMode("monthly")}
              className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Monthly
            </Button>
          </div>

          {/* Daily Mode Stepper & Picker */}
          {reportMode === "daily" ? (
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
              {/* Prev Day Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => handleShiftDay(-1)}
                title="Previous Day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* shadcn Popover with Calendar */}
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold shadow-xs transition-all cursor-pointer">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  <span>{isToday ? `Today (${formattedDateDisplay})` : formattedDateDisplay}</span>
                  <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        setCalendarOpen(false);
                      }
                    }}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>

              {/* Next Day Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer"
                onClick={() => handleShiftDay(1)}
                disabled={isToday}
                title="Next Day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            /* Monthly Mode Stepper & Picker */
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
              {/* Prev Month Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => handleShiftMonth(-1)}
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Month Selector Popover */}
              <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
                <PopoverTrigger className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold shadow-xs transition-all cursor-pointer">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  <span>{isCurrentMonth ? `This Month (${formattedMonthFull})` : formattedMonthFull}</span>
                  <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="end">
                  <div className="space-y-3">
                    {/* Year Stepper inside Popover */}
                    <div className="flex items-center justify-between border-b pb-2">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setMonthPickerYear((y) => y - 1)}
                        className="h-7 w-7 p-0 cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="font-bold text-xs">{monthPickerYear}</span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setMonthPickerYear((y) => y + 1)}
                        disabled={monthPickerYear >= new Date().getFullYear()}
                        className="h-7 w-7 p-0 cursor-pointer"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* 12-Month Grid */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {SHORT_MONTHS.map((mName, idx) => {
                        const now = new Date();
                        const isFuture =
                          monthPickerYear > now.getFullYear() ||
                          (monthPickerYear === now.getFullYear() && idx > now.getMonth());
                        const isSelected =
                          selectedMonth.getFullYear() === monthPickerYear &&
                          selectedMonth.getMonth() === idx;

                        return (
                          <Button
                            key={mName}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="xs"
                            disabled={isFuture}
                            onClick={() => handleSelectMonth(idx)}
                            className="h-8 text-xs cursor-pointer"
                          >
                            {isSelected && <Check className="h-3 w-3 mr-1" />}
                            {mName}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Next Month Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer"
                onClick={() => handleShiftMonth(1)}
                disabled={isCurrentMonth}
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Jump to Today / This Month Shortcut */}
          {reportMode === "daily" && !isToday && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold shadow-xs cursor-pointer"
              onClick={() => setSelectedDate(new Date())}
            >
              <CalendarCheck className="h-3.5 w-3.5 mr-1 text-primary" />
              Today
            </Button>
          )}

          {reportMode === "monthly" && !isCurrentMonth && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold shadow-xs cursor-pointer"
              onClick={() => {
                const now = new Date();
                setSelectedMonth(now);
                setMonthPickerYear(now.getFullYear());
              }}
            >
              <CalendarCheck className="h-3.5 w-3.5 mr-1 text-primary" />
              This Month
            </Button>
          )}

          <Badge
            variant="outline"
            className="text-xs font-medium px-2.5 py-1 border-border bg-card/80 flex items-center gap-1.5 text-muted-foreground"
          >
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>
              {reportData?.periodLabel ||
                (reportMode === "daily" ? formattedDayFull : formattedMonthFull)}
            </span>
          </Badge>
        </div>
      </div>

      {/* ─── KPI Stats Grid ─── */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Gross Revenue */}
        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {reportMode === "daily" ? "Total Gross Revenue" : "Total Monthly Revenue"}
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <IndianRupee className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-28 my-1" />
            ) : (
              <div className="text-2xl font-bold text-foreground font-mono">
                ₹{summary?.totalRevenue.toLocaleString("en-IN") || 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-semibold">•</span>
              {reportMode === "daily"
                ? "Excludes cancelled / refunded orders on this day"
                : `Gross sales across ${formattedMonthFull}`}
            </p>
          </CardContent>
        </Card>

        {/* Delivered / Paid Orders */}
        <Card className="border-border/80 bg-card/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {reportMode === "daily" ? "Delivered / Paid Orders" : "Monthly Paid Orders"}
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 my-1" />
            ) : (
              <div className="text-2xl font-bold text-foreground font-mono">
                {summary?.paidOrdersCount || 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Total placed: <strong className="text-foreground">{summary?.totalOrdersCount || 0}</strong>{" "}
              {reportMode === "daily" ? "orders on this day" : `orders in ${formattedMonthFull}`}
            </p>
          </CardContent>
        </Card>

        {/* Average Order Value (AOV) */}
        <Card className="border-border/80 bg-card/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Average Order Value (AOV)
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold text-foreground font-mono">
                ₹{summary?.avgOrderValue.toLocaleString("en-IN") || 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              {reportMode === "daily"
                ? "Per completed order on this day"
                : `Average per order across ${formattedMonthFull}`}
            </p>
          </CardContent>
        </Card>

        {/* Cancelled Orders */}
        <Card className="border-rose-500/20 bg-rose-500/5 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cancelled Orders
            </CardTitle>
            <Badge variant="outline" className="text-[11px] font-bold border-rose-500/30 text-rose-400 bg-rose-500/10 py-0">
              {summary && summary.totalOrdersCount > 0
                ? `${Math.round((summary.cancelledOrdersCount / summary.totalOrdersCount) * 100)}%`
                : "0%"}
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 my-1" />
            ) : (
              <div className="text-2xl font-bold text-rose-400 font-mono">
                {summary?.cancelledOrdersCount || 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              {reportMode === "daily"
                ? "Customer or kitchen cancellations on this day"
                : `Cancellations across ${formattedMonthFull}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Hero Performance Graph (Hourly for Daily, Day-by-Day for Monthly) ─── */}
      <Card className="border-border/80 bg-card/80 shadow-md">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>
                {reportMode === "daily"
                  ? "Hourly Performance & Order Trend"
                  : "Daily Performance & Order Trend"}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              {reportMode === "daily"
                ? `Hourly revenue and order volume across ${reportData?.periodLabel || formattedDayFull}.`
                : `Day-by-day revenue and order volume across ${formattedMonthFull}.`}
            </CardDescription>
          </div>

          {/* Metric switcher buttons */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/80 self-start sm:self-auto">
            <Button
              type="button"
              size="sm"
              variant={activeChartMetric === "revenue" ? "secondary" : "ghost"}
              onClick={() => setActiveChartMetric("revenue")}
              className="text-xs h-7 px-3 gap-1.5 font-medium cursor-pointer"
            >
              <IndianRupee className="h-3 w-3 text-emerald-400" />
              Revenue (₹)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeChartMetric === "orders" ? "secondary" : "ghost"}
              onClick={() => setActiveChartMetric("orders")}
              className="text-xs h-7 px-3 gap-1.5 font-medium cursor-pointer"
            >
              <PackageCheck className="h-3 w-3 text-blue-400" />
              Orders Volume
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Quick Graph Summary Micro-Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-muted/20 border border-border/60 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                {reportMode === "daily" ? "Day Revenue" : "Month Revenue"}
              </span>
              <p className="text-sm font-bold text-emerald-400 font-mono">
                ₹{summary?.totalRevenue.toLocaleString("en-IN") || 0}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                {reportMode === "daily" ? "Peak Revenue Hour" : "Peak Revenue Day"}
              </span>
              <p className="text-sm font-bold text-foreground truncate">
                {peakStats.peakRevenue > 0 ? peakStats.peakRevenueLabel : "No orders yet"}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                {reportMode === "daily" ? "Peak Order Volume" : "Peak Order Day"}
              </span>
              <p className="text-sm font-bold text-blue-400 truncate">
                {peakStats.peakOrders > 0 ? peakStats.peakOrdersLabel : "No orders yet"}
              </p>
            </div>
          </div>

          {/* Interactive Responsive Graph with shadcn ChartContainer */}
          {loading ? (
            <div className="h-70 w-full flex items-center justify-center">
              <Skeleton className="h-65 w-full rounded-xl" />
            </div>
          ) : timeline.length === 0 || (summary?.totalOrdersCount === 0 && summary?.totalRevenue === 0) ? (
            <div className="h-65 w-full flex flex-col items-center justify-center space-y-2 text-muted-foreground border border-dashed rounded-xl p-6 text-center">
              <BarChart3 className="h-8 w-8 opacity-40 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground">
                No orders recorded for {reportMode === "daily" ? formattedDateDisplay : formattedMonthFull}
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm">
                Select another {reportMode === "daily" ? "date" : "month"} using the selector above.
              </p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-70 w-full">
              {activeChartMetric === "revenue" ? (
                <AreaChart
                  data={timeline}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={reportMode === "daily" ? 24 : 16}
                    className="text-[11px] fill-muted-foreground font-mono"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(val) => `₹${val}`}
                    className="text-[11px] fill-muted-foreground font-mono"
                  />
                  <ChartTooltip
                    cursor={{ stroke: "rgba(16, 185, 129, 0.3)", strokeWidth: 1 }}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload as ReportTimelinePoint | undefined;
                          return item
                            ? reportMode === "daily"
                              ? `Hour: ${item.label}`
                              : `Date: ${item.label}`
                            : "";
                        }}
                        formatter={(value, name) => {
                          if (name === "revenue") {
                            return (
                              <div className="flex items-center justify-between w-full gap-4">
                                <span className="text-muted-foreground">Revenue</span>
                                <span className="font-bold font-mono text-emerald-400">
                                  ₹{Number(value).toLocaleString("en-IN")}
                                </span>
                              </div>
                            );
                          }
                          if (name === "orders") {
                            return (
                              <div className="flex items-center justify-between w-full gap-4">
                                <span className="text-muted-foreground">Orders</span>
                                <span className="font-bold font-mono text-blue-400">
                                  {value} orders
                                </span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#fillRevenue)"
                  />
                </AreaChart>
              ) : (
                <BarChart
                  data={timeline}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={reportMode === "daily" ? 24 : 16}
                    className="text-[11px] fill-muted-foreground font-mono"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-[11px] fill-muted-foreground font-mono"
                  />
                  <ChartTooltip
                    cursor={{ fill: "rgba(59, 130, 246, 0.08)" }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload as ReportTimelinePoint | undefined;
                          return item
                            ? reportMode === "daily"
                              ? `Hour: ${item.label}`
                              : `Date: ${item.label}`
                            : "";
                        }}
                        formatter={(value, name) => {
                          if (name === "orders") {
                            return (
                              <div className="flex items-center justify-between w-full gap-4">
                                <span className="text-muted-foreground">Paid Orders</span>
                                <span className="font-bold font-mono text-blue-400">
                                  {value}
                                </span>
                              </div>
                            );
                          }
                          if (name === "cancelledOrders") {
                            return (
                              <div className="flex items-center justify-between w-full gap-4">
                                <span className="text-muted-foreground">Cancelled</span>
                                <span className="font-bold font-mono text-rose-400">
                                  {value}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="orders"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={reportMode === "daily" ? 30 : 16}
                  />
                  <Bar
                    dataKey="cancelledOrders"
                    fill="#f43f5e"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={reportMode === "daily" ? 30 : 16}
                  />
                </BarChart>
              )}
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* ─── Top Selling Momos & Menu Items ─── */}
      <Card className="border-border/80 bg-card/80 shadow-md">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-amber-500" />
                <span>Top Selling Momos &amp; Menu Items</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {reportMode === "daily"
                  ? `Ranked by volume sold and revenue contribution on ${reportData?.periodLabel || formattedDayFull}.`
                  : `Ranked by volume sold and revenue contribution across ${formattedMonthFull}.`}
              </CardDescription>
            </div>
            {topProducts.length > 0 && (
              <Badge variant="outline" className="font-mono text-xs">
                {topProducts.length} Items Sold
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60">
                  <TableHead className="w-20">Rank</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Units Sold</TableHead>
                  <TableHead>Revenue Generated</TableHead>
                  <TableHead className="w-45">Contribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-3 w-28" /></TableCell>
                    </TableRow>
                  ))
                ) : topProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-sm">
                      <div className="flex flex-col items-center justify-center">
                        <UtensilsCrossed className="h-6 w-6 mb-1 opacity-40" />
                        <p className="text-xs">
                          No product sales recorded for {reportMode === "daily" ? "this date" : "this month"}.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  topProducts.map((prod, idx) => {
                    const percent = Math.min(100, Math.round((prod.revenueGenerated / maxProductRevenue) * 100));

                    return (
                      <TableRow key={prod.productId} className="hover:bg-muted/40 border-border/50">
                        <TableCell className="font-bold text-sm">
                          {idx === 0 ? (
                            <span className="flex items-center gap-1 text-amber-400 font-bold">
                              #1
                            </span>
                          ) : idx === 1 ? (
                            <span className="flex items-center gap-1 text-zinc-300 font-bold">
                              #2
                            </span>
                          ) : idx === 2 ? (
                            <span className="flex items-center gap-1 text-amber-600 font-bold">
                              #3
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-medium">#{idx + 1}</span>
                          )}
                        </TableCell>

                        <TableCell className="font-medium text-xs text-foreground">
                          {prod.productName}
                        </TableCell>

                        <TableCell className="text-center font-bold text-xs">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {prod.quantitySold} plates
                          </Badge>
                        </TableCell>

                        <TableCell className="font-semibold text-xs text-emerald-400 font-mono">
                          ₹{prod.revenueGenerated.toLocaleString("en-IN")}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground w-8 text-right">
                              {percent}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
