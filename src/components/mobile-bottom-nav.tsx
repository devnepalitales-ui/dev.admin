"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrderEvents } from "@/hooks/use-order-events";
import { useSidebar } from "@/components/ui/sidebar";
import {
  ShoppingBag,
  ChefHat,
  Clock,
  Truck,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { counts } = useOrderEvents();
  const { setOpenMobile } = useSidebar();

  const navItems = [
    {
      label: "Orders",
      href: "/orders",
      icon: ShoppingBag,
      badge: counts?.placed ? (counts.placed > 99 ? "99+" : counts.placed) : null,
    },
    {
      label: "Kitchen",
      href: "/inventory-prep",
      icon: ChefHat,
    },
    {
      label: "Window",
      href: "/order-windows",
      icon: Clock,
    },
    {
      label: "Dispatch",
      href: "/dispatch-windows",
      icon: Truck,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/80 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg">
      <div className="grid grid-cols-5 items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 h-full transition-colors",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
                {item.badge != null && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight truncate">{item.label}</span>
            </Link>
          );
        })}

        {/* Menu button opens sidebar drawer */}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex flex-col items-center justify-center gap-0.5 h-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] tracking-tight">Menu</span>
        </button>
      </div>
    </nav>
  );
}
