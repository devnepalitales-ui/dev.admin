"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  getCustomers,
  type CustomerOrderSummary,
  type CustomerRetentionStats,
} from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Users,
  RotateCcw,
  TrendingUp,
  ShoppingBag,
  Star,
  Search,
  Sparkles,
  PieChart as PieIcon,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Format currency amount in INR
 */
function formatCurrency(amount: number): string {
  if (!amount) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Cleanly formats date string
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return "-";
  }
}

// Chart configuration for shadcn ChartContainer
const retentionChartConfig = {
  repeat: {
    label: "Returning Customers",
    color: "#10b981", // Emerald 500
  },
  oneTime: {
    label: "First-Time Customers",
    color: "#64748b", // Slate 500
  },
} satisfies ChartConfig;

const frequencyChartConfig = {
  customers: {
    label: "Customer Count",
    color: "#6366f1", // Indigo 500
  },
} satisfies ChartConfig;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerOrderSummary[]>([]);
  const [stats, setStats] = useState<CustomerRetentionStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Pagination States
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Customer segment filter: all, returning (>1 order), first_time (1 order)
  const [segmentFilter, setSegmentFilter] = useState<"all" | "returning" | "first_time">("all");

  // Fetch Customers Data
  const fetchCustomerData = useCallback(
    async (searchQuery?: string, pageNumber: number = 1) => {
      setLoading(true);
      try {
        const res = await getCustomers({
          page: pageNumber,
          limit,
          search: searchQuery?.trim() || undefined,
        });

        if (res.success) {
          setCustomers(res.customers || []);
          setTotal(res.pagination.total);
          setTotalPages(res.pagination.totalPages);

          // If backend provided stats, use it
          if (res.stats) {
            setStats(res.stats);
          } else {
            // Client-side fallback calculation if backend has not been redeployed
            const list = res.customers || [];
            const totalCust = res.pagination.total || list.length;
            const repeatCust = list.filter(
              (c) => (c.orderCount ?? c.totalOrders ?? 0) > 1,
            ).length;
            const oneTimeCust = list.filter(
              (c) => (c.orderCount ?? c.totalOrders ?? 0) === 1,
            ).length;
            const repeatRate =
              list.length > 0
                ? Number(((repeatCust / list.length) * 100).toFixed(1))
                : 0;

            const totalSpent = list.reduce((acc, c) => acc + (c.totalSpent || 0), 0);
            const repeatSpent = list
              .filter((c) => (c.orderCount ?? c.totalOrders ?? 0) > 1)
              .reduce((acc, c) => acc + (c.totalSpent || 0), 0);

            const tier1 = list.filter(
              (c) => (c.orderCount ?? c.totalOrders ?? 0) === 1,
            ).length;
            const tier2 = list.filter(
              (c) => (c.orderCount ?? c.totalOrders ?? 0) === 2,
            ).length;
            const tier3to4 = list.filter((c) => {
              const cnt = c.orderCount ?? c.totalOrders ?? 0;
              return cnt >= 3 && cnt <= 4;
            }).length;
            const tier5plus = list.filter(
              (c) => (c.orderCount ?? c.totalOrders ?? 0) >= 5,
            ).length;

            setStats({
              totalCustomers: totalCust,
              repeatCustomers: repeatCust,
              oneTimeCustomers: oneTimeCust,
              repeatRate,
              totalOrders: list.reduce(
                (acc, c) => acc + (c.orderCount ?? c.totalOrders ?? 0),
                0,
              ),
              totalSpent,
              repeatSpent,
              repeatRevenuePercentage:
                totalSpent > 0 ? Number(((repeatSpent / totalSpent) * 100).toFixed(1)) : 0,
              avgOrdersPerCustomer:
                list.length > 0
                  ? Number(
                      (
                        list.reduce(
                          (acc, c) => acc + (c.orderCount ?? c.totalOrders ?? 0),
                          0,
                        ) / list.length
                      ).toFixed(1),
                    )
                  : 0,
              frequency: [
                { label: "1 Order (First-time)", count: tier1 },
                { label: "2 Orders (Returning)", count: tier2 },
                { label: "3–4 Orders (Regulars)", count: tier3to4 },
                { label: "5+ Orders (VIP Fans)", count: tier5plus },
              ],
            });
          }
        }
      } catch (err: any) {
        toast.error("Failed to load customer list: " + (err?.message || "Unknown error"));
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    fetchCustomerData(search, page);
  }, [fetchCustomerData, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomerData(search, 1);
  };

  const handleClearSearch = () => {
    setSearch("");
    setPage(1);
    fetchCustomerData("", 1);
  };

  // Filtered customer table data based on segment tab
  const filteredCustomers = useMemo(() => {
    if (segmentFilter === "all") return customers;
    return customers.filter((c) => {
      const cnt = c.orderCount ?? c.totalOrders ?? 0;
      if (segmentFilter === "returning") return cnt > 1;
      if (segmentFilter === "first_time") return cnt === 1;
      return true;
    });
  }, [customers, segmentFilter]);

  // Donut chart data for Customer Retention
  const retentionDonutData = useMemo(() => {
    if (!stats) return [];
    return [
      {
        name: "Returning Customers",
        value: stats.repeatCustomers,
        color: "#10b981", // Emerald
      },
      {
        name: "First-Time Customers",
        value: stats.oneTimeCustomers,
        color: "#64748b", // Slate
      },
    ];
  }, [stats]);

  // Frequency bar chart data
  const frequencyBarData = useMemo(() => {
    if (!stats?.frequency) return [];
    return stats.frequency.map((item) => ({
      tier: item.label.replace(/\s*\(.*\)/, ""), // Shorten label for clean X-axis
      fullLabel: item.label,
      customers: item.count,
    }));
  }, [stats]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <RotateCcw className="h-3.5 w-3.5" />
              Customer Retention & Analytics
            </span>
            {stats && (
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                {stats.repeatRate}% Coming Back
              </Badge>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Customer Orders & Retention
          </h2>
          <p className="text-muted-foreground text-sm">
            Monitor returning customer percentage, repeat purchase trends, and individual order history.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchCustomerData(search, page)}
          disabled={loading}
          className="text-xs self-start sm:self-auto cursor-pointer"
        >
          {loading ? "Refreshing..." : "Refresh Data"}
        </Button>
      </div>

      {/* ─── Executive Retention KPI Strip ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Returning Customer Rate (%) - Hero Metric */}
        <Card className="border-border/80 shadow-xs relative overflow-hidden bg-gradient-to-br from-emerald-500/5 via-card to-card border-emerald-500/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Returning Customer Rate
              </span>
              <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 font-bold uppercase tracking-wider">
                RETENTION
              </Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-foreground">
                {loading ? <Skeleton className="h-9 w-20" /> : `${stats?.repeatRate ?? 0}%`}
              </span>
              <span className="text-xs text-muted-foreground">customers coming back</span>
            </div>
            {/* Visual Progress Bar */}
            <div className="space-y-1 pt-1">
              <Progress
                value={stats?.repeatRate ?? 0}
                className="h-2 bg-emerald-950/20 dark:bg-emerald-950/40"
                indicatorClassName="bg-emerald-500"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{stats?.repeatCustomers ?? 0} Repeat</span>
                <span>{stats?.oneTimeCustomers ?? 0} First-Time</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Total Customer Base */}
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Total Unique Customers</span>
              <Users className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-3xl font-black text-foreground">
              {loading ? <Skeleton className="h-9 w-16" /> : stats?.totalCustomers ?? total}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {stats?.repeatCustomers ?? 0} Repeat ({stats?.repeatRate ?? 0}%)
              </span>
              <span>•</span>
              <span>{stats?.oneTimeCustomers ?? 0} New</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Repeat Customer Revenue */}
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Repeat Customer Revenue</span>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-3xl font-black text-foreground">
              {loading ? <Skeleton className="h-9 w-24" /> : formatCurrency(stats?.repeatSpent ?? 0)}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {stats?.repeatRevenuePercentage ?? 0}%
              </span>
              <span>of total customer sales</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Average Order Frequency */}
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Average Order Frequency</span>
              <ShoppingBag className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <div className="text-3xl font-black text-foreground">
              {loading ? <Skeleton className="h-9 w-14" /> : `${stats?.avgOrdersPerCustomer ?? 1.0}`}
              <span className="text-xs font-normal text-muted-foreground ml-1">orders/customer</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Across {stats?.totalOrders ?? 0} total lifetime customer orders
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Retention Visual Graphs Section (Interactive Donut & Frequency Bar) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Graph 1: Retention Donut Chart */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <PieIcon className="h-4 w-4 text-emerald-500" />
                  Customer Retention Ratio
                </CardTitle>
                <CardDescription className="text-xs">
                  Percentage of customers who return to order again vs. first-time buyers
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {stats?.repeatRate ?? 0}% Retention
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {loading ? (
              <div className="h-60 flex items-center justify-center">
                <Skeleton className="h-48 w-48 rounded-full" />
              </div>
            ) : retentionDonutData.length === 0 || (stats?.totalCustomers === 0) ? (
              <div className="h-60 flex flex-col items-center justify-center text-muted-foreground text-xs text-center border border-dashed rounded-lg">
                <PieIcon className="h-8 w-8 opacity-40 mb-2" />
                <span>No customer order data available yet.</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-around gap-4 h-60">
                {/* Donut Chart with Center % Metric */}
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={retentionDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {retentionDonutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Metric Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-foreground">
                      {stats?.repeatRate ?? 0}%
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                      Coming Back
                    </span>
                  </div>
                </div>

                {/* Donut Legend & Stats Breakdown */}
                <div className="space-y-3 min-w-[200px]">
                  {/* Returning */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-emerald-500" />
                      <div>
                        <div className="text-xs font-bold text-foreground">Returning Customers</div>
                        <div className="text-[10px] text-muted-foreground">Ordered 2+ times</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {stats?.repeatCustomers ?? 0}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {stats?.repeatRate ?? 0}%
                      </div>
                    </div>
                  </div>

                  {/* First Time */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-slate-500" />
                      <div>
                        <div className="text-xs font-bold text-foreground">First-Time Customers</div>
                        <div className="text-[10px] text-muted-foreground">Ordered 1 time</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-foreground">
                        {stats?.oneTimeCustomers ?? 0}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {stats && stats.totalCustomers > 0
                          ? (100 - stats.repeatRate).toFixed(1)
                          : 0}
                        %
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Graph 2: Order Frequency Distribution Bar Chart */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  Order Frequency & Loyalty Tiers
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribution of total orders placed per individual customer
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs font-mono">
                {stats?.totalOrders ?? 0} Total Orders
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {loading ? (
              <div className="h-60 flex items-center justify-center">
                <Skeleton className="h-48 w-full rounded-lg" />
              </div>
            ) : frequencyBarData.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center text-muted-foreground text-xs text-center border border-dashed rounded-lg">
                <BarChart3 className="h-8 w-8 opacity-40 mb-2" />
                <span>No order frequency data available.</span>
              </div>
            ) : (
              <ChartContainer config={frequencyChartConfig} className="h-60 w-full">
                <BarChart
                  data={frequencyBarData}
                  margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                  <XAxis
                    dataKey="tier"
                    tickLine={false}
                    axisLine={false}
                    className="text-[11px] font-medium"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    className="text-[11px]"
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, item) => (
                          <div className="flex items-center justify-between gap-4 text-xs font-medium">
                            <span className="text-muted-foreground">{item.payload.fullLabel}:</span>
                            <span className="font-bold font-mono text-foreground">{value} customers</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="customers"
                    fill="var(--color-customers, #6366f1)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Customer Search & Segment Filter Toolbar ─── */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Customer Segment Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant={segmentFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSegmentFilter("all")}
                className="h-8 text-xs font-medium cursor-pointer"
              >
                All Customers ({total})
              </Button>

              <Button
                variant={segmentFilter === "returning" ? "default" : "outline"}
                size="sm"
                onClick={() => setSegmentFilter("returning")}
                className={`h-8 text-xs font-semibold cursor-pointer ${
                  segmentFilter === "returning"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Returning ({stats?.repeatCustomers ?? 0})
              </Button>

              <Button
                variant={segmentFilter === "first_time" ? "default" : "outline"}
                size="sm"
                onClick={() => setSegmentFilter("first_time")}
                className="h-8 text-xs font-medium cursor-pointer"
              >
                First-Time ({stats?.oneTimeCustomers ?? 0})
              </Button>
            </div>

            {/* Search Input Form */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search name, phone, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Button type="submit" size="sm" className="h-8 text-xs cursor-pointer">
                Search
              </Button>
              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSearch}
                  className="h-8 text-xs cursor-pointer"
                >
                  Clear
                </Button>
              )}
            </form>
          </div>
        </CardContent>
      </Card>

      {/* ─── Detailed Customers Table ─── */}
      <Card className="border-border/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-xs">Customer Name</TableHead>
                <TableHead className="font-bold text-xs">Contact Info</TableHead>
                <TableHead className="text-center font-bold text-xs">Loyalty Status</TableHead>
                <TableHead className="text-center font-bold text-xs">Total Orders</TableHead>
                <TableHead className="text-right font-bold text-xs">Total Spent</TableHead>
                <TableHead className="text-right font-bold text-xs">Last Order Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-6 w-24 mx-auto rounded-full" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                    {search
                      ? `No customers matching "${search}".`
                      : segmentFilter !== "all"
                        ? `No ${segmentFilter === "returning" ? "returning" : "first-time"} customers found.`
                        : "No customers found in database."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((c) => {
                  const count = c.orderCount ?? c.totalOrders ?? 0;
                  const isRepeat = count > 1;
                  const isVIP = count >= 5;
                  const isRegular = count >= 3 && count < 5;

                  return (
                    <TableRow key={c.userId} className="hover:bg-muted/30">
                      {/* Name */}
                      <TableCell className="font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <div className={`flex size-7 items-center justify-center rounded-full text-[10px] font-bold ${
                            isVIP
                              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                              : isRepeat
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : "bg-muted text-muted-foreground"
                          }`}>
                            {c.username ? c.username.charAt(0).toUpperCase() : "C"}
                          </div>
                          <div>
                            <div>{c.username || "Customer"}</div>
                            <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[140px]">
                              {c.userId}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Contact Info */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-mono text-xs text-foreground">{c.phone || "-"}</div>
                          {c.email && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                              {c.email}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Loyalty Badge */}
                      <TableCell className="text-center">
                        {isVIP ? (
                          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 font-bold text-[10px] gap-1">
                            <Star className="h-3 w-3 fill-current text-amber-500" />
                            VIP ({count}x)
                          </Badge>
                        ) : isRegular ? (
                          <Badge className="bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 font-semibold text-[10px]">
                            Regular ({count}x)
                          </Badge>
                        ) : isRepeat ? (
                          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            Repeat ({count}x)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[10px]">
                            1st Order
                          </Badge>
                        )}
                      </TableCell>

                      {/* Total Orders */}
                      <TableCell className="text-center font-mono font-bold text-foreground">
                        {count} {count === 1 ? "order" : "orders"}
                      </TableCell>

                      {/* Total Spent */}
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        {formatCurrency(c.totalSpent)}
                      </TableCell>

                      {/* Last Order */}
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {formatDate(c.lastOrderAt)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-4 border-t text-xs text-muted-foreground bg-muted/20">
          <div>
            Showing {total === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} customers
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="h-8 text-xs cursor-pointer"
            >
              Previous
            </Button>
            <span className="text-xs font-medium">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-8 text-xs cursor-pointer"
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
