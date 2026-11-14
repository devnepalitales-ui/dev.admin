"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getCustomers,
  getCustomerDetails,
  type CustomerOrderSummary,
  type CustomerStats,
  type CustomerDetailResponse,
  type OrderStatus,
} from "@/lib/api";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  ShoppingBag,
  TrendingUp,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Eye,
  Phone,
  Mail,
  Calendar,
  Clock,
  ArrowUpDown,
  MapPin,
  Copy,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Award,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Format currency amount in INR
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Cleanly formats date
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return "Invalid date";
  }
}

/**
 * Relative time formatter for recent activity
 */
function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "No orders yet";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return "Unknown";
  }
}

/**
 * Export customer summary to CSV
 */
function exportCustomersToCsv(customers: CustomerOrderSummary[]) {
  if (customers.length === 0) {
    toast.info("No customer data available to export.");
    return;
  }

  const headers = [
    "User ID",
    "Customer Name",
    "Phone",
    "Email",
    "Verified",
    "Total Orders Placed",
    "Delivered Orders",
    "Cancelled Orders",
    "Active Orders",
    "Total Spent (INR)",
    "First Order Date",
    "Last Order Date",
    "Registered Date",
  ];

  const rows = customers.map((c) => [
    `"${c.userId}"`,
    `"${c.username.replace(/"/g, '""')}"`,
    `"${c.phone || ""}"`,
    `"${c.email || ""}"`,
    c.isVerified ? "Yes" : "No",
    c.totalOrders,
    c.deliveredOrders,
    c.cancelledOrders,
    c.activeOrders,
    c.totalSpent,
    c.firstOrderAt ? `"${formatDate(c.firstOrderAt)}"` : `"N/A"`,
    c.lastOrderAt ? `"${formatDate(c.lastOrderAt)}"` : `"N/A"`,
    `"${formatDate(c.registeredAt)}"`,
  ]);

  const csvContent =
    "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `nepali_tales_customer_order_insights_${new Date().toISOString().slice(0, 10)}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success("Customer order data exported successfully!");
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerOrderSummary[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    totalCustomers: 0,
    orderingCustomers: 0,
    repeatCustomers: 0,
    frequentCustomers: 0,
    totalOrdersPlaced: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "ordered" | "repeat" | "frequent" | "no_orders">("all");
  const [sortBy, setSortBy] = useState<"orders" | "spent" | "recent" | "joined" | "name">("orders");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination States
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Customer Detail Modal States
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetailResponse["customer"] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch Customers Data
  const fetchCustomerData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCustomers({
        page,
        limit,
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
        filter,
      });

      if (res.success) {
        setCustomers(res.customers);
        setStats(res.stats);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
      }
    } catch (err: any) {
      toast.error("Failed to load customer order insights: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder, filter]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  // Fetch individual customer profile & order history
  const handleOpenCustomerDetail = async (userId: string) => {
    setSelectedUserId(userId);
    setLoadingDetail(true);
    setCustomerDetail(null);
    try {
      const res = await getCustomerDetails(userId);
      if (res.success) {
        setCustomerDetail(res.customer);
      }
    } catch (err: any) {
      toast.error("Failed to load customer details: " + (err?.message || "Unknown error"));
    } finally {
      setLoadingDetail(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const repeatCustomerRate = useMemo(() => {
    if (!stats.orderingCustomers) return 0;
    return Math.round((stats.repeatCustomers / stats.orderingCustomers) * 100);
  }, [stats]);

  const avgOrdersPerCustomer = useMemo(() => {
    if (!stats.orderingCustomers) return "0.0";
    return (stats.totalOrdersPlaced / stats.orderingCustomers).toFixed(1);
  }, [stats]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              <Users className="h-3.5 w-3.5" />
              Customer Analytics
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Customer Order Frequency
          </h2>
          <p className="text-muted-foreground text-sm">
            Monitor how many times each customer has ordered, track loyalty frequency, and inspect complete order histories.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCustomersToCsv(customers)}
            disabled={loading || customers.length === 0}
            className="text-xs gap-1.5 h-9"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCustomerData}
            disabled={loading}
            className="text-xs gap-1.5 h-9"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Customers
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalCustomers.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>{stats.orderingCustomers} placed at least 1 order</span>
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Repeat Customers (2+ Orders)
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Sparkles className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.repeatCustomers.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="font-semibold text-foreground">{repeatCustomerRate}%</span>
              <span>repeat customer retention rate</span>
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              VIP Customers (5+ Orders)
            </CardTitle>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
              <Award className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {stats.frequentCustomers.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>Highly loyal frequent momo lovers</span>
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Orders & Avg
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.totalOrdersPlaced.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="font-semibold text-foreground">{avgOrdersPerCustomer}</span>
              <span>orders per ordering customer</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="shadow-xs border-border/80">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer name, phone, email, or user ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setFilter("all");
                  setPage(1);
                }}
                className="h-8 text-xs"
              >
                All Customers ({stats.totalCustomers})
              </Button>
              <Button
                variant={filter === "ordered" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setFilter("ordered");
                  setPage(1);
                }}
                className="h-8 text-xs"
              >
                Ordered (1+) ({stats.orderingCustomers})
              </Button>
              <Button
                variant={filter === "repeat" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setFilter("repeat");
                  setPage(1);
                }}
                className="h-8 text-xs"
              >
                Repeat (2+) ({stats.repeatCustomers})
              </Button>
              <Button
                variant={filter === "frequent" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setFilter("frequent");
                  setPage(1);
                }}
                className="h-8 text-xs"
              >
                VIP (5+) ({stats.frequentCustomers})
              </Button>
              <Button
                variant={filter === "no_orders" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setFilter("no_orders");
                  setPage(1);
                }}
                className="h-8 text-xs text-muted-foreground"
              >
                0 Orders ({Math.max(0, stats.totalCustomers - stats.orderingCustomers)})
              </Button>
            </div>
          </div>

          {/* Sort & Limit Options */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">Sort By:</span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { key: "orders", label: "Orders Count" },
                    { key: "spent", label: "Total Spent" },
                    { key: "recent", label: "Last Order" },
                    { key: "joined", label: "Registration Date" },
                    { key: "name", label: "Name (A-Z)" },
                  ] as const
                ).map((s) => (
                  <Button
                    key={s.key}
                    variant={sortBy === s.key ? "secondary" : "ghost"}
                    size="xs"
                    onClick={() => {
                      if (sortBy === s.key) {
                        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                      } else {
                        setSortBy(s.key);
                        setSortOrder(s.key === "name" || s.key === "joined" ? "asc" : "desc");
                      }
                      setPage(1);
                    }}
                    className="h-7 text-xs font-normal"
                  >
                    {s.label}
                    {sortBy === s.key && (
                      <ArrowUpDown className="h-3 w-3 ml-1 opacity-70" />
                    )}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span>Per page:</span>
              {[10, 20, 50].map((pageSize) => (
                <Button
                  key={pageSize}
                  variant={limit === pageSize ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => {
                    setLimit(pageSize);
                    setPage(1);
                  }}
                  className="h-6 w-7 p-0 text-xs"
                >
                  {pageSize}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Customers Table */}
      <Card className="shadow-xs border-border/80 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[280px]">Customer</TableHead>
                <TableHead className="w-[220px]">Contact Info</TableHead>
                <TableHead className="w-[180px] text-center">
                  Orders Placed
                </TableHead>
                <TableHead className="w-[200px]">Order Statuses</TableHead>
                <TableHead className="w-[150px] text-right">Total Spent</TableHead>
                <TableHead className="w-[160px]">Last Order</TableHead>
                <TableHead className="w-[120px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-36 mt-1" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-6 w-20 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-16 ml-auto" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-20 ml-auto rounded-md" />
                    </TableCell>
                  </TableRow>
                ))
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="p-3 rounded-full bg-muted text-muted-foreground">
                        <Users className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-foreground">No customers found</p>
                      <p className="text-xs text-muted-foreground">
                        {search
                          ? `No customers match your search query "${search}". Try clearing search filters.`
                          : filter !== "all"
                          ? `No customers match the "${filter}" filter.`
                          : "No customers have registered in the store yet."}
                      </p>
                      {(search || filter !== "all") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearch("");
                            setFilter("all");
                          }}
                          className="mt-2 text-xs"
                        >
                          Reset Filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => {
                  const isVip = c.totalOrders >= 5;
                  const isRepeat = c.totalOrders >= 2 && c.totalOrders < 5;
                  const isFirstTimer = c.totalOrders === 1;

                  return (
                    <TableRow key={c.userId} className="hover:bg-muted/30 transition-colors">
                      {/* Customer Info */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                              isVip
                                ? "bg-amber-500/20 text-amber-600 border border-amber-500/30"
                                : isRepeat
                                ? "bg-blue-500/15 text-blue-600 border border-blue-500/25"
                                : c.totalOrders > 0
                                ? "bg-emerald-500/15 text-emerald-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {c.username.slice(0, 2) || "CU"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
                              <span className="truncate">{c.username}</span>
                              {c.isVerified && (
                                <span title="Verified Customer">
                                  <ShieldCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              <span>Joined {formatDate(c.registeredAt)}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Contact Info */}
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          {c.phone ? (
                            <div className="flex items-center gap-1.5 text-foreground font-mono">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <a
                                href={`tel:${c.phone}`}
                                className="hover:underline hover:text-primary transition-colors"
                              >
                                {c.phone}
                              </a>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">No phone</span>
                          )}

                          {c.email ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[200px]">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate" title={c.email}>
                                {c.email}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>

                      {/* Total Orders Placed (Primary Feature) */}
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <Badge
                            variant={
                              isVip
                                ? "default"
                                : isRepeat
                                ? "secondary"
                                : isFirstTimer
                                ? "outline"
                                : "outline"
                            }
                            className={`px-3 py-1 font-semibold text-xs tracking-wide ${
                              isVip
                                ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                                : isRepeat
                                ? "bg-blue-600 hover:bg-blue-700 text-white"
                                : isFirstTimer
                                ? "border-emerald-500/40 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                                : "text-muted-foreground border-dashed"
                            }`}
                          >
                            {c.totalOrders === 1 ? "1 Order" : `${c.totalOrders} Orders`}
                          </Badge>

                          {isVip && (
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-0.5">
                              <Award className="h-3 w-3" /> VIP Patron
                            </span>
                          )}
                          {isRepeat && (
                            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                              <Sparkles className="h-3 w-3" /> Repeat Customer
                            </span>
                          )}
                          {isFirstTimer && (
                            <span className="text-[10px] text-muted-foreground">
                              First-time Order
                            </span>
                          )}
                          {c.totalOrders === 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              No orders yet
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Status Breakdown */}
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {c.totalOrders > 0 ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                <span className="text-muted-foreground">Delivered:</span>
                                <span className="font-semibold text-foreground">
                                  {c.deliveredOrders}
                                </span>
                              </div>
                              {c.activeOrders > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500 shrink-0 animate-pulse" />
                                  <span className="text-blue-600 font-medium">Active now:</span>
                                  <span className="font-bold text-blue-600">
                                    {c.activeOrders}
                                  </span>
                                </div>
                              )}
                              {c.cancelledOrders > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="inline-block h-2 w-2 rounded-full bg-rose-400 shrink-0" />
                                  <span className="text-muted-foreground">Cancelled:</span>
                                  <span className="text-rose-500 font-medium">
                                    {c.cancelledOrders}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">None</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Total Spent */}
                      <TableCell className="text-right font-medium">
                        <div className="text-sm font-bold text-foreground">
                          {formatCurrency(c.totalSpent)}
                        </div>
                        {c.totalOrders > 0 && (
                          <div className="text-[11px] text-muted-foreground">
                            avg {formatCurrency(Math.round(c.totalSpent / (c.totalOrders - c.cancelledOrders || 1)))}/ord
                          </div>
                        )}
                      </TableCell>

                      {/* Last Order */}
                      <TableCell>
                        <div className="text-xs">
                          <div className="font-medium text-foreground">
                            {formatRelativeTime(c.lastOrderAt)}
                          </div>
                          {c.lastOrderAt && (
                            <div className="text-[11px] text-muted-foreground">
                              {formatDate(c.lastOrderAt)}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Action */}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenCustomerDetail(c.userId)}
                          className="h-8 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Orders</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border/80 bg-muted/20 text-xs">
          <div className="text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {total === 0 ? 0 : (page - 1) * limit + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {Math.min(page * limit, total)}
            </span>{" "}
            of <span className="font-semibold text-foreground">{total}</span> customers
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="h-8 text-xs gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>

            <span className="px-2 text-xs font-medium text-muted-foreground">
              Page {page} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="xs"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-8 text-xs gap-1"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Customer Details & Complete Order History Modal */}
      <Dialog
        open={Boolean(selectedUserId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUserId(null);
            setCustomerDetail(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <span>{customerDetail?.username || "Customer Profile"}</span>
                  {customerDetail?.isVerified && (
                    <Badge variant="outline" className="text-blue-500 border-blue-500/30 text-[10px] gap-1">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  User ID: <span className="font-mono text-foreground">{selectedUserId}</span>
                  <button
                    onClick={() => selectedUserId && copyToClipboard(selectedUserId, "User ID")}
                    className="ml-1.5 inline-flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </DialogDescription>
              </div>

              {customerDetail && (
                <Badge
                  variant={customerDetail.stats.totalOrders >= 5 ? "default" : "secondary"}
                  className="px-3 py-1 text-xs font-semibold"
                >
                  {customerDetail.stats.totalOrders} Total Orders
                </Badge>
              )}
            </div>
          </DialogHeader>

          {loadingDetail ? (
            <div className="space-y-4 py-6">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-36 w-full rounded-lg" />
              <Skeleton className="h-44 w-full rounded-lg" />
            </div>
          ) : !customerDetail ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Unable to load customer details.
            </div>
          ) : (
            <div className="space-y-6 pt-2">
              {/* Customer Contact & Meta Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Phone Number</span>
                  {customerDetail.phone ? (
                    <div className="flex items-center gap-1.5 font-mono font-medium text-foreground">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <a href={`tel:${customerDetail.phone}`} className="hover:underline">
                        {customerDetail.phone}
                      </a>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">Not provided</span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Email Address</span>
                  {customerDetail.email ? (
                    <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{customerDetail.email}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">Not provided</span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Member Since</span>
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{formatDate(customerDetail.registeredAt)}</span>
                  </div>
                </div>
              </div>

              {/* Lifetime Value / Ordering Frequency Metrics */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  Lifetime Order Performance
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <span className="text-[11px] text-muted-foreground block">Total Orders</span>
                    <span className="text-xl font-bold text-foreground">
                      {customerDetail.stats.totalOrders}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {customerDetail.stats.deliveredOrders} delivered, {customerDetail.stats.cancelledOrders} cancelled
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card">
                    <span className="text-[11px] text-muted-foreground block">Total Spend</span>
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(customerDetail.stats.totalSpent)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Lifetime revenue
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card">
                    <span className="text-[11px] text-muted-foreground block">Avg Order Value</span>
                    <span className="text-xl font-bold text-foreground">
                      {formatCurrency(customerDetail.stats.avgOrderValue)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Per successful order
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card">
                    <span className="text-[11px] text-muted-foreground block">Last Order</span>
                    <span className="text-sm font-bold text-foreground truncate block">
                      {customerDetail.stats.lastOrderAt
                        ? formatRelativeTime(customerDetail.stats.lastOrderAt)
                        : "Never"}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {formatDate(customerDetail.stats.lastOrderAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Saved Delivery Addresses */}
              {customerDetail.addresses && customerDetail.addresses.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    Saved Addresses ({customerDetail.addresses.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {customerDetail.addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="p-2.5 rounded-lg border border-border/80 bg-muted/20 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{addr.label}</span>
                          {addr.isDefault && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                          {[addr.flatNumber, addr.building, addr.street, addr.city, addr.pincode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chronological Orders List */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                  Order History ({customerDetail.orders.length})
                </h4>

                {customerDetail.orders.length === 0 ? (
                  <div className="p-8 text-center rounded-lg border border-dashed border-border text-muted-foreground text-xs">
                    This customer has not placed any orders yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerDetail.orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors space-y-2.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-sm text-foreground">
                              #{ord.orderNumber}
                            </span>
                            <OrderStatusBadge status={ord.status} />
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {ord.orderType}
                            </Badge>
                          </div>

                          <div className="text-right">
                            <span className="font-bold text-sm text-foreground">
                              {formatCurrency(ord.totalAmount)}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              {formatDate(ord.createdAt)} at{" "}
                              {new Date(ord.createdAt).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Order Items Breakdown */}
                        {ord.items && ord.items.length > 0 && (
                          <div className="pt-2 border-t border-border/60">
                            <span className="text-[11px] text-muted-foreground block mb-1">
                              Items Ordered ({ord.itemsCount}):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {ord.items.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[11px] text-foreground"
                                >
                                  <span className="font-medium">{item.productName}</span>
                                  <span className="text-muted-foreground font-mono">
                                    ×{item.quantity}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {ord.dispatchDate && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            <span>
                              Scheduled for {ord.dispatchDate}{" "}
                              {ord.dispatchSlot?.label ? `(${ord.dispatchSlot.label})` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
