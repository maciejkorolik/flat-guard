import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

/** Small prose block for assistant messages, shortlist notes, etc. */
export function CompactMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("compact-md", className)}>
      <ReactMarkdown
        components={{
          p: ({ children: c }) => (
            <p className="mb-2 last:mb-0 leading-relaxed">{c}</p>
          ),
          ul: ({ children: c }) => (
            <ul className="list-disc pl-4 mb-2 space-y-1">{c}</ul>
          ),
          ol: ({ children: c }) => (
            <ol className="list-decimal pl-4 mb-2 space-y-1">{c}</ol>
          ),
          li: ({ children: c }) => <li className="leading-relaxed">{c}</li>,
          strong: ({ children: c }) => (
            <strong className="font-semibold text-[#0d1c2e]">{c}</strong>
          ),
          em: ({ children: c }) => <em className="italic">{c}</em>,
          a: ({ href, children: c }) => (
            <a
              href={href}
              className="text-[#000666] underline font-medium break-all"
              target="_blank"
              rel="noopener noreferrer"
            >
              {c}
            </a>
          ),
          code: ({ children: c }) => (
            <code className="bg-[#e2e8f0] px-1 py-0.5 rounded text-[11px] font-mono">
              {c}
            </code>
          ),
          pre: ({ children: c }) => (
            <pre className="bg-[#0d1c2e] text-[#f1f5f9] p-2 rounded-lg text-[11px] overflow-x-auto mb-2">
              {c}
            </pre>
          ),
          h1: ({ children: c }) => (
            <h3 className="font-manrope font-bold text-sm mt-2 mb-1 first:mt-0">{c}</h3>
          ),
          h2: ({ children: c }) => (
            <h3 className="font-manrope font-bold text-sm mt-2 mb-1 first:mt-0">{c}</h3>
          ),
          h3: ({ children: c }) => (
            <h3 className="font-manrope font-bold text-sm mt-2 mb-1 first:mt-0">{c}</h3>
          ),
          blockquote: ({ children: c }) => (
            <blockquote className="border-l-2 border-[#000666]/25 pl-2 my-2 text-[#454652]">
              {c}
            </blockquote>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
