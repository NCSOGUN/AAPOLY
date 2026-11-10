import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
}

export function StatCard({ title, value, icon: Icon, description }: StatCardProps) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-[#5f6368]">{title}</span>
        <Icon className="h-4 w-4 text-[#5f6368]" />
      </div>
      <div className="text-2xl font-medium text-[#202124]">{value}</div>
      {description && (
        <p className="mt-1 text-xs text-[#5f6368]">{description}</p>
      )}
    </div>
  );
}
