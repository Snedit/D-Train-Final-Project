import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Github, CheckCircle2, XCircle, AlertTriangle, Heart } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// ============================================
// 🔧 CONFIGURATION
// ============================================
const CONFIG = {
  GITHUB_USERNAME: 'snedit',
  REPO_NAME: 'D-Train-Final-Project',
  BRANCH: 'main',
  README_PATH: 'README.md',
  PROJECT_TITLE: 'DTrain Documentation',
};
// ============================================

interface DocumentationProps {
  onBack?: () => void;
}

const VIDEO_EXTS = ['.webm', '.mp4', '.mov', '.avi', '.mkv'];

const isVideoSrc = (src: string): boolean =>
  VIDEO_EXTS.some(ext => src.toLowerCase().endsWith(ext));

const isInlineIcon = (width?: string | number, height?: string | number): boolean => {
  const w = typeof width === 'string' ? parseInt(width, 10) : (width ?? 999);
  const h = typeof height === 'string' ? parseInt(height, 10) : (height ?? 999);
  return w <= 32 && h <= 32;
};

const isShieldsBadge = (src?: string): boolean =>
  !!(src?.includes('shields.io') || src?.includes('img.shields.io'));

// ─── GitHub-style heading slug generator ──────────────────────────────────────
const getTextContent = (node: React.ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join('');
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return getTextContent(props?.children);
  }
  return '';
};

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u00C0-\u024f\- ]/g, '')
    .replace(/\s+/g, '-');

// ─── Emoji → Lucide icon replacement ──────────────────────────────────────────
const replaceEmojisWithIconTags = (text: string): string =>
  text
    .replace(/✅/g, '<icon-check></icon-check>')
    .replace(/❌/g, '<icon-x></icon-x>')
    .replace(/⚠️/g, '<icon-warning></icon-warning>')
    .replace(/❤️/g, '<icon-heart></icon-heart>');

// ─── Asset ID → color map ─────────────────────────────────────────────────────
// Maps the GitHub user-attachments asset UUID fragment to a CSS color.
// Used to colorize file-tree icons inside <pre> blocks.
const ASSET_COLOR_MAP: Record<string, string> = {
  '826fa449': '#FF9F1C', // folder          → Orange-yellow (distinct from JS)
  '2a56c0f4': '#F7DF1E', // js              → JavaScript Yellow
  '0822a86b': '#5BC8F5', // ts              → TypeScript bright sky blue
  'aa2a1a97': '#61DAFB', // tsx             → React Cyan
  'f09ee358': '#4FC3F7', // css             → Bright light blue
  'f15960ef': '#E34F26', // html            → HTML Orange
  'e9017024': '#CE93D8', // image           → Soft purple (brighter)
  '33cf5060': '#69D98C', // generic-files   → Greenish
  '41696666': '#A5B4C8', // config/json/yml → Light grey-blue
  'd1454499': '#276D79', // md              → Teal (user requested)
};

/**
 * Given a src URL, return the CSS color for that icon, or null if unknown.
 * Matches the first 8 chars of the asset UUID in the URL.
 */
const getIconColor = (src: string): string | null => {
  for (const [id, color] of Object.entries(ASSET_COLOR_MAP)) {
    if (src.includes(id)) return color;
  }
  return null;
};

