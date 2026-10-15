"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  // Code blocks and inline code
  pre({ children }) {
    return (
      <pre className="my-3 overflow-x-auto rounded-lg border border-[#273040] bg-[#0B0D12] p-4 text-sm">
        {children}
      </pre>
    );
  },
  code({ children, className }) {
    // Detect if it's a code block (has language class) vs inline
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <code className="text-[#e2e8f0] font-mono">{children}</code>;
    }
    return (
      <code className="rounded bg-[#273040]/60 px-1.5 py-0.5 text-sm font-mono text-[#8AB4F8]">
        {children}
      </code>
    );
  },

  // Block-level elements
  p({ children }) {
    return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
  },
  h1({ children }) {
    return <h1 className="mb-3 mt-4 text-xl font-bold text-[#F3F5F9]">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="mb-2 mt-4 text-lg font-semibold text-[#F3F5F9]">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="mb-2 mt-3 text-base font-semibold text-[#F3F5F9]">{children}</h3>;
  },
  ul({ children }) {
    return <ul className="mb-3 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="mb-3 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-3 border-l-2 border-[#8AB4F8]/40 pl-4 italic text-[#9AA6B8]">
        {children}
      </blockquote>
    );
  },
  hr() {
    return <hr className="my-4 border-[#273040]" />;
  },
  a({ children, href }) {
    return (
      <a
        href={href}
        className="text-[#8AB4F8] underline decoration-[#8AB4F8]/30 hover:decoration-[#8AB4F8]"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-[#273040] bg-[#10141C] px-3 py-2 text-left font-semibold text-[#F3F5F9]">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-[#273040] px-3 py-2 text-[#9AA6B8]">{children}</td>
    );
  },

  // Prevent raw HTML from rendering (security)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  html(_props) {
    return null;
  },
};

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose-haishin max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
