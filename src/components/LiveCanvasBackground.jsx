import React, { useEffect, useRef } from 'react';

function LiveCanvasBackground({ type = 'none' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (type === 'none') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resize = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement.clientHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Track mouse coordinates for interactive background effects
    let mouse = { x: -1000, y: -1000 };
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    if (type === 'interactive-particles') {
      const particleCount = 55;
      const particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * (canvas.width || 1000),
        y: Math.random() * (canvas.height || 800),
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2.5 + 1.2,
        color: ['#818cf8', '#c084fc', '#38bdf8', '#34d399'][Math.floor(Math.random() * 4)]
      }));

      const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach((p) => {
          // Magnetic reaction to mouse
          const mdx = mouse.x - p.x;
          const mdy = mouse.y - p.y;
          const mdist = Math.hypot(mdx, mdy);

          if (mdist < 140) {
            const force = (140 - mdist) / 140;
            p.x -= (mdx / mdist) * force * 2.5;
            p.y -= (mdy / mdist) * force * 2.5;

            // Draw laser stream line to mouse cursor
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = force * 0.6;
            ctx.lineWidth = 1;
            ctx.shadowBlur = 6;
            ctx.shadowColor = p.color;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.8;
          ctx.fill();
        });

        animationFrameId = requestAnimationFrame(render);
      };

      render();
    } else if (type === 'constellation') {
      const nodeCount = 45;
      const nodes = Array.from({ length: nodeCount }, () => ({
        x: Math.random() * (canvas.width || 1000),
        y: Math.random() * (canvas.height || 800),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 1.8
      }));

      const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        nodes.forEach((n, i) => {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
          if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(165, 180, 252, 0.8)';
          ctx.fill();

          // Connect to mouse if near
          const mdist = Math.hypot(mouse.x - n.x, mouse.y - n.y);
          if (mdist < 150) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(168, 85, 247, ${0.45 * (1 - mdist / 150)})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

          for (let j = i + 1; j < nodes.length; j++) {
            const n2 = nodes[j];
            const dist = Math.hypot(n2.x - n.x, n2.y - n.y);
            if (dist < 130) {
              ctx.beginPath();
              ctx.moveTo(n.x, n.y);
              ctx.lineTo(n2.x, n2.y);
              ctx.strokeStyle = `rgba(99, 102, 241, ${0.28 * (1 - dist / 130)})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        });
        animationFrameId = requestAnimationFrame(render);
      };

      render();
    } else if (type === 'floating-stardust') {
      const particleCount = 45;
      const particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * (canvas.width || 1000),
        y: Math.random() * (canvas.height || 800),
        radius: Math.random() * 2 + 0.6,
        alpha: Math.random() * 0.7 + 0.2,
        speedY: Math.random() * 0.35 + 0.1,
        pulseSpeed: Math.random() * 0.02 + 0.005,
        color: ['#818cf8', '#c084fc', '#38bdf8', '#e879f9'][Math.floor(Math.random() * 4)]
      }));

      const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p) => {
          p.y -= p.speedY;
          if (p.y < 0) {
            p.y = canvas.height;
            p.x = Math.random() * canvas.width;
          }
          p.alpha += Math.sin(Date.now() * p.pulseSpeed) * 0.008;
          const clampedAlpha = Math.max(0.1, Math.min(0.85, p.alpha));

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = clampedAlpha;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        animationFrameId = requestAnimationFrame(render);
      };

      render();
    } else if (type === 'matrix-rain') {
      const fontSize = 14;
      const columns = Math.floor((canvas.width || 1000) / fontSize);
      const drops = Array(columns).fill(1);
      const chars = '0123456789ABCDEF';
      let lastTime = 0;
      const fpsInterval = 70;

      const render = (currentTime) => {
        animationFrameId = requestAnimationFrame(render);
        const elapsed = currentTime - lastTime;
        if (elapsed < fpsInterval) return;
        lastTime = currentTime - (elapsed % fpsInterval);

        ctx.fillStyle = 'rgba(10, 10, 12, 0.18)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#10b981';
        ctx.font = `${fontSize}px monospace`;

        for (let i = 0; i < drops.length; i++) {
          const text = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);
          if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
          }
          drops[i]++;
        }
      };

      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [type]);

  if (type === 'none') return null;

  if (
    type === 'circuit-flow' || 
    type === 'interactive-particles' || 
    type === 'constellation' || 
    type === 'floating-stardust' || 
    type === 'matrix-rain'
  ) {
    return (
      <canvas
        ref={canvasRef}
        className="live-canvas-bg"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.9
        }}
      />
    );
  }

  return (
    <div
      className={`live-bg-container live-bg-${type}`}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden'
      }}
    />
  );
}

export default LiveCanvasBackground;
