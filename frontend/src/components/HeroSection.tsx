import React from 'react';
import { Zap, Shield, Globe, Database, Code } from 'lucide-react';

interface HeroSectionProps {
  onGetStarted: () => void;
  onDocumentation: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onGetStarted, onDocumentation }) => {
  const features = [
    {
      icon: Globe,
      title: "Decentralized Training",
      description: "Leverage distributed computing power from workers around the globe",
      color: 'bg-[#FFD447]',
    },
    {
      icon: Shield,
      title: "Secure Execution",
      description: "Your code runs in isolated Docker containers with full security",
      color: 'bg-[#FF76B8]',
    },
    {
      icon: Zap,
      title: "Real-time Monitoring",
      description: "Watch your training progress with live metrics and terminal output",
      color: 'bg-[#7CF2D0]',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] flex items-center justify-center px-4 py-10">
      {/* Outer frame */}
      <div className="relative max-w-6xl w-full">
        {/* Grid background card */}
        <div
          className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />

        {/* Memphis / playful shapes */}
        <div
          className="absolute -top-6 -left-6 w-28 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#7BC8FF]"
          style={{
            animation: 'float 5s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-10 left-10 w-24 h-24 rounded-3xl border-[3px] border-slate-900 bg-[#FF76B8] flex items-center justify-center"
          style={{
            animation: 'wiggle 6s ease-in-out infinite',
          }}
        >
          <Code className="w-8 h-8 text-slate-900" />
        </div>
        <div
          className="absolute -top-8 right-4 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#FFD447] flex items-center justify-center"
          style={{
            animation: 'pulse 4s ease-in-out infinite',
          }}
        >
          <Database className="w-7 h-7 text-slate-900" />
        </div>
        <div
          className="absolute bottom-4 -right-10 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#7CF2D0]"
          style={{
            animation: 'slideHorizontal 5s ease-in-out infinite',
          }}
        />

        {/* Main content card */}
        <div className="relative z-10 px-8 py-8 md:px-12 md:py-10">
          {/* Top nav */}
          <nav
            className="flex items-center justify-between mb-10"
            style={{
              animation: 'slideDown 0.6s ease-out',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[14px] bg-blue-400 border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <img 
                  src="/logo.png" 
                  alt="DTrain Logo" 
                  className="w-8 h-8 object-contain"
                />
              </div>
              <span className="text-2xl font-extrabold bg-blue-400 bg-clip-text text-transparent">
                DTrain
              </span>
            </div>

            <button
              onClick={onDocumentation}
              className="px-6 py-2 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:bg-blue-500 active:translate-y-0"
            >
              Documentation
            </button>
          </nav>

          {/* Hero row */}
          <div className="grid md:grid-cols-2 gap-10 items-stretch mb-10">
            {/* Left: headline */}
            <div className="flex flex-col justify-between gap-8">
              <div>
                <h1
                  className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.3] pb-2"
                  style={{
                    animation: 'slideUp 0.7s ease-out 0.2s both',
                  }}
                >
                  <span className="bg-slate-900 bg-clip-text text-transparent">
                    Decentralized
                  </span>
                  <br />
                  <span className="inline-block bg-blue-500 bg-clip-text text-transparent pb-5">
                    ML Training
                  </span>
                </h1>

                <p
                  className="mt-4 text-sm md:text-base text-slate-700 max-w-xl"
                  style={{
                    animation: 'slideUp 0.7s ease-out 0.35s both',
                  }}
                >
                  Train your machine learning models using distributed computing power. 
                  Upload your Python code, let workers around the world handle the heavy lifting, 
                  and monitor everything in real-time.
                </p>
              </div>

              <div
                className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
                style={{
                  animation: 'slideUp 0.6s ease-out 0.45s both',
                }}
              >
                <button
                  onClick={onGetStarted}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-[16px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm md:text-base font-extrabold shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] hover:bg-blue-500 active:translate-y-0 active:shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                >
                  <span>Get Started</span>
                </button>
              </div>
            </div>

            {/* Right: fake UI card */}
            <div
              className="relative"
              style={{
                animation: 'slideLeft 0.7s ease-out 0.25s both',
              }}
            >
              {/* Back shadow card */}
              <div className="absolute -top-4 -left-4 w-full h-full rounded-[22px] border-[3px] border-slate-900 bg-[#7BC8FF] opacity-90" />
              {/* Main UI card */}
              <div className="relative rounded-[22px] border-[3px] border-slate-900 bg-white p-4 md:p-5 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#fb7185] border border-slate-900" />
                    <span className="w-3 h-3 rounded-full bg-[#facc15] border border-slate-900" />
                    <span className="w-3 h-3 rounded-full bg-[#22c55e] border border-slate-900" />
                  </div>
                  <span className="px-2 py-1 rounded-full border-[2px] border-slate-900 bg-[#E4ECFF] text-[10px] font-semibold text-slate-900">
                    job #421 • running
                  </span>
                </div>

                {/* Fake terminal + metrics */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-[14px] border-[2px] border-slate-900 bg-slate-900 text-[11px] font-mono p-3 h-28 overflow-hidden">
                    <p className="text-[#E0E7FF]">$ python train.py --epochs 40 --lr 3e-4</p>
                    <p className="mt-1 text-[#E0E7FF]">[worker-12] epoch 3/40 • loss: 0.431</p>
                    <p className="text-[#E0E7FF]">[worker-88] epoch 3/40 • loss: 0.438</p>
                    <p className="text-[#E0E7FF]">[scheduler] rebalancing jobs across 37 nodes…</p>
                    <p className="text-[#4ADE80] mt-1">✓ checkpoint saved: s3://dtrain/run-421</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-[11px]">
                    <div className="rounded-[12px] border-[2px] border-slate-900 bg-[#FFE66D] p-2">
                      <div className="font-semibold text-slate-900 mb-1">GPU hours</div>
                      <div className="text-2xl font-extrabold leading-none text-slate-900">312</div>
                      <div className="mt-1 text-slate-900">pooled from 58 workers</div>
                    </div>
                    <div className="rounded-[12px] border-[2px] border-slate-900 bg-[#7CF2D0] p-2">
                      <div className="font-semibold text-slate-900 mb-1">Speed-up</div>
                      <div className="text-2xl font-extrabold leading-none text-slate-900">×9.4</div>
                      <div className="mt-1 text-slate-900">vs local machine</div>
                    </div>
                    <div className="rounded-[12px] border-[2px] border-slate-900 bg-[#FFB4D3] p-2">
                      <div className="font-semibold text-slate-900 mb-1">Cost</div>
                      <div className="text-2xl font-extrabold leading-none text-slate-900">-63%</div>
                      <div className="mt-1 text-slate-900">vs managed cloud</div>
                    </div>
                  </div>

                  <div className="rounded-[12px] border-[2px] border-slate-900 bg-[#F5F3FF] p-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="w-6 h-6 rounded-full bg-[#4ADE80] border-[2px] border-slate-900 flex items-center justify-center text-[12px] font-extrabold">
                        +
                      </span>
                      <div>
                        <div className="font-semibold text-slate-900">New worker joined</div>
                        <div className="text-slate-700">Amsterdam • A100 • 4x faster than median</div>
                      </div>
                    </div>
                    <span className="px-2 py-1 text-[10px] rounded-full border-[2px] border-slate-900 bg-white font-semibold text-slate-900">
                      auto-balanced
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div
            className="grid md:grid-cols-3 gap-5 mb-10"
            style={{
              animation: 'slideUp 0.7s ease-out 0.5s both',
            }}
          >
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`relative rounded-[18px] border-[3px] border-slate-900 ${feature.color} p-4 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-1 hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)]`}
                style={{
                  animation: `fadeIn 0.6s ease-out ${0.6 + index * 0.15}s both`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-slate-900 font-medium leading-snug">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div
            className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-6 border-t-[2px] border-dashed border-slate-900"
            style={{
              animation: 'slideUp 0.8s ease-out 0.65s both',
            }}
          >
            <div className="text-center">
              <div className="rounded-[16px] border-[3px] border-slate-900 bg-white px-4 py-3 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                <div className="text-3xl font-extrabold text-blue-500 mb-2">24/7</div>
                <div className="text-sm text-slate-700">Available Workers</div>
              </div>
            </div>
            <div className="text-center">
              <div className="rounded-[16px] border-[3px] border-slate-900 bg-white px-4 py-3 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                <div className="text-3xl font-extrabold text-blue-500 mb-2">∞</div>
                <div className="text-sm text-slate-700">Scalability</div>
              </div>
            </div>
            <div className="text-center">
              <div className="rounded-[16px] border-[3px] border-slate-900 bg-white px-4 py-3 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                <div className="text-3xl font-extrabold text-blue-500 mb-2">100%</div>
                <div className="text-sm text-slate-700">Open Source</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(-8deg); }
          50% { transform: translateY(-6px) rotate(-8deg); }
        }
        
        @keyframes wiggle {
          0%, 100% { transform: rotate(6deg); }
          50% { transform: rotate(2deg); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        @keyframes slideHorizontal {
          0%, 100% { transform: translateX(0) rotate(10deg); }
          50% { transform: translateX(8px) rotate(10deg); }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-25px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideLeft {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default HeroSection;