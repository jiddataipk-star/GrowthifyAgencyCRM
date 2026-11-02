import {
  CreditCard,
  FileText,
  Filter,
  Folder,
  Home,
  Repeat,
  Settings,
  UserRound,
  Users,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types/db";

export type NavItem = { href: string; label: string; icon: LucideIcon; finance: boolean };

/** Sidebar order from the brief. `finance` items are hidden from Staff. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: Home, finance: true },
  { href: "/clients", label: "Clients", icon: Users, finance: true },
  { href: "/leads", label: "Leads", icon: Filter, finance: true },
  { href: "/projects", label: "Projects", icon: Folder, finance: false },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat, finance: true },
  { href: "/payments", label: "Payments", icon: CreditCard, finance: true },
  { href: "/invoices", label: "Invoices", icon: FileText, finance: true },
  { href: "/team", label: "Team", icon: UserRound, finance: true },
  { href: "/social", label: "Social", icon: BarChart3, finance: true },
  { href: "/settings", label: "Settings", icon: Settings, finance: false },
];

export function navFor(role: Role): NavItem[] {
  return role === "staff" ? NAV_ITEMS.filter((item) => !item.finance) : NAV_ITEMS;
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Top-bar title for the current route. */
export function titleFor(pathname: string): string {
  const match = [...NAV_ITEMS].reverse().find((item) => isActive(pathname, item.href));
  return match?.label ?? "Growthify OS";
}
