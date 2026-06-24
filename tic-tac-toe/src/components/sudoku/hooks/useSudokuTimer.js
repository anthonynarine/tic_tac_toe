import { useState, useEffect, useRef } from "react";

export function useSudokuTimer(initialSeconds = 0, running = true) {
  const [elapsed, setElapsed] = useState(initialSeconds);
  const runningRef = useRef(running);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    setElapsed(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    const id = setInterval(() => {
      if (runningRef.current) setElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const formatted = (() => {
    const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
    const s = (elapsed % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  })();

  return { elapsed, formatted };
}
