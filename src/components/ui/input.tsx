import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 disabled:cursor-not-allowed disabled:bg-slate-50",
        className,
      )}
      {...props}
    />
  );
}
