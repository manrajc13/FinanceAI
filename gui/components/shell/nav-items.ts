import { Activity, Bookmark, House, LayoutList, PieChart, Settings, Sparkles, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// Order and slots follow the reference screenshot. "Transactions" → Saved plans and
// "AI Advisor" → AI Explainer (see plan.md §11); change the labels here only.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: House },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/optimizer", label: "Optimizer", icon: Activity },
  { href: "/allocation", label: "Allocation", icon: LayoutList },
  { href: "/plans", label: "Saved plans", icon: Bookmark },
  { href: "/explainer", label: "AI Explainer", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
