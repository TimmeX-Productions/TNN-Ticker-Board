import { useEffect, useRef } from 'react';

interface MatrixPreviewProps {
  settings: any;
  message: string;
  news: any;
}

export default function MatrixPreview({ settings, message, news }: MatrixPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rows = settings.hardware?.rows || 32;
    const cols = (settings.hardware?.cols || 64) * (settings.hardware?.chain_length || 1);
    
    // Set canvas dimensions to match matrix aspect ratio
    const pixelSize = 4;
    canvas.width = cols * pixelSize;
    canvas.height = rows * pixelSize;

    let animationFrameId: number;
    let pos = canvas.width;

    const render = () => {
      // Clear background
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid to simulate LEDs
      ctx.fillStyle = '#111111';
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.beginPath();
          ctx.arc(i * pixelSize + pixelSize/2, j * pixelSize + pixelSize/2, pixelSize/2 - 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw text
      const defaultColor = settings.color || '#ffffff';
      const brightness = (settings.brightness || 100) / 100;
      
      ctx.globalAlpha = brightness;
      ctx.font = `${rows * pixelSize * 0.8}px 'Share Tech Mono', monospace`;
      ctx.textBaseline = 'middle';

      let displayText = message;
      if (!displayText && news) {
        displayText = `NEWS: ${news.title}`;
      }
      if (!displayText) {
        displayText = "Waiting for messages...";
      }

      // Parse colors
      const parts = displayText.split(/(\{.*?\})/g);
      
      const colors: Record<string, string> = {
        '{r}': '#ff0000',
        '{g}': '#00ff00',
        '{b}': '#0064ff',
        '{y}': '#ffff00',
        '{w}': '#ffffff',
        '{c}': '#00ffff',
        '{d}': defaultColor
      };

      let currentX = settings.mode === 'static' ? 10 : pos;
      let currentColor = defaultColor;

      parts.forEach(part => {
        if (colors[part]) {
          currentColor = colors[part];
        } else if (part.startsWith('{img:') && part.endsWith('}')) {
          // Simulate image placeholder
          ctx.fillStyle = '#333';
          const imgSize = rows * pixelSize * 0.8;
          ctx.fillRect(currentX, canvas.height / 2 - imgSize / 2, imgSize, imgSize);
          currentX += imgSize + 8;
        } else if (part) {
          ctx.fillStyle = currentColor;
          // Add a slight glow effect
          ctx.shadowColor = currentColor;
          ctx.shadowBlur = 4;
          ctx.fillText(part, currentX, canvas.height / 2);
          ctx.shadowBlur = 0;
          currentX += ctx.measureText(part).width;
        }
      });

      if (settings.mode !== 'static') {
        const speed = settings.speed || 50;
        pos -= (speed / 20);
        
        if (currentX < 0) {
          pos = canvas.width;
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [settings, message, news]);

  return (
    <div className="w-full overflow-hidden bg-black rounded-lg border-2 border-zinc-800 p-4 flex items-center justify-center shadow-inner relative">
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-10"></div>
      <canvas 
        ref={canvasRef} 
        className="max-w-full h-auto shadow-[0_0_30px_rgba(255,100,0,0.1)] relative z-0"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
