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
  if (theme === 'default') {
    // Original logic: time and angle based hue
    return (angle / (2 * Math.PI) + 0.5 + Date.now() / 1000.0 * 0.1) % 1.0;
  }
  if (typeof theme === 'number') {
    // Monochromatic theme
    return theme;
  }
  if (Array.isArray(theme)) {
    // Ranged or palette-based theme
    const [min, max] = theme;
    return (Math.random() * (max - min) + min) % 1.0;
  }
  return Math.random(); // Fallback to a random hue
}

export const useFluidSimulation = (canvasRef, config) => {
  const simulationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const simulation = new FluidSimulation(canvas, config);
      simulationRef.current = simulation;
      simulation.run();
    } catch (e) {
      console.error("WebGL not supported", e);
      return;
    }

    const pointers = [new Pointer()];

    const onPointerDown = (pointer, posX, posY) => {
      pointer.down = true;
      pointer.color = [
        Math.random() * 0.5 + 0.1,
        Math.random() * 0.5 + 0.1,
        Math.random() * 0.5 + 0.1,
      ];
      pointer.texcoordX = posX / canvas.getBoundingClientRect().width;
      pointer.texcoordY = 1.0 - posY / canvas.getBoundingClientRect().height;
      pointer.deltaX = 0;
      pointer.deltaY = 0;
      if (config.COLORFUL) {
        pointer.color = [
          Math.random() * 0.5 + 0.1,
          Math.random() * 0.5 + 0.1,
          Math.random() * 0.5 + 0.1,
        ];
      } else {
        pointer.color = [0.3, 0.3, 0.3]; // A neutral grey for non-colorful mode
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
      let pointer = pointers[0];
      if (!pointer.down) return;
      const rect = canvas.getBoundingClientRect();
      pointer.moved = true;
      const posX = e.clientX - rect.left;
      const posY = e.clientY - rect.top;
      let newTexcoordX = posX / rect.width;
      let newTexcoordY = 1.0 - posY / rect.height;
      const rawDeltaX = newTexcoordX - pointer.texcoordX;
      const rawDeltaY = newTexcoordY - pointer.texcoordY;

      if (Math.abs(rawDeltaX) < 0.0001 && Math.abs(rawDeltaY) < 0.0001) return;

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
      let pointer = pointers[0];
      const rect = canvas.getBoundingClientRect();
      onPointerDown(pointer, e.clientX - rect.left, e.clientY - rect.top);
    };

    const onMouseUp = () => {
      pointers[0].down = false;
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
        let pointer = pointers.find((p) => p.id === touches[i].identifier);
        if (!pointer) continue;
        pointer.moved = true;
        let newTexcoordX = (touches[i].clientX - rect.left) / rect.width;
        let newTexcoordY = 1.0 - (touches[i].clientY - rect.top) / rect.height;
        const rawDeltaX = newTexcoordX - pointer.texcoordX;
        const rawDeltaY = newTexcoordY - pointer.texcoordY;

        if (Math.abs(rawDeltaX) < 0.0001 && Math.abs(rawDeltaY) < 0.0001) continue;

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

        simulationRef.current.addSplat({ ...pointer });
      }
    };

    const onTouchEnd = (e) => {
      const touches = e.changedTouches;
      for (let i = 0; i < touches.length; i++) {
        let pointer = pointers.find((p) => p.id === touches[i].identifier);
        if (pointer) {
          pointer.down = false;
        }
      }
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart);
    canvas.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [canvasRef]);

  useEffect(() => {
    if (simulationRef.current) {
      simulationRef.current.updateConfig(config);
    }
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
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return { r, g, b };
}
