"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function RealGPTMarkdown({ children }: { children: string }) {
  return (
    <div className="rgpt-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
