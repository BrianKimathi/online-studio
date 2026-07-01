import React, { useRef, useState, useEffect } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  /** Knob dial diameter in px. Defaults to 44. */
  size?: number;
}

export const Knob: React.FC<KnobProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  size = 44
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const range = max - min;
  const percentage = ((value - min) / range) * 100;
  const startAngle = -135;
  const endAngle = 135;
  const rotationAngle = startAngle + (percentage / 100) * (endAngle - startAngle);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    startVal.current = value;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = startY.current - e.clientY;
      const sensitivity = 200;
      const deltaValue = (deltaY / sensitivity) * range;
      let newValue = startVal.current + deltaValue;
      newValue = Math.max(min, Math.min(max, newValue));
      newValue = Math.round(newValue / step) * step;
      onChange(newValue);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const deltaY = startY.current - e.touches[0].clientY;
      const sensitivity = 200;
      const deltaValue = (deltaY / sensitivity) * range;
      let newValue = startVal.current + deltaValue;
      newValue = Math.max(min, Math.min(max, newValue));
      newValue = Math.round(newValue / step) * step;
      onChange(newValue);
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, min, max, range, step, onChange]);

  return (
    <div className="flex flex-col items-center select-none cursor-ns-resize knob-container" style={{ minWidth: `${size}px` }}>
      <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mb-1.5 whitespace-nowrap text-center">{label}</span>

      {/* Knob SVG dial — uses viewBox so it scales cleanly to `size` */}
      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="relative bg-slate-900 border-2 border-slate-800 rounded-full flex items-center justify-center shadow-lg active:border-indigo-500 transition-colors"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="17" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="2" />
          <circle
            cx="22"
            cy="22"
            r="17"
            fill="none"
            stroke="rgb(99, 102, 241)"
            strokeWidth="2.5"
            strokeDasharray={2 * Math.PI * 17}
            strokeDashoffset={(2 * Math.PI * 17) * (1 - (percentage / 100) * 0.75)}
            className="origin-center rotate-45"
          />
        </svg>

        <div
          className="absolute inset-0.5 rounded-full bg-slate-950 flex items-center justify-center shadow-inner"
          style={{ transform: `rotate(${rotationAngle}deg)` }}
        >
          <div className="bg-indigo-400 rounded-full" style={{ width: '2px', height: `${size * 0.28}px`, transform: `translateY(-${size * 0.18}px)` }} />
        </div>
      </div>

      <span className="text-[9px] text-slate-400 font-semibold font-mono mt-1 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900 whitespace-nowrap text-center">
        {value.toFixed(1)}{unit}
      </span>
    </div>
  );
};
