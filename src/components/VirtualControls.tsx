import React, { useRef, useState, useCallback, useEffect } from 'react';
import { GBAButton, EmulatorAdapter } from '../emulator/EmulatorAdapter';
import { AppSettings } from '../storage/db';

interface VirtualControlsProps {
  adapter: EmulatorAdapter | null;
  settings: AppSettings;
}

export const VirtualControls: React.FC<VirtualControlsProps> = ({ adapter, settings }) => {
  if (!settings.touchControls) return null;

  const dpadRef = useRef<HTMLDivElement>(null);
  const [activeDpadDirs, setActiveDpadDirs] = useState<{
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  }>({ up: false, down: false, left: false, right: false });

  const [activeButtons, setActiveButtons] = useState<{
    a: boolean;
    b: boolean;
    l: boolean;
    r: boolean;
    start: boolean;
    select: boolean;
  }>({
    a: false,
    b: false,
    l: false,
    r: false,
    start: false,
    select: false,
  });

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(8);
      }
    } catch {
      // Ignore vibration errors
    }
  };

  // ==========================================
  // D-PAD TOUCH CALCULATION WITH DIAGONALS
  // ==========================================
  const dpadPointerId = useRef<number | null>(null);

  const updateDpadFromCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!dpadRef.current || !adapter) return;
      const rect = dpadRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      const deadzone = rect.width * 0.15;
      const diagThreshold = 0.35; // Ratio threshold for detecting diagonal angle

      let up = false;
      let down = false;
      let left = false;
      let right = false;

      if (dist >= deadzone) {
        const nx = dx / dist;
        const ny = dy / dist;

        if (ny < -diagThreshold) up = true;
        if (ny > diagThreshold) down = true;
        if (nx < -diagThreshold) left = true;
        if (nx > diagThreshold) right = true;
      }

      setActiveDpadDirs({ up, down, left, right });
      adapter.setButtonState(GBAButton.UP, up, 'touch');
      adapter.setButtonState(GBAButton.DOWN, down, 'touch');
      adapter.setButtonState(GBAButton.LEFT, left, 'touch');
      adapter.setButtonState(GBAButton.RIGHT, right, 'touch');
    },
    [adapter]
  );

  const releaseDpad = useCallback(() => {
    dpadPointerId.current = null;
    setActiveDpadDirs({ up: false, down: false, left: false, right: false });
    if (adapter) {
      adapter.setButtonState(GBAButton.UP, false, 'touch');
      adapter.setButtonState(GBAButton.DOWN, false, 'touch');
      adapter.setButtonState(GBAButton.LEFT, false, 'touch');
      adapter.setButtonState(GBAButton.RIGHT, false, 'touch');
    }
  }, [adapter]);

  const handleDpadPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dpadPointerId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    triggerHaptic();
    updateDpadFromCoords(e.clientX, e.clientY);
  };

  const handleDpadPointerMove = (e: React.PointerEvent) => {
    if (dpadPointerId.current === e.pointerId) {
      e.preventDefault();
      e.stopPropagation();
      updateDpadFromCoords(e.clientX, e.clientY);
    }
  };

  const handleDpadPointerUp = (e: React.PointerEvent) => {
    if (dpadPointerId.current === e.pointerId) {
      e.preventDefault();
      e.stopPropagation();
      releaseDpad();
    }
  };

  // ==========================================
  // DISCRETE BUTTON HANDLERS
  // ==========================================
  const handleButtonDown = (button: GBAButton, name: keyof typeof activeButtons) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    triggerHaptic();
    setActiveButtons((prev) => ({ ...prev, [name]: true }));
    adapter?.setButtonState(button, true, 'touch');
  };

  const handleButtonUp = (button: GBAButton, name: keyof typeof activeButtons) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveButtons((prev) => ({ ...prev, [name]: false }));
    adapter?.setButtonState(button, false, 'touch');
  };

  // Release all inputs when unmounting or losing window focus
  useEffect(() => {
    const handleBlur = () => {
      releaseDpad();
      if (adapter) {
        adapter.releaseSource('touch');
      }
      setActiveButtons({
        a: false,
        b: false,
        l: false,
        r: false,
        start: false,
        select: false,
      });
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [adapter, releaseDpad]);

  // Size scale calculation
  const sizeMultiplier =
    settings.touchSize === 'sm' ? 0.85 : settings.touchSize === 'lg' ? 1.15 : 1.0;
  const dpadSizePx = Math.round(140 * sizeMultiplier);
  const actionBtnSizePx = Math.round(62 * sizeMultiplier);
  const shoulderWidthPx = Math.round(84 * sizeMultiplier);

  return (
    <div
      className="pointer-events-none select-none z-20 w-full flex flex-col justify-between"
      style={{ opacity: settings.touchOpacity }}
    >
      {/* Shoulder Triggers (L & R) */}
      <div className="flex justify-between px-3 pt-1 pointer-events-auto w-full max-w-4xl mx-auto">
        <button
          type="button"
          onPointerDown={handleButtonDown(GBAButton.L, 'l')}
          onPointerUp={handleButtonUp(GBAButton.L, 'l')}
          onPointerCancel={handleButtonUp(GBAButton.L, 'l')}
          style={{ width: `${shoulderWidthPx}px` }}
          className={`h-10 rounded-t-xl rounded-br-md text-xs font-bold tracking-wider transition-all duration-75 border border-white/20 shadow-md ${
            activeButtons.l
              ? 'bg-emerald-500 text-slate-950 scale-95 border-emerald-400'
              : 'bg-slate-800/80 text-slate-300 active:bg-slate-700 backdrop-blur-md'
          }`}
          aria-label="Botão L"
        >
          L
        </button>

        <button
          type="button"
          onPointerDown={handleButtonDown(GBAButton.R, 'r')}
          onPointerUp={handleButtonUp(GBAButton.R, 'r')}
          onPointerCancel={handleButtonUp(GBAButton.R, 'r')}
          style={{ width: `${shoulderWidthPx}px` }}
          className={`h-10 rounded-t-xl rounded-bl-md text-xs font-bold tracking-wider transition-all duration-75 border border-white/20 shadow-md ${
            activeButtons.r
              ? 'bg-emerald-500 text-slate-950 scale-95 border-emerald-400'
              : 'bg-slate-800/80 text-slate-300 active:bg-slate-700 backdrop-blur-md'
          }`}
          aria-label="Botão R"
        >
          R
        </button>
      </div>

      {/* Main Touch Controls Bar */}
      <div className="flex items-end justify-between px-4 pb-2 w-full max-w-4xl mx-auto pointer-events-auto">
        {/* D-Pad (Left Hand) */}
        <div
          ref={dpadRef}
          onPointerDown={handleDpadPointerDown}
          onPointerMove={handleDpadPointerMove}
          onPointerUp={handleDpadPointerUp}
          onPointerCancel={handleDpadPointerUp}
          style={{ width: `${dpadSizePx}px`, height: `${dpadSizePx}px` }}
          className="relative bg-slate-900/90 rounded-full border border-white/10 p-1.5 shadow-2xl backdrop-blur-md touch-control-area active:border-emerald-500/50"
        >
          {/* Visual Cross */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Horizontal Bar */}
            <div className="w-full h-1/3 bg-slate-800/95 rounded-md border border-white/10 flex justify-between px-1.5 items-center">
              <span className={`text-[10px] font-bold ${activeDpadDirs.left ? 'text-emerald-400 scale-125' : 'text-slate-400'}`}>◀</span>
              <span className={`text-[10px] font-bold ${activeDpadDirs.right ? 'text-emerald-400 scale-125' : 'text-slate-400'}`}>▶</span>
            </div>
            {/* Vertical Bar */}
            <div className="absolute h-full w-1/3 bg-slate-800/95 rounded-md border border-white/10 flex flex-col justify-between py-1.5 items-center">
              <span className={`text-[10px] font-bold ${activeDpadDirs.up ? 'text-emerald-400 scale-125' : 'text-slate-400'}`}>▲</span>
              <span className={`text-[10px] font-bold ${activeDpadDirs.down ? 'text-emerald-400 scale-125' : 'text-slate-400'}`}>▼</span>
            </div>
            {/* Center Indent */}
            <div className="absolute w-5 h-5 rounded-full bg-slate-950/80 border border-white/15" />
          </div>
        </div>

        {/* Center: SELECT & START */}
        <div className="flex items-center gap-4 mb-2">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onPointerDown={handleButtonDown(GBAButton.SELECT, 'select')}
              onPointerUp={handleButtonUp(GBAButton.SELECT, 'select')}
              onPointerCancel={handleButtonUp(GBAButton.SELECT, 'select')}
              className={`w-14 h-5 rounded-full rotate-[-25deg] transition-all border border-white/20 shadow-md ${
                activeButtons.select ? 'bg-emerald-500 scale-95 border-emerald-400' : 'bg-slate-800/90'
              }`}
              aria-label="Botão SELECT"
            />
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">SELECT</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onPointerDown={handleButtonDown(GBAButton.START, 'start')}
              onPointerUp={handleButtonUp(GBAButton.START, 'start')}
              onPointerCancel={handleButtonUp(GBAButton.START, 'start')}
              className={`w-14 h-5 rounded-full rotate-[-25deg] transition-all border border-white/20 shadow-md ${
                activeButtons.start ? 'bg-emerald-500 scale-95 border-emerald-400' : 'bg-slate-800/90'
              }`}
              aria-label="Botão START"
            />
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">START</span>
          </div>
        </div>

        {/* Action Buttons: B and A (Right Hand) */}
        <div className="relative flex items-center gap-3 rotate-[-22deg] pb-2">
          {/* Button B */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onPointerDown={handleButtonDown(GBAButton.B, 'b')}
              onPointerUp={handleButtonUp(GBAButton.B, 'b')}
              onPointerCancel={handleButtonUp(GBAButton.B, 'b')}
              style={{ width: `${actionBtnSizePx}px`, height: `${actionBtnSizePx}px` }}
              className={`rounded-full flex items-center justify-center font-black text-sm tracking-widest transition-all duration-75 border-2 shadow-xl backdrop-blur-md ${
                activeButtons.b
                  ? 'bg-rose-500 text-white scale-90 border-rose-300'
                  : 'bg-rose-950/80 text-rose-200 border-rose-500/40 active:bg-rose-700'
              }`}
              aria-label="Botão B"
            >
              B
            </button>
          </div>

          {/* Button A */}
          <div className="flex flex-col items-center gap-1 -translate-y-4">
            <button
              type="button"
              onPointerDown={handleButtonDown(GBAButton.A, 'a')}
              onPointerUp={handleButtonUp(GBAButton.A, 'a')}
              onPointerCancel={handleButtonUp(GBAButton.A, 'a')}
              style={{ width: `${actionBtnSizePx}px`, height: `${actionBtnSizePx}px` }}
              className={`rounded-full flex items-center justify-center font-black text-sm tracking-widest transition-all duration-75 border-2 shadow-xl backdrop-blur-md ${
                activeButtons.a
                  ? 'bg-emerald-500 text-slate-950 scale-90 border-emerald-300'
                  : 'bg-emerald-950/80 text-emerald-200 border-emerald-500/40 active:bg-emerald-700'
              }`}
              aria-label="Botão A"
            >
              A
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
