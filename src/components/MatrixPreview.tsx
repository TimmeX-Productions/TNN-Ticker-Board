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
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1;
      for (let i = 0; i <= cols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * pixelSize, 0);
        ctx.lineTo(i * pixelSize, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i <= rows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * pixelSize);
        ctx.lineTo(canvas.width, i * pixelSize);
        ctx.stroke();
      }

      // Draw text
      const color = settings.color || '#ffffff';
      const brightness = (settings.brightness || 100) / 100;
      
      ctx.fillStyle = color;
      ctx.globalAlpha = brightness;
      ctx.font = `${rows * pixelSize * 0.8}px monospace`;
      ctx.textBaseline = 'middle';

      let displayText = message;
      if (!displayText && news) {
        displayText = `NEWS: ${news.title}`;
      }
      if (!displayText) {
        displayText = "Waiting for messages...";
      }

      if (settings.mode === 'static') {
        ctx.fillText(displayText, 10, canvas.height / 2);
      } else {
        ctx.fillText(displayText, pos, canvas.height / 2);
        
        const textWidth = ctx.measureText(displayText).width;
        const speed = settings.speed || 50;
        pos -= (speed / 20);
        
        if (pos + textWidth < 0) {
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
    <div className="w-full overflow-hidden bg-black rounded-lg border border-zinc-800 p-4 flex items-center justify-center">
      <canvas 
        ref={canvasRef} 
        className="max-w-full h-auto shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
