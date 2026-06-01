import React, { useState } from 'react';

export const CeflotLogo = ({ 
  className = "w-8 h-8", 
  color = "currentColor", 
  isHovered: externalHovered 
}: { 
  className?: string; 
  color?: string; 
  isHovered?: boolean;
}) => {
  const [internalHover, setInternalHover] = useState(false);
  const active = externalHovered !== undefined ? externalHovered : internalHover;

  return (
    <svg 
      id="Layer_2" 
      data-name="Layer 2" 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 182.65 116.39"
      className={`${className} transition-all duration-700 ease-out`}
      onMouseEnter={() => setInternalHover(true)}
      onMouseLeave={() => setInternalHover(false)}
      style={{
        transform: active ? 'rotate(45deg)' : 'rotate(0deg)',
        overflow: 'visible'
      }}
    >
      <defs>
        {/* Advanced Glow Filters with optimized bounding area to prevent cropped edges */}
        <filter id="logoGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        
        {/* Neon Laser Line Gradient bridging the two infinity loops */}
        <linearGradient id="laserGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(16, 185, 129, 0)" />
          <stop offset="30%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="70%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="rgba(6, 182, 212, 0)" />
        </linearGradient>

        {/* Embedded SVG Style block to drive the synchronized high-performance fluid comet animations */}
        <style>{`
          @keyframes sparkAnimation1 {
            0% { transform: scale(0.2); opacity: 0; filter: drop-shadow(0 0 2px #10b981); }
            1% { transform: scale(1.6); opacity: 0.95; filter: drop-shadow(0 0 8px #10b981) drop-shadow(0 0 15px #22d3ee); }
            3% { transform: scale(2.4); opacity: 1; filter: drop-shadow(0 0 15px #22d3ee) drop-shadow(0 0 30px #ffffff); }
            5% { transform: scale(2.8); opacity: 1; filter: drop-shadow(0 0 18px #22d3ee) drop-shadow(0 0 35px #ffffff); }
            8% { transform: scale(0.5); opacity: 0; }
            100% { transform: scale(0.2); opacity: 0; }
          }
          @keyframes sparkAnimation2 {
            0%, 34% { transform: scale(0.2); opacity: 0; filter: drop-shadow(0 0 2px #10b981); }
            35% { transform: scale(1.6); opacity: 0.95; filter: drop-shadow(0 0 8px #10b981) drop-shadow(0 0 15px #22d3ee); }
            37% { transform: scale(2.4); opacity: 1; filter: drop-shadow(0 0 15px #22d3ee) drop-shadow(0 0 30px #ffffff); }
            39% { transform: scale(2.8); opacity: 1; filter: drop-shadow(0 0 18px #22d3ee) drop-shadow(0 0 35px #ffffff); }
            42% { transform: scale(0.5); opacity: 0; }
            100% { transform: scale(0.2); opacity: 0; }
          }
          @keyframes sparkAnimation3 {
            0%, 69% { transform: scale(0.2); opacity: 0; filter: drop-shadow(0 0 2px #10b981); }
            70% { transform: scale(1.6); opacity: 0.95; filter: drop-shadow(0 0 8px #10b981) drop-shadow(0 0 15px #22d3ee); }
            72% { transform: scale(2.4); opacity: 1; filter: drop-shadow(0 0 15px #22d3ee) drop-shadow(0 0 30px #ffffff); }
            74% { transform: scale(2.8); opacity: 1; filter: drop-shadow(0 0 18px #22d3ee) drop-shadow(0 0 35px #ffffff); }
            77% { transform: scale(0.5); opacity: 0; }
            100% { transform: scale(0.2); opacity: 0; }
          }

          @keyframes cometFlow1 {
            0% {
              stroke-dashoffset: 100;
              stroke-width: 0px;
              filter: drop-shadow(0 0 0px transparent);
              opacity: 0;
            }
            1% {
              stroke-dashoffset: 100;
              stroke-width: 3.5px;
              filter: drop-shadow(0 0 6px #22d3ee) drop-shadow(0 0 12px #10b981);
              opacity: 1;
            }
            18% {
              stroke-width: 7.5px;
              filter: drop-shadow(0 0 20px #22d3ee) drop-shadow(0 0 12px #10b981) drop-shadow(0 0 30px #ffffff);
            }
            35% {
              stroke-dashoffset: 0;
              stroke-width: 4px;
              filter: drop-shadow(0 0 8px #10b981);
              opacity: 1;
            }
            39% {
              stroke-dashoffset: -25;
              stroke-width: 0px;
              filter: drop-shadow(0 0 0px transparent);
              opacity: 0;
            }
            100% {
              stroke-dashoffset: -25;
              stroke-width: 0px;
              filter: drop-shadow(0 0 0px transparent);
              opacity: 0;
            }
          }

          @keyframes cometFlow2 {
            0%, 34% {
              stroke-dashoffset: 100;
              stroke-width: 0px;
              filter: drop-shadow(0 0 0px transparent);
              opacity: 0;
            }
            35% {
              stroke-dashoffset: 100;
              stroke-width: 3.5px;
              filter: drop-shadow(0 0 6px #22d3ee) drop-shadow(0 0 12px #10b981);
              opacity: 1;
            }
            53% {
              stroke-width: 7.5px;
              filter: drop-shadow(0 0 20px #22d3ee) drop-shadow(0 0 12px #10b981) drop-shadow(0 0 30px #ffffff);
            }
            70% {
              stroke-dashoffset: 0;
              stroke-width: 4px;
              filter: drop-shadow(0 0 8px #10b981);
              opacity: 1;
            }
            74% {
              stroke-dashoffset: -25;
              stroke-width: 0px;
              filter: drop-shadow(0 0 0px transparent);
              opacity: 0;
            }
            100% {
              stroke-dashoffset: -25;
              stroke-width: 0px;
              filter: drop-shadow(0 0 0px transparent);
              opacity: 0;
            }
          }

          @keyframes cometFlow3 {
            0%, 69% {
              stroke-dashoffset: 100;
              stroke-width: 0px;
              filter: drop-shadow(0 0 0px transparent);
              opacity: 0;
            }
            70% {
              stroke-dashoffset: 100;
              stroke-width: 3.5px;
              filter: drop-shadow(0 0 6px #22d3ee) drop-shadow(0 0 12px #10b981);
              opacity: 1;
            }
            82% {
              stroke-width: 7.5px;
              filter: drop-shadow(0 0 20px #22d3ee) drop-shadow(0 0 12px #10b981) drop-shadow(0 0 30px #ffffff);
            }
            93% {
              stroke-dashoffset: 0;
              stroke-width: 4px;
              filter: drop-shadow(0 0 8px #10b981);
              opacity: 1;
            }
            98% {
              stroke-dashoffset: -25;
              stroke-width: 0px;
              filter: drop-shadow(0 0 0px transparent);
              opacity: 0;
            }
            100% {
              stroke-dashoffset: -25;
              stroke-width: 0px;
              filter: drop-shadow(0 0 0px transparent);
              opacity: 0;
            }
          }

          @keyframes coreFlow1 {
            0% { stroke-dashoffset: 100; opacity: 0; }
            1% { stroke-dashoffset: 100; opacity: 1; }
            35% { stroke-dashoffset: 0; opacity: 1; }
            39% { stroke-dashoffset: -25; opacity: 0; }
            100% { stroke-dashoffset: -25; opacity: 0; }
          }
          @keyframes coreFlow2 {
            0%, 34% { stroke-dashoffset: 100; opacity: 0; }
            35% { stroke-dashoffset: 100; opacity: 1; }
            70% { stroke-dashoffset: 0; opacity: 1; }
            74% { stroke-dashoffset: -25; opacity: 0; }
            100% { stroke-dashoffset: -25; opacity: 0; }
          }
          @keyframes coreFlow3 {
            0%, 69% { stroke-dashoffset: 100; opacity: 0; }
            70% { stroke-dashoffset: 100; opacity: 1; }
            93% { stroke-dashoffset: 0; opacity: 1; }
            98% { stroke-dashoffset: -25; opacity: 0; }
            100% { stroke-dashoffset: -25; opacity: 0; }
          }

          .ignition-spark-1 {
            transform-origin: 80.5px 59.2px;
            animation: sparkAnimation1 6s cubic-bezier(0.25, 1, 0.5, 1) infinite;
          }
          .ignition-spark-2 {
            transform-origin: 112.0px 59.2px;
            animation: sparkAnimation2 6s cubic-bezier(0.25, 1, 0.5, 1) infinite;
          }
          .ignition-spark-3 {
            transform-origin: 112.0px 59.2px;
            animation: sparkAnimation3 6s cubic-bezier(0.25, 1, 0.5, 1) infinite;
          }

          .comet-glowing-trail-1 {
            stroke-dasharray: 25, 75;
            animation: cometFlow1 6s linear infinite;
          }
          .comet-glowing-core-1 {
            stroke-dasharray: 2, 98;
            animation: coreFlow1 6s linear infinite;
          }
          .comet-glowing-trail-2 {
            stroke-dasharray: 25, 75;
            animation: cometFlow2 6s linear infinite;
          }
          .comet-glowing-core-2 {
            stroke-dasharray: 2, 98;
            animation: coreFlow2 6s linear infinite;
          }
          .comet-glowing-trail-3 {
            stroke-dasharray: 25, 75;
            animation: cometFlow3 6s linear infinite;
          }
          .comet-glowing-core-3 {
            stroke-dasharray: 2, 98;
            animation: coreFlow3 6s linear infinite;
          }
        `}</style>
      </defs>

      <g id="Layer_1-2" data-name="Layer 1">
        {/* Background Ambient Glow Layer (glowing double infinity effect) */}
        <path 
          style={{ 
            fill: active ? '#10b981' : color, 
            opacity: active ? 0.75 : 0.15,
            filter: active ? 'url(#logoGlow)' : 'none',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)' 
          }} 
          d="M170.09,27.17c-1.36-7.28-7.71-13.74-14.45-14.7-7.99-1.14-14.23,2.13-18.21,9.53-3.6,6.68-5.73,13.94-7.97,21.11-4.99,16-9.62,32.11-14.54,48.13-1.92,6.27-4.63,12.16-10.63,15.73-7.75,4.6-15.52,4.4-22.84-.7-7.2-5-9.87-12.25-8.51-20.81.59-3.67,1.86-7.13,3.48-10.48h-6.59c-1.2,2.85-2.23,5.76-2.87,8.85-3.74,18.1,11.87,35.87,31.63,32.03,10.49-2.04,17.34-8.78,20.59-18.66s20.54-66.22,24.03-73.16c1.95-3.88,6.48-6.12,10.49-5.64,4.84.58,8.84,4.19,10.17,9.17,1.18,4.46-.37,9.31-3.91,11.98-1.68,1.27-3.5,2.31-5.55,2.92-4.04,1.21-8.14,2.02-12.38,2.69l-1.97,6.41c5.72-.87,11.42-1.87,16.95-3.64,9.61-3.08,14.82-11.49,13.08-20.76ZM182.53,27.51c-1.89-21.82-25.56-34.41-44.27-23.52-7.39,4.3-11.58,11.1-14.5,18.85-3.05,8.12-5.8,16.33-8.24,24.65-.53,1.81-2.73,1.89-4.67,1.99-1.53.08-24.18.79-24.93.81-3.64.09-7.27.15-10.91.31-1.41.06-1.73-.45-1.33-1.71,2.11-6.71,4.1-13.46,6.37-20.11,1.18-3.46,3.69-5.75,7.53-5.95,3.48-.18,6,1.56,7.9,4.55,1.06,1.97,1.28,4.16.85,6.47-.66,3.61-2.25,6.72-4.17,9.65h6.95c.95-1.84,1.75-3.76,2.42-5.73,2.09-6.16,1.27-11.91-3.24-16.73-5.69-6.08-18.04-7.16-23.27,4.38-2.99,6.59-4.51,13.67-6.63,20.55-4.86,15.77-9.29,31.69-16.41,46.66-2.49,5.22-6.01,9.66-11.31,12.29-11.54,5.73-25.14,1.36-31.33-9.96-6.27-11.47-2.59-25.02,8.86-31.8,2.09-1.35,4.63-2.37,7.36-2.92,6.52-1.33,13.1-2.07,19.71-2.59l1.9-6.2c-6.26.38-12.51.91-18.71,1.99-4.87.85-9.69,1.96-13.35,4.37C.33,66.75-4.38,85.02,4.44,99.05c6.45,10.26,16.11,15.5,28.3,14.54,11.38-.89,19.21-7.48,24.26-17.47,2.19-4.33,4.06-8.82,5.66-13.41,1.39-3.96,2.81-7.91,4.24-11.86.05-.16.11-.32.17-.48.59-1.63,2.02-2.26,4.74-2.28,1.45-.01,31.91-.3,35.3-.44,1.63-.07,2.23.57,1.72,2.18-2.22,7.02-4.03,14.17-6.61,21.07-.9,2.39-2.42,4.38-4.54,5.82-2.83,1.39-5.61,1.63-8.36-.07-2.96-1.85-4.65-4.49-4.54-8.04.09-3.31,1.38-6.28,2.81-9.21.75-1.55,1.62-3.01,2.56-4.42h-6.89c-.39.66-.75,1.33-1.09,2.02-1.52,3.06-2.89,6.15-3.31,9.6-.99,7.97,3.57,15.03,10.96,16.88,7.57,1.89,15.06-2.09,17.78-9.76,3.74-10.54,6.63-21.34,9.87-32.03,4.14-13.63,7.96-27.37,13.65-40.49,4.34-9.99,13.81-15.92,24.08-14.93,10.09.98,18.49,8.76,20.82,19.28,2.18,9.83-2.67,20.49-11.68,25.66-5.67,3.25-12.05,4.18-18.29,5.48-2.64.55-5.31.99-7.99,1.39l-1.96,6.4c7.88-1.11,15.73-2.42,23.44-4.55,14.83-4.09,24.29-17.33,22.99-32.42ZM109.7,61.66c-5.42.2-10.84.3-16.26.42-6.8.14-13.6.3-20.39.35-1.02.01-2.87.14-2.95-.74-.1-1.15.15-2.31.62-3.45.42-1.03,1.39-1.75,2.49-1.77,0,0,.01,0,.02,0,12.22-.29,24.44-.61,36.66-.81.9,0,2.79.05,2.78,1.18-.01,2.43-1.32,4.76-2.97,4.82ZM110.4,16.63c-7.56-11.7-22.41-15.72-34.29-9.38-7.49,4.01-11.69,10.54-14.15,18.35-2.4,7.65-13.73,44.56-14.2,45.8-2.29,5.96-4.28,12.04-7.47,17.62-2.51,4.4-7.51,6.97-11.95,6.17-4.53-.82-8.67-5.09-9.56-9.88-.85-4.6,1.25-9.16,5.33-11.56,1.33-.82,2.8-1.28,4.28-1.67,4.3-1.12,8.68-1.67,13.08-2.06l1.88-6.12c-6.35.42-12.67,1.05-18.78,2.98-7.69,2.42-12.78,10.03-12.1,17.89.74,8.42,7.04,15.04,15.17,16.31,7.82,1.22,13.55-1.99,17.37-8.41,4.43-7.47,7.32-15.67,9.92-23.94,4.54-14.44,8.87-28.95,13.62-43.32,3.68-11.13,14.64-17.29,24.51-14.29,11.29,3.43,17.26,13.17,15.14,24.79-.48,2.65-1.27,5.18-2.37,7.59h6.51c3.52-9.1,3.74-18.09-1.94-26.87Z" 
        />

        {/* Foreground Sharp Crisp Layer */}
        <path 
          style={{ 
            fill: active ? '#10b981' : color, 
            transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' 
          }} 
          d="M170.09,27.17c-1.36-7.28-7.71-13.74-14.45-14.7-7.99-1.14-14.23,2.13-18.21,9.53-3.6,6.68-5.73,13.94-7.97,21.11-4.99,16-9.62,32.11-14.54,48.13-1.92,6.27-4.63,12.16-10.63,15.73-7.75,4.6-15.52,4.4-22.84-.7-7.2-5-9.87-12.25-8.51-20.81.59-3.67,1.86-7.13,3.48-10.48h-6.59c-1.2,2.85-2.23,5.76-2.87,8.85-3.74,18.1,11.87,35.87,31.63,32.03,10.49-2.04,17.34-8.78,20.59-18.66s20.54-66.22,24.03-73.16c1.95-3.88,6.48-6.12,10.49-5.64,4.84.58,8.84,4.19,10.17,9.17,1.18,4.46-.37,9.31-3.91,11.98-1.68,1.27-3.5,2.31-5.55,2.92-4.04,1.21-8.14,2.02-12.38,2.69l-1.97,6.41c5.72-.87,11.42-1.87,16.95-3.64,9.61-3.08,14.82-11.49,13.08-20.76ZM182.53,27.51c-1.89-21.82-25.56-34.41-44.27-23.52-7.39,4.3-11.58,11.1-14.5,18.85-3.05,8.12-5.8,16.33-8.24,24.65-.53,1.81-2.73,1.89-4.67,1.99-1.53.08-24.18.79-24.93.81-3.64.09-7.27.15-10.91.31-1.41.06-1.73-.45-1.33-1.71,2.11-6.71,4.1-13.46,6.37-20.11,1.18-3.46,3.69-5.75,7.53-5.95,3.48-.18,6,1.56,7.9,4.55,1.06,1.97,1.28,4.16.85,6.47-.66,3.61-2.25,6.72-4.17,9.65h6.95c.95-1.84,1.75-3.76,2.42-5.73,2.09-6.16,1.27-11.91-3.24-16.73-5.69-6.08-18.04-7.16-23.27,4.38-2.99,6.59-4.51,13.67-6.63,20.55-4.86,15.77-9.29,31.69-16.41,46.66-2.49,5.22-6.01,9.66-11.31,12.29-11.54,5.73-25.14,1.36-31.33-9.96-6.27-11.47-2.59-25.02,8.86-31.8,2.09-1.35,4.63-2.37,7.36-2.92,6.52-1.33,13.1-2.07,19.71-2.59l1.9-6.2c-6.26.38-12.51.91-18.71,1.99-4.87.85-9.69,1.96-13.35,4.37C.33,66.75-4.38,85.02,4.44,99.05c6.45,10.26,16.11,15.5,28.3,14.54,11.38-.89,19.21-7.48,24.26-17.47,2.19-4.33,4.06-8.82,5.66-13.41,1.39-3.96,2.81-7.91,4.24-11.86.05-.16.11-.32.17-.48.59-1.63,2.02-2.26,4.74-2.28,1.45-.01,31.91-.3,35.3-.44,1.63-.07,2.23.57,1.72,2.18-2.22,7.02-4.03,14.17-6.61,21.07-.9,2.39-2.42,4.38-4.54,5.82-2.83,1.39-5.61,1.63-8.36-.07-2.96-1.85-4.65-4.49-4.54-8.04.09-3.31,1.38-6.28,2.81-9.21.75-1.55,1.62-3.01,2.56-4.42h-6.89c-.39.66-.75,1.33-1.09,2.02-1.52,3.06-2.89,6.15-3.31,9.6-.99,7.97,3.57,15.03,10.96,16.88,7.57,1.89,15.06-2.09,17.78-9.76,3.74-10.54,6.63-21.34,9.87-32.03,4.14-13.63,7.96-27.37,13.65-40.49,4.34-9.99,13.81-15.92,24.08-14.93,10.09.98,18.49,8.76,20.82,19.28,2.18,9.83-2.67,20.49-11.68,25.66-5.67,3.25-12.05,4.18-18.29,5.48-2.64.55-5.31.99-7.99,1.39l-1.96,6.4c7.88-1.11,15.73-2.42,23.44-4.55,14.83-4.09,24.29-17.33,22.99-32.42ZM109.7,61.66c-5.42.2-10.84.3-16.26.42-6.8.14-13.6.3-20.39.35-1.02.01-2.87.14-2.95-.74-.1-1.15.15-2.31.62-3.45.42-1.03,1.39-1.75,2.49-1.77,0,0,.01,0,.02,0,12.22-.29,24.44-.61,36.66-.81.9,0,2.79.05,2.78,1.18-.01,2.43-1.32,4.76-2.97,4.82ZM110.4,16.63c-7.56-11.7-22.41-15.72-34.29-9.38-7.49,4.01-11.69,10.54-14.15,18.35-2.4,7.65-13.73,44.56-14.2,45.8-2.29,5.96-4.28,12.04-7.47,17.62-2.51,4.4-7.51,6.97-11.95,6.17-4.53-.82-8.67-5.09-9.56-9.88-.85-4.6,1.25-9.16,5.33-11.56,1.33-.82,2.8-1.28,4.28-1.67,4.3-1.12,8.68-1.67,13.08-2.06l1.88-6.12c-6.35.42-12.67,1.05-18.78,2.98-7.69,2.42-12.78,10.03-12.1,17.89.74,8.42,7.04,15.04,15.17,16.31,7.82,1.22,13.55-1.99,17.37-8.41,4.43-7.47,7.32-15.67,9.92-23.94,4.54-14.44,8.87-28.95,13.62-43.32,3.68-11.13,14.64-17.29,24.51-14.29,11.29,3.43,17.26,13.17,15.14,24.79-.48,2.65-1.27,5.18-2.37,7.59h6.51c3.52-9.1,3.74-18.09-1.94-26.87Z" 
        />

        {/* Dynamic, Sequential Multi-Comet Sequential Flow representing the double-infinity division */}
        {active && (
          <g style={{ mixBlendMode: 'plus-lighter' }}>

            {/* ========================================================= */}
            {/* COMET 1: UPPER INFINITY LOOP (Guided by Image 1)         */}
            {/* ========================================================= */}
            
            {/* Static trace baseline guide */}
            <path 
              style={{ opacity: 0.05, filter: 'url(#logoGlow)' }}
              stroke="#10b981"
              strokeWidth="2.0"
              fill="none"
              d="M 80.5,59.2 C 75.0,32.0 64.0,32.0 42.5,32.0 C 24.0,31.0 13.5,50.0 13.5,76.0 C 13.5,100.0 29.5,109.5 47.0,100.0 C 60.0,92.5 71.5,74.5 80.5,59.2 C 88.0,46.0 95.0,32.0 95.0,22.0 C 95.0,12.0 86.0,11.5 77.0,14.5 C 68.0,17.5 64.0,32.0 75.0,59.2"
            />

            {/* Spark Fire starting node at upper infinity midpoint cross */}
            <circle 
              cx="80.5" 
              cy="59.2" 
              r="2.5" 
              fill="#ffffff" 
              className="ignition-spark-1"
            />

            {/* Glowing Custom Comet Trail */}
            <path 
              className="comet-glowing-trail-1"
              stroke="url(#laserGrad)" 
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M 80.5,59.2 C 75.0,32.0 64.0,32.0 42.5,32.0 C 24.0,31.0 13.5,50.0 13.5,76.0 C 13.5,100.0 29.5,109.5 47.0,100.0 C 60.0,92.5 71.5,74.5 80.5,59.2 C 88.0,46.0 95.0,32.0 95.0,22.0 C 95.0,12.0 86.0,11.5 77.0,14.5 C 68.0,17.5 64.0,32.0 75.0,59.2"
            />

            {/* Sharp white core */}
            <path 
              className="comet-glowing-core-1"
              stroke="#ffffff" 
              strokeWidth="2.0"
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M 80.5,59.2 C 75.0,32.0 64.0,32.0 42.5,32.0 C 24.0,31.0 13.5,50.0 13.5,76.0 C 13.5,100.0 29.5,109.5 47.0,100.0 C 60.0,92.5 71.5,74.5 80.5,59.2 C 88.0,46.0 95.0,32.0 95.0,22.0 C 95.0,12.0 86.0,11.5 77.0,14.5 C 68.0,17.5 64.0,32.0 75.0,59.2"
            />


            {/* ========================================================= */}
            {/* COMET 2: LOWER INFINITY LOOP (Guided by Image 2)         */}
            {/* ========================================================= */}

            {/* Static trace baseline guide */}
            <path 
              style={{ opacity: 0.05, filter: 'url(#logoGlow)' }}
              stroke="#10b981"
              strokeWidth="2.0"
              fill="none"
              d="M 112.0,59.2 C 123.0,32.0 119.0,17.5 110.0,14.5 C 101.0,11.5 92.0,12.0 92.0,22.0 C 92.0,32.0 99.0,46.0 106.5,59.2 C 115.5,74.5 127.0,92.5 140.0,100.0 C 157.5,109.5 173.5,100.0 173.5,76.0 C 173.5,50.0 163.0,31.0 144.5,32.0 C 127.0,32.0 115.5,46.0 112.0,59.2"
            />

            {/* Spark Fire starting node at lower-right infinity midpoint cross */}
            <circle 
              cx="112.0" 
              cy="59.2" 
              r="2.5" 
              fill="#ffffff" 
              className="ignition-spark-2"
            />

            {/* Glowing Custom Comet Trail */}
            <path 
              className="comet-glowing-trail-2"
              stroke="url(#laserGrad)" 
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M 112.0,59.2 C 123.0,32.0 119.0,17.5 110.0,14.5 C 101.0,11.5 92.0,12.0 92.0,22.0 C 92.0,32.0 99.0,46.0 106.5,59.2 C 115.5,74.5 127.0,92.5 140.0,100.0 C 157.5,109.5 173.5,100.0 173.5,76.0 C 173.5,50.0 163.0,31.0 144.5,32.0 C 127.0,32.0 115.5,46.0 112.0,59.2"
            />

            {/* Sharp white core */}
            <path 
              className="comet-glowing-core-2"
              stroke="#ffffff" 
              strokeWidth="2.0"
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M 112.0,59.2 C 123.0,32.0 119.0,17.5 110.0,14.5 C 101.0,11.5 92.0,12.0 92.0,22.0 C 92.0,32.0 99.0,46.0 106.5,59.2 C 115.5,74.5 127.0,92.5 140.0,100.0 C 157.5,109.5 173.5,100.0 173.5,76.0 C 173.5,50.0 163.0,31.0 144.5,32.0 C 127.0,32.0 115.5,46.0 112.0,59.2"
            />


            {/* ========================================================= */}
            {/* COMET 3: DIAGONAL CONNECTOR BRIDGE (Guided by Image 3)   */}
            {/* ========================================================= */}

            {/* Static trace baseline guide */}
            <path 
              style={{ opacity: 0.05, filter: 'url(#logoGlow)' }}
              stroke="#10b981"
              strokeWidth="2.0"
              fill="none"
              d="M 112.0,59.2 L 80.5,59.2"
            />

            {/* Spark Fire starting node at lower-right midpoint to bridge over to upper */}
            <circle 
              cx="112.0" 
              cy="59.2" 
              r="2.5" 
              fill="#ffffff" 
              className="ignition-spark-3"
            />

            {/* Glowing Custom Comet Trail */}
            <path 
              className="comet-glowing-trail-3"
              stroke="url(#laserGrad)" 
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M 112.0,59.2 L 80.5,59.2"
            />

            {/* Sharp white core */}
            <path 
              className="comet-glowing-core-3"
              stroke="#ffffff" 
              strokeWidth="2.0"
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M 112.0,59.2 L 80.5,59.2"
            />

          </g>
        )}
      </g>
    </svg>
  );
};
