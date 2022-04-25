export class RecursiveTimer {
  #activeTimer: number | undefined;
  #delay: number;
  #callback: () => any;

  constructor(callback: () => any, delay: number) {
    this.#delay = delay;
    this.#callback = callback;
  }

  start() {
    this.#activeTimer = window.setTimeout(async () => {
      await this.#callback();
      this.start();
    }, this.#delay);
  }

  stop() {
    window.clearTimeout(this.#activeTimer);
  }
}
