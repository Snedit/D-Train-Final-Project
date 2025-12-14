import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Github } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import mermaid from 'mermaid';


// ============================================
// 🔧 CONFIGURATION - CHANGE THIS TO YOUR REPO
// ============================================
const CONFIG = {
  GITHUB_USERNAME: 'debjitmitra000',
  REPO_NAME: 'joblance',
  BRANCH: 'main',
  README_PATH: 'README.md',
  PROJECT_TITLE: 'DTrain Documentation',
};
// ============================================


interface DocumentationProps {
  onBack?: () => void;
}


const Documentation: React.FC<DocumentationProps> = ({ onBack }) => {
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mermaidRef = useRef<boolean>(false);


  // Construct URLs from config
  const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.REPO_NAME}/${CONFIG.BRANCH}/${CONFIG.README_PATH}`;
  const GITHUB_REPO_URL = `https://github.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.REPO_NAME}`;
  const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USERNAME}/${CONFIG.REPO_NAME}/${CONFIG.BRANCH}`;


  useEffect(() => {
    // Initialize Mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'ui-monospace, monospace',
      logLevel: 'fatal',
      themeVariables: {
        primaryColor: '#7CF2D0',
        primaryTextColor: '#0F172A',
        primaryBorderColor: '#0F172A',
        lineColor: '#0F172A',
        secondaryColor: '#FFD447',
        tertiaryColor: '#FF76B8',
        background: '#FFFDF8',
        mainBkg: '#FFFDF8',
        secondBkg: '#FFEFE1',
        border1: '#0F172A',
        border2: '#0F172A',
      }
    });
    mermaidRef.current = true;
    
    // Suppress mermaid error messages
    const originalError = console.error;
    console.error = (...args) => {
      if (args[0]?.includes?.('mermaid') || args[0]?.includes?.('Syntax error')) {
        return;
      }
      originalError.apply(console, args);
    };
  }, []);


  useEffect(() => {
    fetchReadme();
  }, []);


  useEffect(() => {
    if (markdown && mermaidRef.current) {
      setTimeout(() => {
        renderMermaidDiagrams();
      }, 100);
    }
  }, [markdown]);


  const renderMermaidDiagrams = async () => {
    const mermaidElements = document.querySelectorAll('.mermaid-diagram:not(.mermaid-rendered)');
    
    if (mermaidElements.length === 0) return;
    
    for (let i = 0; i < mermaidElements.length; i++) {
      const element = mermaidElements[i] as HTMLElement;
      const code = element.textContent || '';
      
      if (!code.trim()) {
        element.style.display = 'none';
        continue;
      }
      
      try {
        const id = `mermaid-${Date.now()}-${i}`;
        const { svg } = await mermaid.render(id, code);
        element.innerHTML = svg;
        element.classList.add('mermaid-rendered');
      } catch (err) {
        element.style.display = 'none';
        element.classList.add('mermaid-rendered');
      }
    }
  };


  const fetchReadme = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let response = await fetch(GITHUB_RAW_URL);
      
      if (!response.ok) {
        const alternateBranch = CONFIG.BRANCH === 'main' ? 'master' : 'main';
        const alternateUrl = GITHUB_RAW_URL.replace(`/${CONFIG.BRANCH}/`, `/${alternateBranch}/`);
        response = await fetch(alternateUrl);
      }


      if (!response.ok) {
        throw new Error('Failed to fetch README');
      }


      let text = await response.text();
      
      const lines = text.split('\n');
      
      // Convert video references to proper markdown image syntax
      const processedLines = lines.map(line => {
        const trimmedLine = line.trim();
        
        // Handle markdown link format: [filename.webm](url)
        const markdownVideoMatch = trimmedLine.match(/^\[([^\]]+\.(webm|mp4|mov|avi|mkv))\]\(([^)]+)\)$/i);
        if (markdownVideoMatch) {
          const url = markdownVideoMatch[3];
          return `![Video](${url})`;
        }
        
        // Handle standalone video file references
        if (trimmedLine.match(/^[^\[\]()!]*\.(webm|mp4|mov|avi|mkv)$/i)) {
          return `![Video](${trimmedLine})`;
        }
        
        return line;
      });
      
      text = processedLines.join('\n');
      setMarkdown(text);
    } catch (err) {
      setError('Failed to load documentation. Please try again later.');
      console.error('Error fetching README:', err);
    } finally {
      setLoading(false);
    }
  };


  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };


  const getMediaUrl = (src: string) => {
    if (src.startsWith('http')) {
      return src;
    }
    return `${GITHUB_RAW_BASE}/${src}`;
  };


  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="relative">
          {/* Background card */}
          <div
            className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)',
              backgroundSize: '26px 26px',
            }}
          />


          {/* Memphis shapes */}
          <motion.div
            className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#FFD447] flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <BookOpen className="w-8 h-8 text-slate-900" />
          </motion.div>
          
          <motion.div
            className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#7CF2D0]"
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          />
          
          <motion.div
            className="absolute top-20 -right-10 w-24 h-24 rounded-[20px] border-[3px] border-slate-900 bg-[#FF76B8] flex items-center justify-center"
            animate={{ rotate: [6, -6, 6] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          >
            <Github className="w-8 h-8 text-slate-900" />
          </motion.div>


          {/* Main content */}
          <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">
            {/* Header */}
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


            {/* Title */}
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


            {/* Content area */}
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
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 rounded-[16px] border-[4px] border-slate-900 bg-blue-400 shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-4 rounded-full border-[4px] border-slate-900 bg-[#FFD447]"
                    />
                  </div>
                  <p className="text-lg font-extrabold text-slate-900">Loading docs...</p>
                </div>
              ) : error ? (
                <div className="p-12 text-center">
                  <div className="w-20 h-20 rounded-[18px] bg-[#FEE2E2] border-[3px] border-slate-900 flex items-center justify-center mx-auto mb-4 shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                    <span className="text-4xl">⚠️</span>
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
                <div className="p-8 md:p-12 overflow-x-auto">
                  <article className="prose prose-slate max-w-none docs-content">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                      components={{
                        h1: ({...props}) => (
                          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6 mt-8 pb-4 border-b-[4px] border-slate-900" {...props} />
                        ),
                        h2: ({...props}) => (
                          <div className="mt-10 mb-6">
                            <h2 className="inline-block text-2xl md:text-3xl font-extrabold text-slate-900 px-5 py-3 rounded-[14px] border-[3px] border-slate-900 bg-[#FFE66D] shadow-[5px_5px_0_0_rgba(15,23,42,1)]" {...props} />
                          </div>
                        ),
                        h3: ({...props}) => (
                          <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-3 mt-6" {...props} />
                        ),
                        h4: ({...props}) => (
                          <h4 className="text-lg md:text-xl font-bold text-slate-900 mb-2 mt-5" {...props} />
                        ),
                        p: ({children, ...props}) => {
                          // Check for video files
                          if (typeof children === 'string') {
                            const videoMatch = children.match(/^([^\s]+\.(webm|mp4|mov|avi|mkv))$/i);
                            if (videoMatch) {
                              const filename = videoMatch[1];
                              const videoSrc = getMediaUrl(filename);
                              const [videoLoaded, setVideoLoaded] = React.useState(false);
                              
                              return (
                                <div className="my-6 rounded-[16px] border-[3px] border-slate-900 overflow-hidden shadow-[6px_6px_0_0_rgba(15,23,42,1)] bg-slate-100 relative min-h-[300px]">
                                  {!videoLoaded && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
                                      <div className="text-center">
                                        <motion.div
                                          animate={{ rotate: 360 }}
                                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                          className="w-16 h-16 mx-auto mb-3 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                                        />
                                        <p className="text-sm font-bold text-slate-700">Loading video...</p>
                                      </div>
                                    </div>
                                  )}
                                  <video 
                                    src={videoSrc}
                                    controls
                                    className="w-full h-auto relative z-0"
                                    preload="metadata"
                                    onLoadedData={() => setVideoLoaded(true)}
                                    style={{ opacity: videoLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}
                                  >
                                    <source src={videoSrc} type={`video/${filename.split('.').pop()}`} />
                                    Your browser does not support the video tag.
                                  </video>
                                </div>
                              );
                            }
                          }
                          
                          if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
                            const videoMatch = children[0].match(/^([^\s]+\.(webm|mp4|mov|avi|mkv))$/i);
                            if (videoMatch) {
                              const filename = videoMatch[1];
                              const videoSrc = getMediaUrl(filename);
                              const [videoLoaded, setVideoLoaded] = React.useState(false);
                              
                              return (
                                <div className="my-6 rounded-[16px] border-[3px] border-slate-900 overflow-hidden shadow-[6px_6px_0_0_rgba(15,23,42,1)] bg-slate-100 relative min-h-[300px]">
                                  {!videoLoaded && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
                                      <div className="text-center">
                                        <motion.div
                                          animate={{ rotate: 360 }}
                                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                          className="w-16 h-16 mx-auto mb-3 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                                        />
                                        <p className="text-sm font-bold text-slate-700">Loading video...</p>
                                      </div>
                                    </div>
                                  )}
                                  <video 
                                    src={videoSrc}
                                    controls
                                    className="w-full h-auto relative z-0"
                                    preload="metadata"
                                    onLoadedData={() => setVideoLoaded(true)}
                                    style={{ opacity: videoLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}
                                  >
                                    <source src={videoSrc} type={`video/${filename.split('.').pop()}`} />
                                    Your browser does not support the video tag.
                                  </video>
                                </div>
                              );
                            }
                          }
                          
                          return <p className="text-slate-700 text-base mb-5 leading-relaxed" {...props}>{children}</p>;
                        },
                        a: ({href, children, ...props}) => {
                          const videoExtensions = ['.webm', '.mp4', '.mov', '.avi', '.mkv'];
                          const isVideoLink = href && videoExtensions.some(ext => href.toLowerCase().endsWith(ext));
                          
                          if (isVideoLink && href) {
                            const videoSrc = getMediaUrl(href);
                            const [videoLoaded, setVideoLoaded] = React.useState(false);
                            
                            return (
                              <div className="my-6 rounded-[16px] border-[3px] border-slate-900 overflow-hidden shadow-[6px_6px_0_0_rgba(15,23,42,1)] bg-slate-100 relative min-h-[300px]">
                                {!videoLoaded && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
                                    <div className="text-center">
                                      <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                        className="w-16 h-16 mx-auto mb-3 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                                      />
                                      <p className="text-sm font-bold text-slate-700">Loading video...</p>
                                    </div>
                                  </div>
                                )}
                                <video 
                                  src={videoSrc}
                                  controls
                                  className="w-full h-auto relative z-0"
                                  preload="metadata"
                                  onLoadedData={() => setVideoLoaded(true)}
                                  style={{ opacity: videoLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}
                                >
                                  <source src={videoSrc} type={`video/${href.split('.').pop()}`} />
                                  Your browser does not support the video tag.
                                </video>
                              </div>
                            );
                          }
                          
                          return (
                            <a 
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 font-bold hover:text-blue-700 underline decoration-2 underline-offset-2 hover:decoration-4 transition-all break-words" 
                              {...props}
                            >
                              {children}
                            </a>
                          );
                        },
                        code: ({inline, className, children, ...props}: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const language = match ? match[1] : '';
                          
                          if (!inline && (language === 'mermaid' || className?.includes('mermaid'))) {
                            return (
                              <div className="my-6 p-6 rounded-[16px] border-[3px] border-slate-900 bg-[#FFFDF8] overflow-x-auto shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                                <div className="mermaid-diagram flex justify-center items-center min-h-[200px]">
                                  {String(children).replace(/\n$/, '')}
                                </div>
                              </div>
                            );
                          }
                          
                          return inline ? (
                            <code className="px-3 py-1.5 rounded-[8px] border-[2px] border-slate-900 bg-[#FFE66D] text-slate-900 font-mono text-sm font-bold break-words" {...props}>
                              {children}
                            </code>
                          ) : (
                            <code className="block p-5 rounded-[16px] border-[3px] border-slate-900 bg-[#7cf2d0] text-slate-900 font-mono text-sm overflow-x-auto shadow-[6px_6px_0_0_rgba(15,23,42,1)] mb-6" {...props}>
                              {children}
                            </code>
                          );
                        },
                        pre: ({children, ...props}) => {
                          const childArray = React.Children.toArray(children);
                          const codeElement = childArray.find((child: any) => child?.props?.className?.includes('mermaid'));
                          
                          if (codeElement) {
                            return <>{children}</>;
                          }
                          
                          return (
                            <pre className="my-6 rounded-[16px] overflow-hidden" {...props}>
                              {children}
                            </pre>
                          );
                        },
                        ul: ({...props}) => (
                          <ul className="space-y-2 mb-6 ml-0" {...props} />
                        ),
                        ol: ({...props}) => (
                          <ol className="space-y-2 mb-6 ml-6 list-decimal" {...props} />
                        ),
                        li: ({children, ...props}) => (
                          <li className="flex items-start gap-2 text-slate-700 font-medium" {...props}>
                            <span className="text-slate-900 font-bold mt-0.5">•</span>
                            <span className="flex-1">{children}</span>
                          </li>
                        ),
                        blockquote: ({...props}) => (
                          <blockquote className="my-6 pl-6 pr-4 py-4 border-l-[6px] border-blue-500 bg-[#60a5fa] rounded-r-[14px] rounded-l-[4px] italic shadow-[4px_4px_0_0_rgba(15,23,42,1)]" {...props} />
                        ),
                        table: ({...props}) => (
                          <div className="overflow-x-auto my-8">
                            <div className="rounded-[20px] border-[3px] border-slate-900">
                              <table className="min-w-full border-[3px] border-slate-900 rounded-[15px] overflow-hidden bg-slate-900" {...props} />
                            </div>
                          </div>
                        ),
                        thead: ({...props}) => (
                          <thead className="bg-[#FFE66D] border-b-[3px] border-slate-900" {...props} />
                        ),
                        th: ({...props}) => (
                          <th className="px-5 py-4 text-left font-extrabold text-slate-900 border-r-[3px] border-slate-900 last:border-r-0 text-sm" {...props} />
                        ),
                        td: ({...props}) => (
                          <td className="px-5 py-4 text-slate-700 font-medium border-r-[3px] border-slate-900 border-b-[3px] last:border-r-0 text-sm" {...props} />
                        ),
                        tbody: ({...props}) => (
                          <tbody className="bg-[#ffb4d3]" {...props} />
                        ),
                        tr: ({...props}) => (
                          <tr className="border-b-[3px] border-slate-900 last:border-b-0" {...props} />
                        ),
                        img: ({src, alt, ...props}) => {
                          // Check if it's a badge/shield
                          if (src?.includes('shields.io') || src?.includes('badge') || src?.includes('img.shields.io')) {
                            // Extract color from shields.io URL
                            const colorMatch = src.match(/[?&]color=([^&]+)/i) || src.match(/-([A-F0-9]{6})\?/i);
                            const badgeColor = colorMatch ? `#${colorMatch[1].replace('#', '')}` : '#E5E7EB';
                            
                            return (
                              <span 
                                className="inline-block px-2 pb-1 mx-1 my-1 rounded-[8px] border-[2px] border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
                                style={{ backgroundColor: badgeColor }}
                              >
                                <img 
                                  src={src} 
                                  alt={alt || ''} 
                                  className="inline-block h-5"
                                  loading="lazy"
                                  {...props} 
                                />
                              </span>
                            );
                          }
                          
                          // Check if it's a video - either by extension OR by GitHub user-attachments URL
                          const videoExtensions = ['.webm', '.mp4', '.mov', '.avi', '.mkv'];
                          const isVideo = (src && videoExtensions.some(ext => src.toLowerCase().includes(ext))) || 
                                         (src?.includes('github.com/user-attachments/assets'));
                          
                          if (isVideo && src) {
                            const [videoLoaded, setVideoLoaded] = React.useState(false);
                            const videoSrc = getMediaUrl(src);
                            
                            return (
                              <div className="my-6 rounded-[16px] border-[3px] border-slate-900 overflow-hidden shadow-[6px_6px_0_0_rgba(15,23,42,1)] bg-slate-100 relative min-h-[300px]">
                                {!videoLoaded && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
                                    <div className="text-center">
                                      <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                        className="w-16 h-16 mx-auto mb-3 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                                      />
                                      <p className="text-sm font-bold text-slate-700">Loading video...</p>
                                    </div>
                                  </div>
                                )}
                                <video 
                                  src={videoSrc}
                                  controls
                                  className="w-full h-auto relative z-0"
                                  preload="metadata"
                                  onLoadedData={() => setVideoLoaded(true)}
                                  style={{ opacity: videoLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}
                                >
                                  <source src={videoSrc} type="video/webm" />
                                  Your browser does not support the video tag.
                                </video>
                                
                              </div>
                            );
                          }
                          
                          return (
                            <img 
                              src={src} 
                              alt={alt || ''} 
                              className="rounded-[16px] border-[3px] border-slate-900 shadow-[6px_6px_0_0_rgba(15,23,42,1)] my-6 max-w-full h-auto"
                              loading="lazy"
                              {...props} 
                            />
                          );
                        },
                        hr: ({...props}) => (
                          <hr className="my-10 border-t-[3px] border-dashed border-slate-900" {...props} />
                        ),
                        strong: ({...props}) => (
                          <strong className="font-extrabold text-slate-900" {...props} />
                        ),
                        em: ({...props}) => (
                          <em className="italic text-slate-700 font-semibold" {...props} />
                        ),
                      }}
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
        .docs-content {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }


        .docs-content h2::before {
          content: '';
          margin-right: 8px;
        }


        .mermaid-diagram {
          min-height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
        }


        .mermaid-rendered svg {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
};


export default Documentation;
