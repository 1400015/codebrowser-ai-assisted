export function createWatchdog(delayMs: number, onStable: () => void): {
  kick: () => void;
  stop: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    kick() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onStable, delayMs);
    },
    stop() {
      if (timer) clearTimeout(timer);
    },
  };
}
