"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/docs/code-block";

interface LanguageTabsProps {
  javascript: string;
  python: string;
  javascriptFilename?: string;
  pythonFilename?: string;
}

export function LanguageTabs({
  javascript,
  python,
  javascriptFilename = "JavaScript",
  pythonFilename = "Python",
}: LanguageTabsProps) {
  const [language, setLanguage] = useState<"javascript" | "python">(
    "javascript"
  );

  return (
    <div>
      <div
        aria-label="Choose code language"
        className="mb-3 inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1"
        role="tablist"
      >
        {(["javascript", "python"] as const).map((option) => (
          <button
            key={option}
            id={`language-tab-${option}`}
            aria-controls="language-code-panel"
            aria-selected={language === option}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              language === option
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setLanguage(option)}
            role="tab"
            type="button"
          >
            {option === "javascript" ? "JavaScript" : "Python"}
          </button>
        ))}
      </div>
      <div
        id="language-code-panel"
        aria-labelledby={`language-tab-${language}`}
        role="tabpanel"
      >
        <CodeBlock
          code={language === "javascript" ? javascript : python}
          filename={
            language === "javascript" ? javascriptFilename : pythonFilename
          }
          language={language === "javascript" ? "javascript" : "python"}
        />
      </div>
    </div>
  );
}
