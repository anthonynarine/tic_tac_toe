import { useEffect, useState, useRef } from "react";

/**
 * Custom countdown hook
 *
 * @param {number} initialValue - Number of seconds to count down from.
 * @param {boolean} isActive - Whether the countdown is currently active.
 * @param {function} onComplete - Optional callback fired when countdown completes.
 * @returns {number} Current countdown value in seconds.
 */
export const useCountdown = (initialValue, isActive, onComplete) => {
  // Step 1: Store the current countdown value
    const [count, setCount] = useState(initialValue);

  // Step 2: Store the interval ID
    const timerRef = useRef(null);

    useEffect(() => {
        // Step 3: Start countdown if active and not already running
        if (isActive && timerRef.current === null) {
        timerRef.current = setInterval(() => {
            setCount((prev) => {
            if (prev <= 1) {
                clearInterval(timerRef.current);
                timerRef.current = null;
                if (onComplete) onComplete();
                return 0;
            }
            return prev - 1;
            });
        }, 1000);
        }

        // Step 4: Cleanup interval on unmount or isActive change
        return () => {
        clearInterval(timerRef.current);
        timerRef.current = null;
        };
    }, [isActive, onComplete]);

    useEffect(() => {
        if (isActive) {
            setCount(initialValue);
        }
    }, [isActive, initialValue]);

    return count;
};
