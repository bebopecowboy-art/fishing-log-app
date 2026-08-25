export function createLatestFrameScheduler(task, options = {}) {
  const requestFrame = options.requestFrame || globalThis.requestAnimationFrame;
  const cancelFrame = options.cancelFrame || globalThis.cancelAnimationFrame;
  let frameId = null;
  let pending = false;
  let running = false;
  let generation = 0;

  function schedule() {
    if (frameId !== null || running || !pending) return;
    const requestedGeneration = generation;
    frameId = requestFrame(async () => {
      frameId = null;
      if (!pending || requestedGeneration !== generation) return;
      pending = false;
      running = true;
      try {
        await task();
      } finally {
        running = false;
        schedule();
      }
    });
  }

  return {
    request() {
      pending = true;
      schedule();
    },
    cancel() {
      generation += 1;
      pending = false;
      if (frameId !== null) cancelFrame(frameId);
      frameId = null;
    },
    getState() {
      return { pending, running, scheduled: frameId !== null };
    }
  };
}
