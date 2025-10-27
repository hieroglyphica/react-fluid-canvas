import { useEffect, useRef } from "react";
import { FluidSimulation } from "../engine/FluidSimulation";
import { Pointer } from "../utils/Pointer";

/**
 * Generates a hue value based on the configured color theme.
 * @param {string|number|number[]} theme - The color theme from the config.
 * @param {number} angle - The angle of pointer movement (for 'default' theme).
 * @returns {number} A hue value between 0 and 1.
 */
function getHue(theme, angle) {
  if (theme === "default") {
    return (angle / (2 * Math.PI) + 0.5 + Date.now() / 1000.0 * 0.1) % 1.0;
  }
  if (typeof theme === "number") return theme;
  if (Array.isArray(theme)) {
    const [min, max] = theme;
    return (Math.random() * (max - min) + min) % 1.0;
  }
  return Math.random();
}

export const useFluidSimulation = (canvasRef, config) => {
  const simulationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // defensive body reset to avoid layout gaps
    try { document.body.style.margin = "0"; } catch (_e) { /* ignore */ }

    // ensure canvas fills parent reliably
    canvas.style.display = canvas.style.display || "block";
    canvas.style.position = canvas.style.position || "absolute";
    canvas.style.inset = canvas.style.inset || "0";
    canvas.style.left = canvas.style.left || "0";
    canvas.style.top = canvas.style.top || "0";
    canvas.style.width = canvas.style.width || "100%";
    canvas.style.height = canvas.style.height || "100%";
    canvas.style.boxSizing = canvas.style.boxSizing || "border-box";
    canvas.style.maxWidth = canvas.style.maxWidth || "100%";

    let simulation;
    try {
      simulation = new FluidSimulation(canvas, config);
      simulationRef.current = simulation;
      simulation.run();
    } catch (e) {
      console.error("WebGL not supported", e);
      return;
    }

    canvas.style.touchAction = canvas.style.touchAction || "none";
    canvas.style.userSelect = canvas.style.userSelect || "none";

    // Resize handling (debounced) + ResizeObserver
    let resizeTimeout = null;
    let sizePollInterval = null;
    let lastInnerW = typeof window !== "undefined" ? window.innerWidth : 0;
    let lastInnerH = typeof window !== "undefined" ? window.innerHeight : 0;

    const handleResizeNow = () => {
      const sim = simulationRef.current;
      if (!sim) return;
      try {
        const parent = canvas.parentElement || document.body;        void parent.offsetWidth; // force reflow

        // Wait a tick + next animation frame to let the browser settle layout changes
        setTimeout(() => {
          requestAnimationFrame(() => {
            try {
              // Read parent rect first (more likely to be updated by layout changes)
              const parentRect = parent.getBoundingClientRect();
              const canvasRect = canvas.getBoundingClientRect();

              // Prefer parent rect when it looks updated; fall back to canvas rect
              const cssWidth = (parentRect && parentRect.width && parentRect.width > 0) ? parentRect.width : (canvasRect && canvasRect.width ? canvasRect.width : canvas.clientWidth);
              const cssHeight = (parentRect && parentRect.height && parentRect.height > 0) ? parentRect.height : (canvasRect && canvasRect.height ? canvasRect.height : canvas.clientHeight);

              // Apply CSS size to canvas to ensure its CSS size follows the parent (helps avoid stale DOMRect)
              canvas.style.width = Math.max(1, Math.floor(cssWidth)) + "px";
              canvas.style.height = Math.max(1, Math.floor(cssHeight)) + "px";

              // Now let the simulation update backing store if needed
              const changed = sim._resizeChecker && sim._resizeChecker();
              if (changed) sim.initFramebuffers();

              if (typeof cssWidth === "number" && cssWidth > 0 && typeof sim.adjustSplatForSize === "function") {
                sim.adjustSplatForSize(cssWidth);
              }
            } catch (_err) {
              /* ignore during rAF-resize */
            }
          });
        }, 16);
      } catch (_err) {
        /* ignore during resize pre-read */
      }
    };

    const onWindowResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResizeNow, 120);
    };
    // initial layout
    handleResizeNow();
    window.addEventListener("resize", onWindowResize);

    let resizeObserver = null;
    const observedEl = canvas.parentElement || canvas;
    if (typeof ResizeObserver !== "undefined" && observedEl) {
      resizeObserver = new ResizeObserver(() => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResizeNow, 80);
      });
      try { resizeObserver.observe(observedEl); } catch (_e) { resizeObserver = null; }
    }

    // Poll window size as a last-resort fallback to detect layout changes (e.g. some host chrome)
    if (typeof window !== "undefined") {
      sizePollInterval = setInterval(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w !== lastInnerW || h !== lastInnerH) {
          lastInnerW = w;
          lastInnerH = h;
          handleResizeNow();
        }
      }, 300);
    }

    // Input handling
    const pointers = [new Pointer()];

    const onPointerDown = (pointer, posX, posY) => {
      pointer.down = true;
      pointer.deltaX = 0;
      pointer.deltaY = 0;
      const rect = canvas.getBoundingClientRect();
      pointer.texcoordX = posX / rect.width;
      pointer.texcoordY = 1.0 - posY / rect.height;
      if (config.COLORFUL) {
        pointer.color = [Math.random() * 0.5 + 0.1, Math.random() * 0.5 + 0.1, Math.random() * 0.5 + 0.1];
      } else {
        pointer.color = [0.3, 0.3, 0.3];
      }
      simulationRef.current.addSplat({
        texcoordX: pointer.texcoordX,
        texcoordY: pointer.texcoordY,
        deltaX: pointer.deltaX,
        deltaY: pointer.deltaY,
        color: pointer.color,
      });
    };

    const onMouseMove = (e) => {
      const pointer = pointers[0];
      if (!pointer || !pointer.down) return;
      const rect = canvas.getBoundingClientRect();
      pointer.moved = true;
      const posX = e.clientX - rect.left;
      const posY = e.clientY - rect.top;
      const newTexcoordX = posX / rect.width;
      const newTexcoordY = 1.0 - posY / rect.height;
      const rawDeltaX = newTexcoordX - pointer.texcoordX;
      const rawDeltaY = newTexcoordY - pointer.texcoordY;
      if (Math.abs(rawDeltaX) < 1e-4 && Math.abs(rawDeltaY) < 1e-4) return;
      pointer.deltaX = rawDeltaX * config.SPLAT_FORCE;
      pointer.deltaY = rawDeltaY * config.SPLAT_FORCE;
      pointer.texcoordX = newTexcoordX;
      pointer.texcoordY = newTexcoordY;
      if (config.COLORFUL) {
        const speed = Math.sqrt(rawDeltaX * rawDeltaX + rawDeltaY * rawDeltaY);
        const brightness = Math.min(speed * 4.0, 1.0);
        const angle = Math.atan2(rawDeltaY, rawDeltaX);
        const hue = getHue(config.COLOR_THEME, angle);
        const c = hsvToRgb(hue, 0.8, 1.0);
        pointer.color[0] = c.r * brightness;
        pointer.color[1] = c.g * brightness;
        pointer.color[2] = c.b * brightness;
      }
      simulationRef.current.addSplat({
        texcoordX: pointer.texcoordX,
        texcoordY: pointer.texcoordY,
        deltaX: pointer.deltaX,
        deltaY: pointer.deltaY,
        color: pointer.color,
      });
    };

    const onMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      onPointerDown(pointers[0], e.clientX - rect.left, e.clientY - rect.top);
    };
    const onMouseUp = () => { if (pointers[0]) pointers[0].down = false; };

    const onTouchStart = (e) => {
      e.preventDefault();
      const touches = e.targetTouches;
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < touches.length; i++) {
        let pointer = pointers[i];
        if (!pointer) { pointer = new Pointer(); pointers[i] = pointer; }
        pointer.id = touches[i].identifier;
        onPointerDown(pointer, touches[i].clientX - rect.left, touches[i].clientY - rect.top);
      }
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      const touches = e.targetTouches;
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < touches.length; i++) {
        const id = touches[i].identifier;
        let pointer = pointers.find((p) => p && p.id === id);
        if (!pointer) continue;
        pointer.moved = true;
        const newTexcoordX = (touches[i].clientX - rect.left) / rect.width;
        const newTexcoordY = 1.0 - (touches[i].clientY - rect.top) / rect.height;
        const rawDeltaX = newTexcoordX - pointer.texcoordX;
        const rawDeltaY = newTexcoordY - pointer.texcoordY;
        if (Math.abs(rawDeltaX) < 1e-4 && Math.abs(rawDeltaY) < 1e-4) continue;
        pointer.deltaX = rawDeltaX * config.SPLAT_FORCE;
        pointer.deltaY = rawDeltaY * config.SPLAT_FORCE;
        pointer.texcoordX = newTexcoordX;
        pointer.texcoordY = newTexcoordY;
        if (config.COLORFUL) {
          const speed = Math.sqrt(rawDeltaX * rawDeltaX + rawDeltaY * rawDeltaY);
          const brightness = Math.min(speed * 4.0, 1.0);
          const angle = Math.atan2(rawDeltaY, rawDeltaX);
          const hue = getHue(config.COLOR_THEME, angle);
          const c = hsvToRgb(hue, 0.8, 1.0);
          pointer.color[0] = c.r * brightness;
          pointer.color[1] = c.g * brightness;
          pointer.color[2] = c.b * brightness;
        }
        simulationRef.current.addSplat({
          texcoordX: pointer.texcoordX,
          texcoordY: pointer.texcoordY,
          deltaX: pointer.deltaX,
          deltaY: pointer.deltaY,
          color: pointer.color,
        });
      }
    };

    const onTouchEnd = (e) => {
      const touches = e.changedTouches;
      for (let i = 0; i < touches.length; i++) {
        const id = touches[i].identifier;
        let pointer = pointers.find((p) => p && p.id === id);
        if (pointer) pointer.down = false;
      }
    };

    // attach listeners
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    const touchOpts = { passive: false };
    canvas.addEventListener("touchstart", onTouchStart, touchOpts);
    canvas.addEventListener("touchmove", onTouchMove, touchOpts);
    window.addEventListener("touchend", onTouchEnd, touchOpts);

    return () => {
      if (simulationRef.current) simulationRef.current.stop();
      if (resizeTimeout) { clearTimeout(resizeTimeout); resizeTimeout = null; }
      if (sizePollInterval) { clearInterval(sizePollInterval); sizePollInterval = null; }
      window.removeEventListener("resize", onWindowResize);
      if (resizeObserver && typeof resizeObserver.disconnect === "function") resizeObserver.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart, touchOpts);
      canvas.removeEventListener("touchmove", onTouchMove, touchOpts);
      window.removeEventListener("touchend", onTouchEnd, touchOpts);
    };
  }, [canvasRef, config]);

  useEffect(() => {
    if (simulationRef.current) simulationRef.current.updateConfig(config);
  }, [config]);
};

function hsvToRgb(h, s, v) {
  let r, g, b, i, f, p, q, t;
  i = Math.floor(h * 6);
  f = h * 6 - i;
  p = v * (1 - s);
  q = v * (1 - f * s);
  t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      r = v; g = t; b = p; break;
    case 1:
      r = q; g = v; b = p; break;
    case 2:
      r = p; g = v; b = t; break;
    case 3:
      r = p; g = q; b = v; break;
    case 4:
      r = t; g = p; b = v; break;
    case 5:
      r = v; g = p; b = q; break;
  }
  return { r, g, b };
}
