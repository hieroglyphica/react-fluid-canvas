import { useEffect, useRef, useCallback } from "react";
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
  const pendingPresetRef = useRef(null); // hold preset request if sim not ready
  const { preset, presetOptions, autoPlay } = options || {};

  // --- added: keep a ref to the latest config so scheduled flushes use up-to-date values
  const configRef = useRef(config);
  // update the ref when config changes (avoid writing refs during render)
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // --- controller helpers (moved outside effect so they can be returned) ---
  /**
   * Start a preset. `presetOrFactory` may be:
   * - a string key referencing a built-in preset in presetFactories
   * - a factory function: (sim, opts) => { start(), stop() }
   *
   * If the simulation isn't initialized yet, the request is queued.
   */
  function startPreset(presetOrFactory, opts = {}) {
    try {
      // If sim not ready, queue the request (support name or factory)
      if (!simulationRef.current) {
        pendingPresetRef.current = { presetOrFactory, opts };
        return {
          stop() {
            pendingPresetRef.current = null;
          },
        };
      }

      // stop current
      if (
        presetControllerRef.current &&
        typeof presetControllerRef.current.stop === "function"
      ) {
        try {
          presetControllerRef.current.stop();
        } catch (_e) {
          /* ignore */
        }
        presetControllerRef.current = null;
      }

      const sim = simulationRef.current;
      // If consumer passed a factory function, use it directly
      if (typeof presetOrFactory === "function") {
        try {
          const ctl = presetOrFactory(sim, opts);
          presetControllerRef.current = ctl;
          if (ctl && typeof ctl.start === "function") ctl.start();
          return ctl;
        } catch (_e) {
          console.error("startPreset: factory threw", _e);
          return null;
        }
      }

      // Otherwise, resolve string name via builtin presetFactories
      if (typeof presetOrFactory === "string") {
        const factory = presetFactories[presetOrFactory];
        if (typeof factory === "function") {
          const ctl = factory(sim, opts);
          presetControllerRef.current = ctl;
          if (ctl && typeof ctl.start === "function") ctl.start();
          return ctl;
        }
      }
    } catch (_e) {
      console.error("startPreset error", _e);
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

  // Restore missing multipleSplats helper (for controller.multipleSplats)
  function multipleSplats(n = 6) {
    const sim = simulationRef.current;
    if (!sim || typeof sim.multipleSplats !== "function") return;
    try {
      sim.multipleSplats(n);
    } catch (_e) {
      /* ignore */
    }
  }

  // Add missing controller helpers referenced by `controller`
  function setConfig(partial) {
    if (
      simulationRef.current &&
      typeof simulationRef.current.updateConfig === "function"
    ) {
      try {
        simulationRef.current.updateConfig(partial);
      } catch (e) {
        console.error("setConfig error", e);
      }
    }
  }

  function getDiagnostics() {
    if (
      simulationRef.current &&
      typeof simulationRef.current.getDiagnostics === "function"
    ) {
      try {
        return simulationRef.current.getDiagnostics();
      } catch (e) {
        console.error("getDiagnostics error", e);
        return null;
      }
    }
    return null;
  }

  function pause() {
    if (
      simulationRef.current &&
      typeof simulationRef.current.stop === "function"
    ) {
      try {
        simulationRef.current.stop();
      } catch (_e) {
        /* ignore */
      }
    }
  }

  function resume() {
    if (
      simulationRef.current &&
      typeof simulationRef.current.run === "function"
    ) {
      try {
        simulationRef.current.run();
      } catch (_e) {
        /* ignore */
      }
    }
  }

  // splat: by default enqueue into the coordinate queue (safe, batched).
  // If opts.immediate is true, compute color/force and call sim.addSplat directly (preset-like).
  function splat(
    x,
    y,
    dx = 0,
    dy = 0,
    color = null,
    opts = { immediate: false }
  ) {
    const sim = simulationRef.current;
    if (!sim) return;
    if (opts && opts.immediate) {
      // immediate path - compute scaled deltas & color similar to presets
      const forceMul = Number(
        (sim.config && sim.config.SPLAT_FORCE) || config.SPLAT_FORCE || 1
      );
      const scaledDx = dx * forceMul;
      const scaledDy = dy * forceMul;

      let colorArr = null;
      const hasExplicitColor = Array.isArray(color) && color.length >= 3;
      if (hasExplicitColor) {
        colorArr = [Number(color[0]), Number(color[1]), Number(color[2])];
      } else if (sim.config && sim.config.COLORFUL) {
        // Derive angle from motion; if motion is zero, fall back to 0 (avoid Math.random in render scope)
        let angle = Math.atan2(dy, dx);
        if (!Number.isFinite(angle) || (dx === 0 && dy === 0)) angle = 0;
        const hue = getHue(sim.config.COLOR_THEME, angle);
        const c = hsvToRgb(hue, 0.8, 1.0);
        colorArr = [c.r, c.g, c.b];
      } else {
        colorArr = [0.3, 0.3, 0.3];
      }

      try {
        sim.addSplat({
          texcoordX: Math.max(0, Math.min(1, x)),
          texcoordY: 1.0 - Math.max(0, Math.min(1, y)),
          deltaX: scaledDx,
          deltaY: scaledDy,
          color: colorArr,
        });
      } catch (_e) {
        console.error("splat immediate failed", _e);
      }
      return;
    }

    // queued path (keeps behavior for coordinates prop and non-immediate programmatic splats)
    coordQueueRef.current.push({ x, y, dx, dy, color });
    scheduleCoordFlush(false);
  }

  // New API: start a simple preset-like stream of splats (returns controller with stop()).
  // This uses requestAnimationFrame and reads simulationRef.current each frame.
  // If the sim is not yet initialized when called, the loop will wait and start splatting once the sim exists.
  function startSplatStream(x, y, opts = {}) {
    const rateHz = Math.max(1, Number(opts.rateHz || 30));
    const periodMs = 1000 / rateHz;
    let stopped = false;
    let lastTime = 0;
    let rafId = null;

    function step(now) {
      if (stopped) return;
      const sim = simulationRef.current;
      if (sim) {
        if (!lastTime) lastTime = now;
        const elapsed = now - lastTime;
        if (elapsed >= periodMs) {
          lastTime = now - (elapsed % periodMs);
          const jitter = Number(opts.jitter || 0);
          const nx = Math.max(
            0,
            Math.min(1, x + (Math.random() - 0.5) * jitter)
          );
          const ny = Math.max(
            0,
            Math.min(1, y + (Math.random() - 0.5) * jitter)
          );

          const rawDx = typeof opts.dx === "number" ? opts.dx : 0;
          const rawDy = typeof opts.dy === "number" ? opts.dy : 0;
          const forceMul = Number(
            (sim.config && sim.config.SPLAT_FORCE) || config.SPLAT_FORCE || 1
          );
          const dx = rawDx * forceMul;
          const dy = rawDy * forceMul;

          const speed = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
          const brightness = Math.min(speed * 4.0, 1.0);
          let colorArr = null;
          if (Array.isArray(opts.color) && opts.color.length >= 3) {
            colorArr = [
              Number(opts.color[0]) * brightness,
              Number(opts.color[1]) * brightness,
              Number(opts.color[2]) * brightness,
            ];
          } else if (sim.config && sim.config.COLORFUL) {
            const angle =
              Math.atan2(rawDy, rawDx) || Math.random() * Math.PI * 2;
            const hue = getHue(sim.config.COLOR_THEME, angle);
            const c = hsvToRgb(hue, 0.8, 1.0);
            colorArr = [c.r * brightness, c.g * brightness, c.b * brightness];
          } else {
            colorArr = [0.3 * brightness, 0.3 * brightness, 0.3 * brightness];
          }

          try {
            sim.addSplat({
              texcoordX: Math.max(0, Math.min(1, nx)),
              texcoordY: 1.0 - Math.max(0, Math.min(1, ny)),
              deltaX: dx,
              deltaY: dy,
              color: colorArr,
            });
          } catch (e) {
            console.error("startSplatStream addSplat error", e);
          }
        }
      }
      rafId = requestAnimationFrame(step);
    }

    rafId = requestAnimationFrame(step);
    return {
      stop() {
        stopped = true;
        if (rafId) cancelAnimationFrame(rafId);
      },
    };
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
    startSplatStream, // new convenience helper
    // note: the canvas DOM node remains available via the canvasRef param if consumer kept a handle
  };

  // --- New: coordinates batching/throttle state ---
  const coordQueueRef = useRef([]);
  const coordFlushTimerRef = useRef(null);
  const lastFlushTimeRef = useRef(0);
  // remember last processed consumer coordinate to smooth / interpolate motion
  const lastConsumedCoordRef = useRef(null);

  // --- New helper: process a snapshot of queued coordinate items (stable via useCallback) ---
  const processCoordItems = useCallback((items) => {
    const sim = simulationRef.current;
    if (!sim || !items || items.length === 0) return;

    // Use the latest config via ref to avoid capturing `config` in the closure
    const cfg = configRef.current;

    const minDelta = Number(cfg.COORDINATE_MIN_DELTA ?? 1e-5);
    const maxStep = Number(cfg.COORDINATE_MAX_STEP ?? 0.02);
    const maxSubsteps = Math.max(1, Number(cfg.COORDINATE_MAX_SUBSTEPS ?? 8));
    const forceMul = Number(
      (sim.config && sim.config.SPLAT_FORCE) || cfg.SPLAT_FORCE || 1
    );

    let last = lastConsumedCoordRef.current;

    for (const it of items) {
      if (!it || typeof it.x !== "number" || typeof it.y !== "number") continue;

      const rawDxNorm =
        typeof it.dx === "number" ? it.dx : last ? it.x - last.x : 0;
      const rawDyNorm =
        typeof it.dy === "number" ? it.dy : last ? it.y - last.y : 0;

      const distance = Math.sqrt(rawDxNorm * rawDxNorm + rawDyNorm * rawDyNorm);
      const hasExplicitColor = Array.isArray(it.color) && it.color.length >= 3;

      // Skip tiny moves unless explicit color provided (consumer may want stationary splat)
      if (distance * forceMul < minDelta && !hasExplicitColor) {
        last = { x: it.x, y: it.y };
        continue;
      }

      const steps = Math.min(
        maxSubsteps,
        Math.max(1, Math.ceil(distance / Math.max(1e-6, maxStep)))
      );

      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const interpX = (last ? last.x : it.x) + rawDxNorm * t;
        const interpY = (last ? last.y : it.y) + rawDyNorm * t;

        const stepDxNorm = rawDxNorm / steps;
        const stepDyNorm = rawDyNorm / steps;
        const dx = stepDxNorm * forceMul;
        const dy = stepDyNorm * forceMul;

        // color: prefer explicit color, otherwise compute based on motion & config
        let colorArr = null;
        if (hasExplicitColor) {
          colorArr = [
            Number(it.color[0]),
            Number(it.color[1]),
            Number(it.color[2]),
          ];
        } else if (
          (cfg && cfg.COLORFUL) ||
          (sim.config && sim.config.COLORFUL)
        ) {
          // avoid calling Math.random during render/dep inference: fall back to angle 0 when motion is zero
          let angle = Math.atan2(stepDyNorm, stepDxNorm);
          if (!Number.isFinite(angle) || (stepDxNorm === 0 && stepDyNorm === 0)) angle = 0;
          const hue = getHue(cfg.COLOR_THEME, angle);
          const c = hsvToRgb(hue, 0.8, 1.0);
          const brightness = Math.min(
            Math.sqrt(stepDxNorm * stepDxNorm + stepDyNorm * stepDyNorm) * 4.0,
            1.0
          );
          colorArr = [c.r * brightness, c.g * brightness, c.b * brightness];
        } else {
          colorArr = [0.3, 0.3, 0.3];
        }

        const texX = Math.max(0, Math.min(1, interpX));
        const texY = 1.0 - Math.max(0, Math.min(1, interpY));

        try {
          sim.addSplat({
            texcoordX: texX,
            texcoordY: texY,
            deltaX: dx,
            deltaY: dy,
            color: colorArr,
          });
        } catch (e) {
          console.error("Failed to enqueue splat", e);
        }
      }

      last = { x: it.x, y: it.y };
    }

    lastConsumedCoordRef.current = last;
  }, []);

  // --- New helper: schedule a flush (throttled) ---
  const scheduleCoordFlush = useCallback((immediate = false) => {
    if (coordFlushTimerRef.current) return;
    const now = Date.now();
    const elapsed = now - lastFlushTimeRef.current;
    const throttleMs = Number(
      (configRef.current && configRef.current.COORDINATE_THROTTLE_MS) ?? 40
    );
    const delay = immediate ? 0 : Math.max(0, throttleMs - elapsed);

    coordFlushTimerRef.current = setTimeout(() => {
      coordFlushTimerRef.current = null;
      lastFlushTimeRef.current = Date.now();
      const queue = coordQueueRef.current.splice(0);
      processCoordItems(queue);
    }, delay);
  }, [processCoordItems]);

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
      // If a preset (name or factory) was requested before the sim was ready, start it now.
      if (pendingPresetRef.current) {
        const p = pendingPresetRef.current;
        pendingPresetRef.current = null;
        try {
          startPreset(p.presetOrFactory, p.opts || {});
        } catch (_e) {
          console.error("Failed to start pending preset", _e);
        }
      }
    } catch (_e) {
      console.error("WebGL not supported", _e);
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
      simulationRef.current.addSplat({
        texcoordX: pointer.texcoordX,
        texcoordY: pointer.texcoordY,
        deltaX: pointer.deltaX,
        deltaY: pointer.deltaY,
        color: pointer.color,
      });

      if (Math.abs(rawDeltaX) < 1e-4 && Math.abs(rawDeltaY) < 1e-4) return;

      pointer.texcoordX = newTexcoordX;
      pointer.texcoordY = newTexcoordY;

      // use the up-to-date config rather than the closed-over `config`
      const cfg = configRef.current || {};
      const splatForce = Number(cfg.SPLAT_FORCE || 1);

      pointer.deltaX = rawDeltaX * splatForce;
      pointer.deltaY = rawDeltaY * splatForce;

      if (cfg.COLORFUL) {
        const speed = Math.sqrt(rawDeltaX * rawDeltaX + rawDeltaY * rawDeltaY);
        const brightness = Math.min(speed * 4.0, 1.0);
        let angle = Math.atan2(rawDeltaY, rawDeltaX);
        if (!Number.isFinite(angle)) angle = 0;
        const hue = getHue(cfg.COLOR_THEME, angle);
        const c = hsvToRgb(hue, 0.8, 1.0);
        pointer.color = [c.r * brightness, c.g * brightness, c.b * brightness];
      }
    };

    const onPointerDown = (pointer, posX, posY) => {
      pointer.down = true;
      pointer.deltaX = 0;
      pointer.deltaY = 0;
      const rect = canvas.getBoundingClientRect();
      pointer.texcoordX = posX / rect.width;
      pointer.texcoordY = 1.0 - posY / rect.height;

      // read live config so initial down-color follows COLOR_THEME updates
      const cfg = configRef.current || {};
      if (cfg.COLORFUL) {
        // Use the configured theme for the initial splat color.
        // Pass angle=0 since there is no movement on the initial down event.
        const hue = getHue(cfg.COLOR_THEME, 0);
        const rgb = hsvToRgb(hue, 1.0, 1.0);
        pointer.color = [rgb.r, rgb.g, rgb.b];
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

    const onPointerRawDown = (ev) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const p = pointers[0];
      p.id = ev.pointerId;
      p.down = true;
      onPointerDown(p, ev.clientX - rect.left, ev.clientY - rect.top);
      canvas.setPointerCapture(ev.pointerId);
    };

    const onPointerRawMove = (ev) => {
      const p = pointers[0];
      if (!p || !p.down) return;
      const rect = canvas.getBoundingClientRect();
      updatePointerMove(p, ev.clientX - rect.left, ev.clientY - rect.top);
    };

    const onPointerRawUp = (ev) => {
      const p = pointers[0];
      if (p.id === ev.pointerId) {
        p.down = false;
      }
    };

    // attach listeners
    const pointerOpts = { passive: false };
    canvas.addEventListener("pointerdown", onPointerRawDown, pointerOpts);
    canvas.addEventListener("pointermove", onPointerRawMove, pointerOpts);
    canvas.addEventListener("pointerup", onPointerRawUp, pointerOpts);
    canvas.addEventListener("pointerleave", onPointerRawUp, pointerOpts);

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
      canvas.removeEventListener("pointerdown", onPointerRawDown, pointerOpts);
      canvas.removeEventListener("pointermove", onPointerRawMove, pointerOpts);
      canvas.removeEventListener("pointerup", onPointerRawUp, pointerOpts);
      canvas.removeEventListener("pointerleave", onPointerRawUp, pointerOpts);
    };
  }, [canvasRef, preset, autoPlay, presetOptions]);

  // Runtime-update config without recreating the simulation.
  // When the user changes the `config` prop, call the simulation's updateConfig()
  // so settings take effect without tearing down WebGL contexts or reloading the canvas.
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    try {
      if (typeof sim.updateConfig === "function") sim.updateConfig(config);
      // Also update controller-level helpers that may rely on configRef
      configRef.current = config;
    } catch (e) {
      console.error("Failed to apply runtime config", e);
    }
  }, [config]);

  // New effect: accept external coordinates and enqueue splats (batched + throttled)
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim || !coordinates) return;

    const items = Array.isArray(coordinates) ? coordinates : [coordinates];

    // Enqueue incoming items (lightweight)
    for (const it of items) {
      if (!it || typeof it.x !== "number" || typeof it.y !== "number") continue;
      coordQueueRef.current.push(it);
    }

    // Use the shared scheduler
    scheduleCoordFlush(false);

    return () => {
      if (coordFlushTimerRef.current) {
        clearTimeout(coordFlushTimerRef.current);
        coordFlushTimerRef.current = null;
      }
    };
    // Note: config is intentionally part of deps so throttle/minDelta updates take effect.
  }, [coordinates, config, scheduleCoordFlush]);
  
  // Return controller for use by index.jsx (useImperativeHandle)
  return controller;
};
