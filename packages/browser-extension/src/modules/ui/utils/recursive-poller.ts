export class RecursiveTimer {
  #activeTimer: number | undefined;
  #delay: number;
  #callback: () => any;
  #isDestroyed = false;

  constructor(callback: () => any, delay: number) {
    this.#delay = delay;
    this.#callback = callback;
  }

  start() {
    this.#activeTimer = window.setTimeout(async () => {
      await this.#callback();

      // destroy could be requested during callback
      if (this.#isDestroyed) return;
      this.start();
    }, this.#delay);
  }

  destory() {
    window.clearTimeout(this.#activeTimer);
    this.#isDestroyed = true;
  }
}
