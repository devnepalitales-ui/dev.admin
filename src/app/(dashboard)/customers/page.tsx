"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getCustomers,
  type CustomerOrderSummary,
} from "@/lib/api";
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
import { Skeleton } from "@/components/ui/skeleton";
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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Pagination States
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch Customers Data
  const fetchCustomerData = useCallback(async (searchQuery?: string, pageNumber: number = 1) => {
    setLoading(true);
    try {
      const res = await getCustomers({
        page: pageNumber,
        limit,
        search: searchQuery?.trim() || undefined,
      });

      if (res.success) {
        setCustomers(res.customers);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
      }
    } catch (err: any) {
      toast.error("Failed to load customer list: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [limit]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Customer Orders
          </h2>
          <p className="text-muted-foreground text-sm">
            Overview of customer order counts and total spend.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchCustomerData(search, page)}
          disabled={loading}
          className="text-xs self-start sm:self-auto"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md">
            <Input
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-sm"
            />
            <Button type="submit" size="sm" className="h-9 text-xs">
              Search
            </Button>
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSearch}
                className="h-9 text-xs"
              >
                Clear
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Simple Customers Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Total Orders</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-right">Last Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                    {search ? `No customers matching "${search}".` : "No customers found."}
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => {
                  const count = c.orderCount ?? c.totalOrders ?? 0;
                  return (
                    <TableRow key={c.userId}>
                      <TableCell className="font-medium text-foreground">
                        {c.username || "Customer"}
                      </TableCell>

                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.phone || "-"}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {c.email || "-"}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge
                          variant={count > 0 ? "secondary" : "outline"}
                          className="font-semibold text-xs"
                        >
                          {count === 1 ? "1 order" : `${count} orders`}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        {formatCurrency(c.totalSpent)}
                      </TableCell>

                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDate(c.lastOrderAt)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Simple Pagination */}
        <div className="flex items-center justify-between p-4 border-t text-xs text-muted-foreground">
          <div>
            Showing {total === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} customers
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="h-8 text-xs"
            >
              Previous
            </Button>
            <span className="text-xs">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-8 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
