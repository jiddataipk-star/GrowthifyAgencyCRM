import {
  ArrowLeftRight,
  BarChart3,
  Filter,
  Folder,
  HandCoins,
  Home,
  MessageCircleMore,
  Repeat,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types/db";

export type NavItem = { href: string; label: string; icon: LucideIcon; finance: boolean; group: "work" | "money" | "agency" };

/** Sidebar order. `finance` items are hidden from Staff. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: Home, finance: true, group: "work" },
  { href: "/clients", label: "Clients", icon: Users, finance: true, group: "work" },
  { href: "/leads", label: "Leads", icon: Filter, finance: true, group: "work" },
  { href: "/projects", label: "Projects", icon: Folder, finance: false, group: "work" },
  { href: "/whatsapp", label: "WhatsApp API", icon: MessageCircleMore, finance: true, group: "work" },
  { href: "/collections", label: "Collections", icon: HandCoins, finance: true, group: "money" },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, finance: true, group: "money" },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat, finance: true, group: "money" },
  { href: "/team", label: "Team", icon: UserRound, finance: true, group: "agency" },
  { href: "/social", label: "Social", icon: BarChart3, finance: true, group: "agency" },
  { href: "/settings", label: "Settings", icon: Settings, finance: false, group: "agency" },
];

export const NAV_GROUP_LABELS: Record<NavItem["group"], string> = { work: "Workspace", money: "Money", agency: "Agency" };

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
