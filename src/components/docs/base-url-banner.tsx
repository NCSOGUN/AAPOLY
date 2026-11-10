"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface BaseUrlBannerProps {
  baseUrl: string;
}

export function BaseUrlBanner({ baseUrl }: BaseUrlBannerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(baseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <code className="text-sm text-[#202124] font-mono break-all">{baseUrl}</code>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 flex items-center gap-1.5 text-xs text-[#5f6368] hover:text-[#202124] transition-colors"
        title="Copy base URL"
      >
        {copied ? (
          <><Check className="h-3.5 w-3.5 text-green-600" /><span className="text-green-600">Copied</span></>
        ) : (
          <><Copy className="h-3.5 w-3.5" /><span>Copy</span></>
        )}
      </button>
    </div>
  );
}
