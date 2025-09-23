import { useEffect, useRef, useState } from 'react';

export default function Mascot() {
  const containerRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [eye, setEye] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function handleMove(e) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      const maxTilt = 16; // degrees (polished, slightly reduced for large size)
      const normX = Math.max(-1, Math.min(1, dx / (rect.width / 2)));
      const normY = Math.max(-1, Math.min(1, dy / (rect.height / 2)));

      const rotateY = normX * maxTilt; // left/right
      const rotateX = -normY * maxTilt; // up/down
      setTilt({ x: rotateX, y: rotateY });

      const eyeMax = 8; // px
      setEye({ x: normX * eyeMax, y: normY * eyeMax });
    }

    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <div className="mascot-container" ref={containerRef} aria-hidden>
      <div
        className="mascot-stage"
        style={{
          transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 500 500"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Base platform */}
          <defs>
            <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="goldBright" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
            <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
            <linearGradient id="steelDark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
            <linearGradient id="obsidian" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0b1323" />
              <stop offset="100%" stopColor="#0a0f1a" />
            </linearGradient>
            <linearGradient id="copper" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffb774" />
              <stop offset="50%" stopColor="#ff8f3a" />
              <stop offset="100%" stopColor="#c25422" />
            </linearGradient>
            <linearGradient id="blueGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0b1220" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feOffset dx="0" dy="2" />
              <feGaussianBlur stdDeviation="3" result="offset-blur" />
              <feComposite in="SourceGraphic" in2="offset-blur" operator="arithmetic" k2="-1" k3="1" />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0" />
            </filter>
          </defs>

          {/* Platform: layered, beveled with reflections */}
          <g filter="url(#shadow)">
            <rect x="75" y="385" rx="28" width="350" height="58" fill="url(#obsidian)" />
          </g>
          <g className="mascot-platform">
            <g>
              <rect x="98" y="350" width="304" height="50" rx="24" fill="url(#steelDark)" />
              <path d="M105 356 H392 a20 20 0 0 1 20 20 V370 H85 v6 a20 20 0 0 0 20 20" fill="rgba(255,255,255,0.05)" />
            </g>
            <g>
              <rect x="138" y="314" width="224" height="42" rx="20" fill="url(#copper)" />
              <path d="M145 320 H352 a16 16 0 0 1 16 16 V334 H129 v2 a16 16 0 0 0 16 16" fill="rgba(255,255,255,0.15)" />
            </g>
            <g>
              <rect x="172" y="288" width="156" height="30" rx="14" fill="url(#steel)" />
              <path d="M178 294 H322 a10 10 0 0 1 10 10 V302 H168 v2 a10 10 0 0 0 10 10" fill="rgba(255,255,255,0.12)" />
            </g>
          </g>

          {/* Body */}
          <g className="mascot-body">
            <rect x="234" y="268" width="32" height="38" rx="9" fill="url(#gold)" stroke="#f59e0b" strokeOpacity="0.35" />
            <rect x="226" y="252" width="48" height="24" rx="12" fill="url(#blueGlow)" />
          </g>

          {/* Head */}
          <g
            className="mascot-head"
            style={{ transformOrigin: '250px 190px', transform: `rotate(${tilt.y * 0.6}deg)` }}
          >
            {/* antenna */}
            <rect x="244" y="110" width="12" height="22" rx="6" fill="url(#blueGlow)" />
            <circle cx="250" cy="104" r="10" fill="url(#goldBright)" />

            {/* head shell with side panel */}
            <g filter="url(#innerShadow)">
              <rect x="188" y="138" width="140" height="86" rx="20" fill="url(#steel)" stroke="#93c5fd" strokeOpacity="0.25" />
              {/* right side node */}
              <circle cx="322" cy="180" r="6" fill="#94a3b8" />
            </g>
            {/* screen */}
            <rect x="202" y="152" width="112" height="62" rx="16" fill="url(#screen)" />
            {/* copper rim */}
            <rect x="196" y="146" width="124" height="74" rx="18" stroke="url(#copper)" strokeWidth="6" fill="transparent" />
            {/* inner gloss */}
            <path d="M208 158 Q258 142 308 158 L308 168 Q258 152 208 168 Z" fill="rgba(255,255,255,0.08)" />

            {/* Eyes */}
            <g className="mascot-eyes">
              <circle cx={236 + eye.x} cy={184 + eye.y} r="12" fill="#fb7185" />
              <circle cx={280 + eye.x} cy={184 + eye.y} r="12" fill="#fb7185" />
              <circle cx={232 + eye.x} cy={179 + eye.y} r="4.5" fill="#fecdd3" />
              <circle cx={276 + eye.x} cy={179 + eye.y} r="4.5" fill="#fecdd3" />
            </g>
          </g>

          <defs>
            <filter id="shadow" x="0" y="0" width="500" height="500">
              <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity="0.5" />
            </filter>
          </defs>
        </svg>
      </div>
      <div className="mascot-glow" />
    </div>
  );
}


