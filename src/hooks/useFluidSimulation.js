import { useEffect, useRef } from "react";
import { FluidSimulation } from "../engine/FluidSimulation";
import { Pointer } from "../utils/Pointer";
import {
  presets as presetFactories,
  hsvToRgb,
  getHue,
} from "../lib/presetAnimations.js"; // import presets, hsvToRgb, and getHue

/**
 * Generates a hue value based on the configured color theme.
 * @param {string|number|number[]} theme - The color theme from the config.
 * @param {number} angle - The angle of pointer movement (for 'default' theme).
 * @returns {number} A hue value between 0 and 1.
 */ // This JSDoc block is now for the imported getHue, so it should stay.

export const useFluidSimulation = (
  canvasRef,
  config,
  coordinates,
  options = {}
) => {
  const simulationRef = useRef(null);
  const presetControllerRef = useRef(null);
  const { preset, presetOptions, autoPlay } = options || {};

  // --- controller helpers (moved outside effect so they can be returned) ---
  function startPreset(name, opts = {}) {
    try {
      if (!simulationRef.current) return null;
      // stop current
      if (
        presetControllerRef.current &&
        typeof presetControllerRef.current.stop === "function"
      ) {
        try {
          presetControllerRef.current.stop();
        } catch (_e) {
          void 0;
          /* ignore */
        }
        presetControllerRef.current = null;
      }
      const factory = presetFactories[name];
      if (typeof factory === "function") {
        const ctl = factory(simulationRef.current, opts);
        presetControllerRef.current = ctl;
        if (ctl && typeof ctl.start === "function") ctl.start();
        return ctl;
      }
    } catch (e) {
      console.error("startPreset error", e);
    }
    return null;
  }

  function stopPreset() {
    try {
      if (
        presetControllerRef.current &&
        typeof presetControllerRef.current.stop === "function"
      ) {
        presetControllerRef.current.stop();
        presetControllerRef.current = null;
      }
    } catch (e) {
      console.error("stopPreset error", e);
    }
  }

  function splat(x, y, dx = 0, dy = 0, color = null) {
    const sim = simulationRef.current;
    if (!sim) return;
    const forceMul = Number(
      sim.config && sim.config.SPLAT_FORCE
        ? sim.config.SPLAT_FORCE
        : config.SPLAT_FORCE || 1
    );
    const scaledDx = dx * forceMul;
    const scaledDy = dy * forceMul;
    // Accept either raw color hint or compute if null (honor COLORFUL)
    let colorArr = null;
    if (Array.isArray(color) && color.length >= 3) {
      colorArr = [Number(color[0]), Number(color[1]), Number(color[2])];
    } else if (sim.config && sim.config.COLORFUL) {
      const angle = Math.atan2(dy, dx) || Math.random() * Math.PI * 2;
      const hue = getHue(sim.config.COLOR_THEME, angle);
      const c = hsvToRgb(hue, 0.8, 1.0);
      colorArr = [c.r, c.g, c.b];
    } else {
      colorArr = [0.3, 0.3, 0.3];
    }
    sim.addSplat({
      texcoordX: Math.max(0, Math.min(1, x)),
      texcoordY: 1.0 - Math.max(0, Math.min(1, y)),
      deltaX: scaledDx,
      deltaY: scaledDy,
      color: colorArr,
    });
  }

  function multipleSplats(n = 6) {
    const sim = simulationRef.current;
    if (!sim || typeof sim.multipleSplats !== "function") return;
    try {
      sim.multipleSplats(n);
    } catch (_e) {
      /* ignore */
    }
  }

  function setConfig(partial) {
    if (
      simulationRef.current &&
      typeof simulationRef.current.updateConfig === "function"
    ) {
      simulationRef.current.updateConfig(partial);
    }
  }

  function getDiagnostics() {
    if (
      simulationRef.current &&
      typeof simulationRef.current.getDiagnostics === "function"
    ) {
      return simulationRef.current.getDiagnostics();
    }
    return null;
  }

  function pause() {
    if (simulationRef.current && typeof simulationRef.current.stop === "function")
      simulationRef.current.stop();
  }
  function resume() {
    if (simulationRef.current && typeof simulationRef.current.run === "function")
      simulationRef.current.run();
  }

  // Controller object returned by the hook
  const controller = {
    startPreset,
    stopPreset,
    splat,
    multipleSplats,
    setConfig,
    getDiagnostics,
    pause,
    resume,
    // note: the canvas DOM node remains available via the canvasRef param if consumer kept a handle
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // defensive body reset to avoid layout gaps
    try {
      document.body.style.margin = "0";
    } catch (_e) {
      /* ignore */
    }

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

    // auto-start preset if requested by props
    if (preset && autoPlay) {
      startPreset(preset, presetOptions || {});
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
        const parent = canvas.parentElement || document.body;
        void parent.offsetWidth; // force reflow

        // Wait a tick + next animation frame to let the browser settle layout changes
        setTimeout(() => {
          requestAnimationFrame(() => {
            try {
              // Read parent rect first (more likely to be updated by layout changes)
              const parentRect = parent.getBoundingClientRect();
              const canvasRect = canvas.getBoundingClientRect();

              // Prefer parent rect when it looks updated; fall back to canvas rect
              const cssWidth =
                parentRect && parentRect.width && parentRect.width > 0
                  ? parentRect.width
                  : canvasRect && canvasRect.width
                  ? canvasRect.width
                  : canvas.clientWidth;
              const cssHeight =
                parentRect && parentRect.height && parentRect.height > 0
                  ? parentRect.height
                  : canvasRect && canvasRect.height
                  ? canvasRect.height
                  : canvas.clientHeight;

              // Apply CSS size to canvas to ensure its CSS size follows the parent (helps avoid stale DOMRect)
              canvas.style.width = Math.max(1, Math.floor(cssWidth)) + "px";
              canvas.style.height = Math.max(1, Math.floor(cssHeight)) + "px";

              // Now let the simulation update backing store if needed
              const changed = sim._resizeChecker && sim._resizeChecker();
              if (changed) sim.initFramebuffers();

              if (
                typeof cssWidth === "number" &&
                cssWidth > 0 &&
                typeof sim.adjustSplatForSize === "function"
              ) {
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
      try {
        resizeObserver.observe(observedEl);
      } catch (_e) {
        resizeObserver = null;
      }
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

    const updatePointerMove = (pointer, posX, posY) => {
      const rect = canvas.getBoundingClientRect();
      pointer.moved = true;
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
        pointer.color = [c.r * brightness, c.g * brightness, c.b * brightness];
      }

      simulationRef.current.addSplat({
        texcoordX: pointer.texcoordX,
        texcoordY: pointer.texcoordY,
        deltaX: pointer.deltaX,
        deltaY: pointer.deltaY,
        color: pointer.color,
      });
    };

    const onPointerDown = (pointer, posX, posY) => {
      pointer.down = true;
      pointer.deltaX = 0;
      pointer.deltaY = 0;
      const rect = canvas.getBoundingClientRect();
      pointer.texcoordX = posX / rect.width;
      pointer.texcoordY = 1.0 - posY / rect.height;
      if (config.COLORFUL) {
        pointer.color = [
          Math.random() * 0.5 + 0.1,
          Math.random() * 0.5 + 0.1,
          Math.random() * 0.5 + 0.1,
        ];
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
      updatePointerMove(pointer, e.clientX - rect.left, e.clientY - rect.top);
    };

    const onMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      onPointerDown(pointers[0], e.clientX - rect.left, e.clientY - rect.top);
    };
    const onMouseUp = () => {
      if (pointers[0]) pointers[0].down = false;
    };

    const onTouchStart = (e) => {
      e.preventDefault();
      const touches = e.targetTouches;
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < touches.length; i++) {
        let pointer = pointers[i];
        if (!pointer) {
          pointer = new Pointer();
          pointers[i] = pointer;
        }
        pointer.id = touches[i].identifier;
        onPointerDown(
          pointer,
          touches[i].clientX - rect.left,
          touches[i].clientY - rect.top
        );
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
        updatePointerMove(pointer, touches[i].clientX - rect.left, touches[i].clientY - rect.top);
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
      // stop any active preset controller
      try {
        stopPreset();
      } catch (_e) {
        void 0;
        /* ignore */
      }
      if (simulationRef.current) simulationRef.current.stop();
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
      }
      if (sizePollInterval) {
        clearInterval(sizePollInterval);
        sizePollInterval = null;
      }
      window.removeEventListener("resize", onWindowResize);
      if (resizeObserver && typeof resizeObserver.disconnect === "function")
        resizeObserver.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart, touchOpts);
      canvas.removeEventListener("touchmove", onTouchMove, touchOpts);
      window.removeEventListener("touchend", onTouchEnd, touchOpts);
    };
  }, [canvasRef, config, preset, autoPlay, presetOptions]);

  // New effect: accept external coordinates and enqueue splats
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim || !coordinates) return;

    const items = Array.isArray(coordinates) ? coordinates : [coordinates];
    for (const it of items) {
      if (!it || typeof it.x !== "number" || typeof it.y !== "number") continue;

      // consumer x,y are expected 0..1 with origin at top-left -> convert to sim texcoords (y flipped)
      const texX = Math.max(0, Math.min(1, it.x));
      const texY = 1.0 - Math.max(0, Math.min(1, it.y));

      // dx/dy treated as normalized movement; scale by SPLAT_FORCE (fall back to config or 1)
      const forceMul = Number(config.SPLAT_FORCE || 1);
      const dx = typeof it.dx === "number" ? it.dx * forceMul : 0;
      const dy = typeof it.dy === "number" ? it.dy * forceMul : 0;

      // color: allow consumer to pass [r,g,b] (0..1). Otherwise derive using config.COLORFUL or fallback grey
      let colorArr = null;
      if (it.color && Array.isArray(it.color) && it.color.length >= 3) {
        colorArr = [
          Number(it.color[0]),
          Number(it.color[1]),
          Number(it.color[2]),
        ];
      } else if (config.COLORFUL) {
        // try to compute a hue from motion angle; if stationary, randomize slightly
        const angle = Math.atan2(dy, dx) || Math.random() * Math.PI * 2;
        const hue = getHue(config.COLOR_THEME, angle);
        const c = hsvToRgb(hue, 0.8, 1.0);
        colorArr = [c.r, c.g, c.b];
      } else {
        colorArr = [0.3, 0.3, 0.3];
      }

      sim.addSplat({
        texcoordX: texX,
        texcoordY: texY,
        deltaX: dx,
        deltaY: dy,
        color: colorArr,
      });
    }
    // run whenever coordinates or config reference changes
  }, [coordinates, config, simulationRef]);

  // Return controller for use by index.jsx (useImperativeHandle)
  return controller;
};
