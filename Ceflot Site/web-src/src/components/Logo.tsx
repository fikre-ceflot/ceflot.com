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
            0% { transform: scale(0.1); opacity: 0; }
            3% { transform: scale(1.4); opacity: 0.9; filter: drop-shadow(0 0 3px #22d3ee) drop-shadow(0 0 6px #ffffff); }
            11% { transform: scale(0.1); opacity: 0; }
            100% { transform: scale(0.1); opacity: 0; }
          }
          @keyframes sparkAnimation2 {
            0%, 51% { transform: scale(0.1); opacity: 0; }
            54.4% { transform: scale(1.4); opacity: 0.9; filter: drop-shadow(0 0 3px #22d3ee) drop-shadow(0 0 6px #ffffff); }
            62% { transform: scale(0.1); opacity: 0; }
            100% { transform: scale(0.1); opacity: 0; }
          }

          @keyframes cometFlow1 {
            /* Path 1: 0% to 84.4% active (continuous flow) */
            0% {
              stroke-dashoffset: 155;
              stroke-width: 0px;
              opacity: 0;
              filter: drop-shadow(0 0 0px transparent);
            }
            2.2% {
              stroke-dashoffset: 155;
              stroke-width: 3.5px;
              opacity: 1;
              filter: drop-shadow(0 0 6px #22d3ee) drop-shadow(0 0 12px #0ea5e9);
            }
            33.3% {
              stroke-width: 5.5px;
              opacity: 1;
              filter: drop-shadow(0 0 12px #22d3ee) drop-shadow(0 0 20px #0ea5e9) drop-shadow(0 0 30px #ffffff);
            }
            55.6% {
              stroke-dashoffset: 90;
              stroke-width: 4.5px;
              opacity: 1;
              filter: drop-shadow(0 0 10px #22d3ee);
            }
            71.1% {
              stroke-dashoffset: 60;
              stroke-width: 2.0px;
              opacity: 0.4;
              filter: drop-shadow(0 0 3px #22d3ee);
            }
            80.0% {
              stroke-dashoffset: 40;
              stroke-width: 0.8px;
              opacity: 0.1;
              filter: drop-shadow(0 0 1px #22d3ee);
            }
            84.4%, 100% {
              stroke-dashoffset: 25;
              stroke-width: 0px;
              opacity: 0;
              filter: drop-shadow(0 0 0px transparent);
            }
          }

          @keyframes cometFlow2 {
            /* Path 2: 51.1% to 100% active (seamless repeat trigger) */
            0%, 51.1% {
              stroke-dashoffset: 155;
              stroke-width: 0px;
              opacity: 0;
              filter: drop-shadow(0 0 0px transparent);
            }
            53.3% {
              stroke-dashoffset: 155;
              stroke-width: 3.5px;
              opacity: 1;
              filter: drop-shadow(0 0 6px #22d3ee) drop-shadow(0 0 12px #0ea5e9);
            }
            66.6% {
              stroke-width: 5.5px;
              opacity: 1;
              filter: drop-shadow(0 0 12px #22d3ee) drop-shadow(0 0 20px #0ea5e9) drop-shadow(0 0 30px #ffffff);
            }
            82.2% {
              stroke-dashoffset: 90;
              stroke-width: 4.5px;
              opacity: 1;
              filter: drop-shadow(0 0 10px #22d3ee);
            }
            91.1% {
              stroke-dashoffset: 60;
              stroke-width: 2.0px;
              opacity: 0.4;
              filter: drop-shadow(0 0 3px #22d3ee);
            }
            97.7% {
              stroke-dashoffset: 40;
              stroke-width: 0.8px;
              opacity: 0.1;
              filter: drop-shadow(0 0 1px #22d3ee);
            }
            100% {
              stroke-dashoffset: 25;
              stroke-width: 0px;
              opacity: 0;
              filter: drop-shadow(0 0 0px transparent);
            }
          }

          .ignition-spark-1 {
            transform-origin: 32.39px 53.91px;
            animation: sparkAnimation1 2.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
          }
          .ignition-spark-2 {
            transform-origin: 141.07px 46.75px;
            animation: sparkAnimation2 2.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
          }

          .comet-glowing-trail-1 {
            stroke-dasharray: 25, 105;
            animation: cometFlow1 2.2s linear infinite;
          }
          .comet-glowing-core-1 {
            stroke-dasharray: 0, 23, 3, 104;
            animation: cometFlow1 2.2s linear infinite;
          }
          .comet-glowing-trail-2 {
            stroke-dasharray: 25, 105;
            animation: cometFlow2 2.2s linear infinite;
          }
          .comet-glowing-core-2 {
            stroke-dasharray: 0, 23, 3, 104;
            animation: cometFlow2 2.2s linear infinite;
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
          <g style={{ mixBlendMode: 'plus-lighter' }} transform="translate(6.57, 10.39)">

            {/* ========================================================= */}
            {/* COMET 1 (Stage 1): THE EXPANSIVE INTEGRATED SERPENTINE LOOP */}
            {/* ========================================================= */}
            
            {/* Static trace baseline guide */}
            <path 
              style={{ opacity: 0.05, filter: 'url(#logoGlow)' }}
              stroke="#22d3ee"
              strokeWidth="2.0"
              fill="none"
              d="M32.39,53.91c-7.09.6-19.35,2.41-24.15,7.83-22.3,25.19,21.3,52.36,34.31,21,7.66-18.47,16.34-48.99,21.12-62.88,7.85-22.84,37.67-16.67,34.57,7.85-2.3,18.22-19.58,29.94-26.66,42.3-14.53,25.37,22.52,42.74,32.73,16.57,10.97-28.1,15.86-64.39,24.62-75.48,11.5-14.56,28.85-10.45,36.02,3.88,6.59,13.18-2.55,28.66-23.88,31.77"
            />

            {/* Glowing Custom Comet Trail */}
            <path 
              className="comet-glowing-trail-1"
              stroke="#22d3ee" 
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M32.39,53.91c-7.09.6-19.35,2.41-24.15,7.83-22.3,25.19,21.3,52.36,34.31,21,7.66-18.47,16.34-48.99,21.12-62.88,7.85-22.84,37.67-16.67,34.57,7.85-2.3,18.22-19.58,29.94-26.66,42.3-14.53,25.37,22.52,42.74,32.73,16.57,10.97-28.1,15.86-64.39,24.62-75.48,11.5-14.56,28.85-10.45,36.02,3.88,6.59,13.18-2.55,28.66-23.88,31.77"
            />

            {/* Sharp white core */}
            <path 
              className="comet-glowing-core-1"
              stroke="#ffffff" 
              strokeWidth="2.0"
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M32.39,53.91c-7.09.6-19.35,2.41-24.15,7.83-22.3,25.19,21.3,52.36,34.31,21,7.66-18.47,16.34-48.99,21.12-62.88,7.85-22.84,37.67-16.67,34.57,7.85-2.3,18.22-19.58,29.94-26.66,42.3-14.53,25.37,22.52,42.74,32.73,16.57,10.97-28.1,15.86-64.39,24.62-75.48,11.5-14.56,28.85-10.45,36.02,3.88,6.59,13.18-2.55,28.66-23.88,31.77"
            />

            {/* Spark Fire starting node on top of start point */}
            <circle 
              cx="32.39" 
              cy="53.91" 
              r="2.5" 
              fill="#ffffff" 
              className="ignition-spark-1"
            />


            {/* ========================================================= */}
            {/* COMET 2 (Stage 2): THE RETURNING DIAGONAL CONNECTOR STRIP */}
            {/* ========================================================= */}

            {/* Static trace baseline guide */}
            <path 
              style={{ opacity: 0.05, filter: 'url(#logoGlow)' }}
              stroke="#22d3ee"
              strokeWidth="2.0"
              fill="none"
              d="M141.07,46.75 L68.76,48.92"
            />

            {/* Glowing Custom Comet Trail */}
            <path 
              className="comet-glowing-trail-2"
              stroke="#22d3ee" 
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M141.07,46.75 L68.76,48.92"
            />

            {/* Sharp white core */}
            <path 
              className="comet-glowing-core-2"
              stroke="#ffffff" 
              strokeWidth="2.0"
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M141.07,46.75 L68.76,48.92"
            />

            {/* Spark Fire starting node on top of second path start point */}
            <circle 
              cx="141.07" 
              cy="46.75" 
              r="2.5" 
              fill="#ffffff" 
              className="ignition-spark-2"
            />

          </g>
        )}
      </g>
    </svg>
  );
};

export const CeflotBackgroundFlare = ({ 
  intensity = 0.15,
  className = "absolute bottom-[450px] right-[100px] w-[1000px] h-[1000px]"
}: { 
  intensity?: number; 
  className?: string;
}) => {
  return (
    <div 
      id="ceflot-bg-flare-root"
      className={`${className} pointer-events-none overflow-hidden select-none z-0`}
      style={{ opacity: intensity }}
    >
      <div 
        className="w-full h-full flex items-center justify-center opacity-75 mix-blend-screen"
        style={{ 
          willChange: 'transform',
          transform: 'rotate(45deg)'
        }}
      >
        <svg 
          id="ceflot-bg-flare-svg"
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 182.65 116.39"
          className="w-full h-full"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <style>{`
              @keyframes bgCometFlow1 {
                /* Path 1: 0% to 84.4% active (50% slow majestic drift, ultra-faint trail) */
                0% {
                  stroke-dashoffset: 155;
                  stroke-width: 0px;
                  opacity: 0;
                }
                2.2% {
                  stroke-dashoffset: 155;
                  stroke-width: 1.0px;
                  opacity: 0.15;
                }
                33.3% {
                  stroke-width: 1.8px;
                  opacity: 0.20;
                }
                55.6% {
                  stroke-dashoffset: 90;
                  stroke-width: 1.5px;
                  opacity: 0.15;
                }
                71.1% {
                  stroke-dashoffset: 60;
                  stroke-width: 0.8px;
                  opacity: 0.05;
                }
                80% {
                  stroke-dashoffset: 40;
                  stroke-width: 0.4px;
                  opacity: 0.01;
                }
                84.4%, 100% {
                  stroke-dashoffset: 25;
                  stroke-width: 0px;
                  opacity: 0;
                }
              }

              @keyframes bgCometFlow2 {
                /* Path 2: 51.1% to 100% active (50% slow majestic drift, ultra-faint trail) */
                0%, 51.1% {
                  stroke-dashoffset: 155;
                  stroke-width: 0px;
                  opacity: 0;
                }
                53.3% {
                  stroke-dashoffset: 155;
                  stroke-width: 1.0px;
                  opacity: 0.15;
                }
                66.6% {
                  stroke-width: 1.8px;
                  opacity: 0.20;
                }
                82.2% {
                  stroke-dashoffset: 90;
                  stroke-width: 1.5px;
                  opacity: 0.15;
                }
                91.1% {
                  stroke-dashoffset: 60;
                  stroke-width: 0.8px;
                  opacity: 0.05;
                }
                97.7% {
                  stroke-dashoffset: 40;
                  stroke-width: 0.4px;
                  opacity: 0.01;
                }
                100% {
                  stroke-dashoffset: 25;
                  stroke-width: 0px;
                  opacity: 0;
                }
              }

              .bg-comet-trail-1 {
                stroke-dasharray: 25, 105;
                animation: bgCometFlow1 4.4s linear infinite;
              }
              .bg-comet-core-1 {
                stroke-dasharray: 0, 23, 3, 104;
                animation: bgCometFlow1 4.4s linear infinite;
              }
              .bg-comet-trail-2 {
                stroke-dasharray: 25, 105;
                animation: bgCometFlow2 4.4s linear infinite;
              }
              .bg-comet-core-2 {
                stroke-dasharray: 0, 23, 3, 104;
                animation: bgCometFlow2 4.4s linear infinite;
              }
            `}</style>
          </defs>

          <g style={{ mixBlendMode: 'plus-lighter' }} transform="translate(6.57, 10.39)">
            {/* COMPONENT FLARE 1 */}
            <path 
              className="bg-comet-trail-1"
              stroke="#22d3ee" 
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M32.39,53.91c-7.09.6-19.35,2.41-24.15,7.83-22.3,25.19,21.3,52.36,34.31,21,7.66-18.47,16.34-48.99,21.12-62.88,7.85-22.84,37.67-16.67,34.57,7.85-2.3,18.22-19.58,29.94-26.66,42.3-14.53,25.37,22.52,42.74,32.73,16.57,10.97-28.1,15.86-64.39,24.62-75.48,11.5-14.56,28.85-10.45,36.02,3.88,6.59,13.18-2.55,28.66-23.88,31.77"
            />
            <path 
              className="bg-comet-core-1"
              stroke="#ffffff" 
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M32.39,53.91c-7.09.6-19.35,2.41-24.15,7.83-22.3,25.19,21.3,52.36,34.31,21,7.66-18.47,16.34-48.99,21.12-62.88,7.85-22.84,37.67-16.67,34.57,7.85-2.3,18.22-19.58,29.94-26.66,42.3-14.53,25.37,22.52,42.74,32.73,16.57,10.97-28.1,15.86-64.39,24.62-75.48,11.5-14.56,28.85-10.45,36.02,3.88,6.59,13.18-2.55,28.66-23.88,31.77"
            />

            {/* COMPONENT FLARE 2 */}
            <path 
              className="bg-comet-trail-2"
              stroke="#22d3ee" 
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M141.07,46.75 L68.76,48.92"
            />
            <path 
              className="bg-comet-core-2"
              stroke="#ffffff" 
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              d="M141.07,46.75 L68.76,48.92"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};

