"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "authentication", label: "Authentication" },
  { id: "response-format", label: "Response Format" },
  {
    id: "endpoints",
    label: "Endpoints",
    children: [
      { id: "nearby", label: "POST /nearby" },
      { id: "match-by-diagnosis", label: "POST /match-by-diagnosis" },
      { id: "facility-detail", label: "GET /facilities/:id" },
      { id: "analyze", label: "POST /analyze" },
      { id: "analyze-image", label: "POST /analyze-image" },
      { id: "nearby-for-report", label: "POST /nearby-for-report" },
      { id: "escalation-consent", label: "POST /escalation/:id/consent" },
    ],
  },
  { id: "integration", label: "Integration Guide" },
  { id: "errors", label: "Error Reference" },
  { id: "specialties", label: "Supported Specialties" },
  { id: "rate-limits", label: "Rate Limits & Notes" },
];

export function DocsSidebar() {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
      s.children?.forEach((c) => {
        const cel = document.getElementById(c.id);
        if (cel) observer.observe(cel);
      });
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 border-r border-gray-200 bg-white overflow-y-auto z-10">
      {/* Brand */}
      <div className="flex h-14 items-center border-b border-gray-200 px-5">
        <Link href="/admin" className="text-sm font-medium text-[#202124] hover:text-[#1a73e8]">
          ENT-Care
        </Link>
        <span className="mx-2 text-gray-300">/</span>
        <span className="text-sm text-[#5f6368]">API Docs</span>
      </div>

      {/* Nav */}
      <nav className="p-4">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-widest text-[#5f6368]">
          Reference
        </p>
        <ul className="space-y-0.5">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                onClick={() => scrollTo(section.id)}
                className={`w-full text-left rounded px-2 py-1.5 text-sm transition-colors ${
                  active === section.id
                    ? "text-[#1a73e8] bg-blue-50"
                    : "text-[#5f6368] hover:text-[#202124] hover:bg-gray-50"
                }`}
              >
                {section.label}
              </button>

              {section.children && (
                <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-200 pl-3">
                  {section.children.map((child) => (
                    <li key={child.id}>
                      <button
                        onClick={() => scrollTo(child.id)}
                        className={`w-full text-left rounded px-2 py-1 text-xs transition-colors font-mono ${
                          active === child.id
                            ? "text-[#1a73e8]"
                            : "text-[#5f6368] hover:text-[#202124]"
                        }`}
                      >
                        {child.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
