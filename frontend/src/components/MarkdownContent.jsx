import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownContent({ children, className = '' }) {
  if (!children) return null
  return (
    <div
      className={`text-slate-100 [&_a]:text-cyan-300 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-violet-400/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-slate-900/90 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:text-violet-200 [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:border-b [&_h1]:border-white/10 [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-white [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-violet-200 [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-fuchsia-200 [&_hr]:border-white/10 [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_p]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-amber-100 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-white/10 [&_th]:bg-white/5 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
