import React from "react";

interface EndpointSectionProps {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  summary: string;
  description: string;
  children: React.ReactNode;
}

const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-green-50 text-green-700 border border-green-200",
  POST:   "bg-blue-50 text-[#1a73e8] border border-blue-200",
  PUT:    "bg-amber-50 text-amber-700 border border-amber-200",
  DELETE: "bg-red-50 text-red-700 border border-red-200",
  PATCH:  "bg-purple-50 text-purple-700 border border-purple-200",
};

export function EndpointSection({
  id,
  method,
  path,
  summary,
  description,
  children,
}: EndpointSectionProps) {
  return (
    <section id={id} className="mb-12 pb-8 border-b border-gray-200">
      {/* Method + Path */}
      <div className="flex items-center gap-3 mb-3">
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono font-semibold ${METHOD_COLORS[method]}`}
        >
          {method}
        </span>
        <code className="text-sm font-mono text-[#202124]">{path}</code>
      </div>

      {/* Summary + description */}
      <h3 className="text-lg text-[#202124] mb-2">{summary}</h3>
      <p className="text-sm text-[#5f6368] leading-relaxed mb-6">{description}</p>

      {children}
    </section>
  );
}
