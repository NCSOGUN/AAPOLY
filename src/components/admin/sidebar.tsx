"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Stethoscope, LogOut, BookOpen } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Facilities",
    href: "/admin/facilities",
    icon: Building2,
  },
  {
    label: "Specialties",
    href: "/admin/specialties",
    icon: Stethoscope,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-white overflow-y-auto">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center border-b border-gray-200 px-5">
        <span className="text-sm font-medium text-[#202124]">
          ENT-Care Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-blue-50 text-[#1a73e8]"
                  : "text-[#5f6368] hover:bg-gray-50 hover:text-[#202124]"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-gray-200 p-3">
        <Link
          href="/docs"
          className="flex w-full items-center gap-3 px-3 py-2 text-sm text-[#5f6368] hover:bg-gray-50 hover:text-[#202124] transition-colors mb-1"
        >
          <BookOpen className="h-4 w-4 flex-shrink-0" />
          API Docs
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex w-full items-center gap-3 px-3 py-2 text-sm text-[#5f6368] hover:bg-gray-50 hover:text-[#202124] transition-colors"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