// ─── Video player ────────────────────────────────────────────────────────────
const VideoPlayer: React.FC<{ src: string }> = ({ src }) => {
  const [loaded, setLoaded] = React.useState(false);
  return (
    <div className="my-6 rounded-[16px] border-[3px] border-slate-900 overflow-hidden shadow-[6px_6px_0_0_rgba(15,23,42,1)] bg-slate-100 relative min-h-[200px]">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 mx-auto mb-3 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
            />
            <p className="text-sm font-bold text-slate-700">Loading video…</p>
          </div>
        </div>
      )}
      <video
        src={src}
        controls
        className="w-full h-auto relative z-0"
        preload="metadata"
        onLoadedData={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

// ─── Context to track if we're inside a table cell ───────────────────────────
const TableCellContext = React.createContext(false);

// ─── Context to track if we're inside a <pre> block ──────────────────────────
const PreBlockContext = React.createContext(false);

// ─── Main component ──────────────────────────────────────────────────────────
const Documentation: React.FC<DocumentationProps> = ({ onBack }) => {
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.REPO_NAME}/${CONFIG.BRANCH}/${CONFIG.README_PATH}`;
  const GITHUB_REPO_URL = `https://github.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.REPO_NAME}`;
  const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.REPO_NAME}/${CONFIG.BRANCH}`;

  const getMediaUrl = (src: string) => {
    if (src.startsWith('http')) return src;
    return `${GITHUB_RAW_BASE}/${src}`;
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      e.preventDefault();
      const id = href.slice(1);
      const el =
        document.querySelector(`[name="${id}"]`) ||
        document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => { fetchReadme(); }, []);


  const fetchReadme = async () => {
    try {
      setLoading(true);
      setError(null);
      let response = await fetch(GITHUB_RAW_URL);
      if (!response.ok) {
        const alt = GITHUB_RAW_URL.replace(`/${CONFIG.BRANCH}/`, '/master/');
        response = await fetch(alt);
      }
      if (!response.ok) throw new Error('Failed to fetch README');
      const text = await response.text();
      setMarkdown(replaceEmojisWithIconTags(text));
    } catch (err) {
      setError('Failed to load documentation. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (onBack) onBack();
    else window.history.back();
  };

  // ── Markdown component overrides ─────────────────────────────────────────
  const components: any = {

    // ── Emoji → Lucide icon replacements ──────────────────────────────────
    'icon-check': () => (
      <CheckCircle2
        className="inline-block align-middle text-green-600"
        style={{ width: '1.1em', height: '1.1em', verticalAlign: '-0.15em' }}
      />
    ),
    'icon-x': () => (
      <XCircle
        className="inline-block align-middle text-red-600"
        style={{ width: '1.1em', height: '1.1em', verticalAlign: '-0.15em' }}
      />
    ),
    'icon-warning': () => (
      <AlertTriangle
        className="inline-block align-middle text-amber-500"
        style={{ width: '1.1em', height: '1.1em', verticalAlign: '-0.15em' }}
      />
    ),
    'icon-heart': () => (
      <Heart
        className="inline-block align-middle text-red-500"
        fill="currentColor"
        style={{ width: '1.1em', height: '1.1em', verticalAlign: '-0.15em' }}
      />
    ),

    h1: ({ children, id, ...props }: any) => (
      <h1 id={id || slugify(getTextContent(children))} className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6 mt-8 pb-4 border-b-[4px] border-slate-900" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, id, ...props }: any) => (
      <div className="mt-10 mb-6">
        <h2
          id={id || slugify(getTextContent(children))}
          className="inline-flex items-center gap-2 text-xl md:text-2xl font-extrabold text-slate-900 px-5 py-3 rounded-[14px] border-[3px] border-slate-900 bg-[#FFE66D] shadow-[5px_5px_0_0_rgba(15,23,42,1)]"
          {...props}
        >
          {children}
        </h2>
      </div>
    ),
    h3: ({ children, id, ...props }: any) => (
      <h3 id={id || slugify(getTextContent(children))} className="text-xl md:text-2xl font-bold text-slate-900 mb-3 mt-6" {...props}>{children}</h3>
    ),
    h4: ({ children, id, ...props }: any) => (
      <h4 id={id || slugify(getTextContent(children))} className="text-lg md:text-xl font-bold text-slate-900 mb-2 mt-5" {...props}>{children}</h4>
    ),

    p: ({ children, ...props }: any) => (
      <p className="text-slate-700 text-base mb-5 leading-relaxed" {...props}>{children}</p>
    ),

    a: ({ href, children, ...props }: any) => {
      if (href && isVideoSrc(href)) return <VideoPlayer src={getMediaUrl(href)} />;

      const childArray = React.Children.toArray(children);
      const hasNoText = childArray.every(child =>
        React.isValidElement(child) ||
        (typeof child === 'string' && child.trim() === '')
      );
      const hasImg = childArray.some(child => React.isValidElement(child));
      const isImageOnly = hasNoText && hasImg;

      if (isImageOnly) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline', textDecoration: 'none', border: 'none', background: 'none' }}
            {...props}
          >
            {children}
          </a>
        );
      }

      return (
        <a
          href={href}
          target={href?.startsWith('#') ? undefined : '_blank'}
          rel={href?.startsWith('#') ? undefined : 'noopener noreferrer'}
          style={{
            display: 'inline',
            color: '#1d4ed8',
            fontWeight: 700,
            textDecoration: 'none',
            borderBottom: '2.5px solid #1d4ed8',
            paddingBottom: '1px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.background = '#1d4ed8';
            (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff';
            (e.currentTarget as HTMLAnchorElement).style.borderRadius = '4px';
            (e.currentTarget as HTMLAnchorElement).style.padding = '1px 4px';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
            (e.currentTarget as HTMLAnchorElement).style.color = '#1d4ed8';
            (e.currentTarget as HTMLAnchorElement).style.borderRadius = '0';
            (e.currentTarget as HTMLAnchorElement).style.padding = '0 0 1px 0';
          }}
          {...props}
        >
          {children}
        </a>
      );
    },

    // ── Images ────────────────────────────────────────────────────────────
    img: ({ src, alt, width, height }: any) => {
      if (!src) return null;
      const resolvedSrc = getMediaUrl(src);

      // Video
      if (isVideoSrc(resolvedSrc)) return <VideoPlayer src={resolvedSrc} />;

      // Shields badge — render naturally at correct size
      if (isShieldsBadge(src)) {
        return (
          <img
            src={resolvedSrc}
            alt={alt || ''}
            style={{
              display: 'inline',
              verticalAlign: 'middle',
              height: '22px',
              width: 'auto',
              margin: '2px 3px',
              borderRadius: '4px',
              boxShadow: '2px 2px 0 0 #0f172a',
            }}
            loading="lazy"
          />
        );
      }

      // Small inline icon (≤32px)
      if (isInlineIcon(width, height)) {
        // ── File-tree icon inside <pre>: apply per-type color via inline style ──
        const inPre = React.useContext(PreBlockContext);
        if (inPre) {
          const color = getIconColor(src);
          // Build a CSS filter that approximates the target color.
          // We use a drop-shadow-less approach: brightness(0) makes the icon
          // pure black, then we tint it with sepia + hue-rotate + saturate.
          // For simplicity we use the precomputed filter strings per color bucket.
          const filterMap: Record<string, string> = {
            '#FF9F1C': 'brightness(0) saturate(100%) invert(68%) sepia(80%) saturate(700%) hue-rotate(5deg) brightness(105%) contrast(102%)',   // folder orange-yellow
            '#F7DF1E': 'brightness(0) saturate(100%) invert(93%) sepia(40%) saturate(800%) hue-rotate(340deg) brightness(105%) contrast(101%)', // js yellow
            '#5BC8F5': 'brightness(0) saturate(100%) invert(72%) sepia(55%) saturate(400%) hue-rotate(170deg) brightness(108%) contrast(98%)',  // ts bright sky blue
            '#61DAFB': 'brightness(0) saturate(100%) invert(78%) sepia(50%) saturate(400%) hue-rotate(165deg) brightness(103%) contrast(101%)', // tsx react cyan
            '#4FC3F7': 'brightness(0) saturate(100%) invert(73%) sepia(45%) saturate(500%) hue-rotate(172deg) brightness(106%) contrast(99%)',  // css bright light blue
            '#E34F26': 'brightness(0) saturate(100%) invert(37%) sepia(85%) saturate(700%) hue-rotate(6deg) brightness(98%) contrast(97%)',     // html orange
            '#CE93D8': 'brightness(0) saturate(100%) invert(68%) sepia(30%) saturate(500%) hue-rotate(265deg) brightness(105%) contrast(95%)',  // image soft purple
            '#69D98C': 'brightness(0) saturate(100%) invert(75%) sepia(35%) saturate(500%) hue-rotate(95deg) brightness(105%) contrast(98%)',  // generic greenish
            '#A5B4C8': 'brightness(0) saturate(100%) invert(76%) sepia(10%) saturate(300%) hue-rotate(185deg) brightness(103%) contrast(90%)', // config light grey-blue
            '#276D79': 'brightness(0) saturate(100%) invert(35%) sepia(60%) saturate(400%) hue-rotate(155deg) brightness(90%) contrast(98%)',  // md teal
          };
          const cssFilter = color ? (filterMap[color] ?? 'brightness(0) invert(1)') : 'brightness(0) invert(1)';
          return (
            <img
              src={resolvedSrc}
              alt={alt || ''}
              width={width}
              height={height}
              className="docs-inline-icon docs-tree-icon inline-block align-middle"
              style={{ filter: cssFilter }}
              loading="lazy"
            />
          );
        }

        // Outside <pre> — normal inline icon (heading icons, paragraph icons)
        return (
          <img
            src={resolvedSrc}
            alt={alt || ''}
            width={width}
            height={height}
            className="docs-inline-icon inline-block align-middle"
            loading="lazy"
          />
        );
      }

      // DTrain logo (specific asset ID) — render small
      const LOGO_ID = 'eeedb305-fd79-446d-ae55-1fb2cec42c90';
      if (src.includes(LOGO_ID)) {
        return (
          <img
            src={resolvedSrc}
            alt={alt || ''}
            className="my-6 block mx-auto"
            style={{ maxWidth: '120px', objectFit: 'contain' }}
            loading="lazy"
          />
        );
      }

      // Large content image (PNG diagrams) — full width
      return (
        <img
          src={resolvedSrc}
          alt={alt || ''}
          className="rounded-[16px] border-[3px] border-slate-900 shadow-[6px_6px_0_0_rgba(15,23,42,1)] my-6 w-full h-auto block mx-auto"
          loading="lazy"
        />
      );
    },

    // ── Code ──────────────────────────────────────────────────────────────
    code: ({ inline, className, children, ...props }: any) => {
      const inCell = React.useContext(TableCellContext);
      const isBlock = !inline && className?.includes('language-');

      if (isBlock || (!inline && !className?.includes('language-') && typeof children === 'string' && (children as string).includes('\n'))) {
        return (
          <code
            className="font-mono text-sm text-[#e2e8f0] whitespace-pre"
            style={{ background: 'transparent', border: 'none', padding: 0, boxShadow: 'none', borderRadius: 0 }}
            {...props}
          >
            {children}
          </code>
        );
      }

      if (inCell) {
        return (
          <code className="font-mono text-sm text-slate-900" {...props}>
            {children}
          </code>
        );
      }

      return (
        <code
          className="px-2 py-0.5 rounded-[6px] border-[2px] border-slate-900 bg-[#7CF2D0] text-slate-900 font-mono text-sm font-bold"
          style={{ wordBreak: 'keep-all', whiteSpace: 'pre-wrap' }}
          {...props}
        >
          {children}
        </code>
      );
    },

    // ── Pre — wrap children in PreBlockContext so nested imgs know they're in a tree ──
    pre: ({ children, ...props }: any) => (
      <PreBlockContext.Provider value={true}>
        <pre className="my-6 rounded-[16px] overflow-x-auto" style={{ whiteSpace: 'pre' }} {...props}>
          {children}
        </pre>
      </PreBlockContext.Provider>
    ),

    // ── Lists — SKIP bullet injection when inside a table cell ────────────
    ul: ({ children, ...props }: any) => {
      const inCell = React.useContext(TableCellContext);
      if (inCell) return <span className="inline" {...props}>{children}</span>;
      return <ul className="space-y-2 mb-6 ml-0" {...props}>{children}</ul>;
    },
    ol: ({ children, ...props }: any) => {
      const inCell = React.useContext(TableCellContext);
      if (inCell) return <span className="inline" {...props}>{children}</span>;
      return <ol className="space-y-2 mb-6 ml-6 list-decimal" {...props}>{children}</ol>;
    },
    li: ({ children, ...props }: any) => {
      const inCell = React.useContext(TableCellContext);
      if (inCell) {
        return <span className="block text-slate-800 font-medium text-sm" {...props}>{children}</span>;
      }
      return (
        <li className="flex items-start gap-2 text-slate-700 font-medium" {...props}>
          <span className="text-slate-900 font-bold mt-0.5 shrink-0">•</span>
          <span className="flex-1 min-w-0">{children}</span>
        </li>
      );
    },

    blockquote: ({ ...props }: any) => (
      <blockquote
        className="my-6 pl-6 pr-4 py-4 border-l-[6px] border-blue-500 bg-blue-100 rounded-r-[14px] rounded-l-[4px] italic shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
        {...props}
      />
    ),

    // ── Tables — provide TableCellContext inside td/th ─────────────────────
    table: ({ ...props }: any) => (
      <div className="overflow-x-auto my-8">
        <div className="rounded-[20px] border-[3px] border-slate-900 overflow-hidden">
          <table className="min-w-full" {...props} />
        </div>
      </div>
    ),
    thead: ({ ...props }: any) => (
      <thead className="bg-[#FFE66D] border-b-[3px] border-slate-900" {...props} />
    ),
    th: ({ children, ...props }: any) => (
      <th className="px-5 py-4 text-left font-extrabold text-slate-900 border-r-[3px] border-slate-900 last:border-r-0 text-sm" {...props}>
        <TableCellContext.Provider value={true}>
          {children}
        </TableCellContext.Provider>
      </th>
    ),
    tbody: ({ ...props }: any) => (
      <tbody className="bg-[#ffd6e8]" {...props} />
    ),
    tr: ({ ...props }: any) => (
      <tr className="border-b-[3px] border-slate-900 last:border-b-0" {...props} />
    ),
    td: ({ children, ...props }: any) => (
      <td className="px-5 py-4 text-slate-800 font-medium border-r-[3px] border-slate-900 border-b-[3px] last:border-r-0 text-sm" {...props}>
        <TableCellContext.Provider value={true}>
          {children}
        </TableCellContext.Provider>
      </td>
    ),

    hr: ({ ...props }: any) => (
      <hr className="my-10 border-t-[3px] border-dashed border-slate-900" {...props} />
    ),
    strong: ({ ...props }: any) => (
      <strong className="font-extrabold text-slate-900" {...props} />
    ),
    em: ({ ...props }: any) => (
      <em className="italic text-slate-700 font-semibold" {...props} />
    ),
  };

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)',
              backgroundSize: '26px 26px',
            }}
          />

          <motion.div
            className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#FFD447] flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          >
            <BookOpen className="w-8 h-8 text-slate-900" />
          </motion.div>

          <motion.div
            className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#7CF2D0]"
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
          />

          <motion.div
            className="absolute top-20 -right-10 w-24 h-24 rounded-[20px] border-[3px] border-slate-900 bg-[#FF76B8] flex items-center justify-center"
            animate={{ rotate: [6, -6, 6] }}
            transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
          >
            <Github className="w-8 h-8 text-slate-900" />
          </motion.div>

          <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">
            <div className="flex items-center justify-between mb-8">
              <motion.button
                whileHover={{ x: -4 }}
                whileTap={{ x: 0 }}
                onClick={handleBack}
                className="flex items-center px-5 py-3 rounded-[14px] border-[3px] border-slate-900 bg-white text-slate-900 text-sm font-extrabold shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-1 hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </motion.button>

              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-5 py-3 rounded-[14px] border-[3px] border-slate-900 bg-slate-900 text-white text-sm font-extrabold shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-1 hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)]"
              >
                <Github className="w-4 h-4 mr-2" />
                View on GitHub
              </a>
            </div>

            <div className="mb-10 text-center">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-3"
              >
                {CONFIG.PROJECT_TITLE}
              </motion.h1>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden"
            >
              {loading ? (
                <div className="p-16 text-center">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0 rounded-[16px] border-[4px] border-slate-900 bg-blue-400 shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-4 rounded-full border-[4px] border-slate-900 bg-[#FFD447]"
                    />
                  </div>
                  <p className="text-lg font-extrabold text-slate-900">Loading docs…</p>
                </div>
              ) : error ? (
                <div className="p-12 text-center">
                  <div className="w-20 h-20 rounded-[18px] bg-[#FEE2E2] border-[3px] border-slate-900 flex items-center justify-center mx-auto mb-4 shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                    <AlertTriangle className="w-10 h-10 text-amber-500" />
                  </div>
                  <p className="text-slate-900 font-extrabold mb-2 text-xl">Oops!</p>
                  <p className="text-slate-700 font-semibold mb-6">{error}</p>
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ y: 0 }}
                    onClick={fetchReadme}
                    className="px-8 py-4 rounded-[16px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-extrabold shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-1 hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)]"
                  >
                    Try Again
                  </motion.button>
                </div>
              ) : (
                <div className="p-8 md:p-12">
                  <article className="prose prose-slate max-w-none docs-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={components}
                    >
                      {markdown}
                    </ReactMarkdown>
                  </article>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <style>{`
        /* ═══════════════════════════════════════════════════════════════
           CODE inside PRE — no inner box, white text
        ═══════════════════════════════════════════════════════════════ */
        .docs-content pre code,
        .docs-content pre code * {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          color: #e2e8f0 !important;
          display: block !important;
          font-size: inherit !important;
          white-space: pre !important;
        }

        /* ═══════════════════════════════════════════════════════════════
           FILE TREE <pre> — dark background, light text
        ═══════════════════════════════════════════════════════════════ */
        .docs-content pre {
          overflow-x: auto;
          white-space: pre;
          font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
          font-size: 0.8rem;
          line-height: 1.6;
          background: #1e293b !important;
          color: #e2e8f0 !important;
          border: 3px solid #0f172a;
          border-radius: 16px;
          padding: 20px 24px;
          box-shadow: 6px 6px 0 0 rgba(15,23,42,1);
          margin: 24px 0;
        }

        /* ═══════════════════════════════════════════════════════════════
           FILE TREE icons — colored via inline style (set in React).
           Override the old blanket white-invert rule.
           The .docs-tree-icon class marks icons rendered inside <pre>.
        ═══════════════════════════════════════════════════════════════ */
        .docs-content pre img.docs-tree-icon,
        .docs-content pre .docs-tree-icon {
          display: inline !important;
          vertical-align: middle;
          margin: 0 3px 0 1px;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          /* filter is set inline per-icon — do NOT override here */
        }

        /* Fallback: any pre img that wasn't given .docs-tree-icon
           (shouldn't happen, but safety net) */
        .docs-content pre img:not(.docs-tree-icon) {
          display: inline !important;
          vertical-align: middle;
          margin: 0 2px;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          filter: brightness(0) invert(1) !important;
        }

        /* Heading inline code — dark text always */
        .docs-content h1 code,
        .docs-content h2 code,
        .docs-content h3 code,
        .docs-content h4 code {
          color: #0f172a !important;
          background: #7CF2D0 !important;
        }

        /* ═══════════════════════════════════════════════════════════════
           HEADING icons — keep natural color (dark/black)
        ═══════════════════════════════════════════════════════════════ */
        .docs-content h1 img,
        .docs-content h2 img,
        .docs-content h3 img,
        .docs-content h4 img {
          display: inline !important;
          vertical-align: middle;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          margin: 0 6px 0 0;
          filter: brightness(0) !important;
        }

        /* ═══════════════════════════════════════════════════════════════
           INLINE CODE inside list items — force inline, no block box
        ═══════════════════════════════════════════════════════════════ */
        .docs-content li code,
        .docs-content p code {
          display: inline !important;
          background: #7CF2D0 !important;
          border: 2px solid #0f172a !important;
          border-radius: 6px !important;
          padding: 1px 6px !important;
          font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace !important;
          font-size: 0.85em !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          white-space: nowrap !important;
          word-break: keep-all !important;
          box-shadow: none !important;
          margin: 0 1px !important;
        }

        /* Pre code always wins — no yellow box, white text on dark bg */
        .docs-content pre code,
        .docs-content pre code * {
          display: block !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          color: #e2e8f0 !important;
          font-size: inherit !important;
          white-space: pre !important;
          margin: 0 !important;
        }

        /* ═══════════════════════════════════════════════════════════════
           TABLE CELL code — no green box, no border, plain monospace, inline
        ═══════════════════════════════════════════════════════════════ */
        .docs-content td code,
        .docs-content th code {
          display: inline !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          font-weight: 600 !important;
          font-size: 0.85em !important;
          color: inherit !important;
          white-space: nowrap !important;
        }

        /* TABLE CELL paragraphs — no margin, stay inline flow */
        .docs-content td p,
        .docs-content th p {
          display: inline !important;
          margin: 0 !important;
        }

        /* TABLE CELL — prevent any block children from breaking lines */
        .docs-content td *,
        .docs-content th * {
          display: inline !important;
        }

        /* But keep the td itself as table-cell */
        .docs-content td,
        .docs-content th {
          display: table-cell !important;
        }

        /* ═══════════════════════════════════════════════════════════════
           TABLE CELL images — no border/shadow by default
        ═══════════════════════════════════════════════════════════════ */
        .docs-content td img,
        .docs-content th img {
          display: inline !important;
          vertical-align: middle;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          filter: none !important;
          margin: 1px 2px;
        }

        /* Small inline icons in td (team role icons w=18) — force black */
        .docs-content td img[width="18"],
        .docs-content td img[width="16"],
        .docs-content th img[width="18"],
        .docs-content th img[width="16"] {
          filter: brightness(0) !important;
        }

        /* Shields badges inside table cells keep their own colors */
        .docs-content td img[src*="shields.io"],
        .docs-content th img[src*="shields.io"] {
          filter: none !important;
          border-radius: 4px !important;
          box-shadow: 2px 2px 0 0 #0f172a !important;
        }

        /* ═══════════════════════════════════════════════════════════════
           PARAGRAPH inline icons
        ═══════════════════════════════════════════════════════════════ */
        .docs-content p img[width="22"],
        .docs-content p img[width="16"],
        .docs-content p img[width="18"],
        .docs-content p img[width="24"] {
          display: inline !important;
          vertical-align: middle;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          filter: none !important;
        }

        /* ═══════════════════════════════════════════════════════════════
           TOC list: no list-style
        ═══════════════════════════════════════════════════════════════ */
        .docs-content ol > li,
        .docs-content ul > li {
          list-style: none;
        }

        /* ═══════════════════════════════════════════════════════════════
           BLOCKQUOTE text
        ═══════════════════════════════════════════════════════════════ */
        .docs-content blockquote p {
          color: #1e3a5f;
          margin-bottom: 0;
        }

        /* ═══════════════════════════════════════════════════════════════
           Centre large section images
        ═══════════════════════════════════════════════════════════════ */
        .docs-content > article > p > img:not([width]),
        .docs-content p img:not([width="22"]):not([width="16"]):not([width="18"]):not([width="24"]) {
          display: block;
          margin-left: auto;
          margin-right: auto;
        }

        /* ═══════════════════════════════════════════════════════════════
           General overflow guard, code/link wrapping
        ═══════════════════════════════════════════════════════════════ */
        .docs-content {
          overflow-wrap: break-word;
          min-width: 0;
        }
        .docs-content code {
          word-break: keep-all;
          overflow-wrap: anywhere;
        }
        .docs-content a {
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        /* ═══════════════════════════════════════════════════════════════
           Scrollbar styling for pre blocks
        ═══════════════════════════════════════════════════════════════ */
        .docs-content pre::-webkit-scrollbar { height: 6px; }
        .docs-content pre::-webkit-scrollbar-track { background: #334155; border-radius: 99px; }
        .docs-content pre::-webkit-scrollbar-thumb { background: #64748b; border-radius: 99px; }
      `}</style>
    </div>
  );
};

export default Documentation;