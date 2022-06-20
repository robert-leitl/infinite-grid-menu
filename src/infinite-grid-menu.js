import { resizeCanvasToDisplaySize } from "./utils/canvas-utils.js";

export class InfiniteGridMenu {

    #time = 0;
    #deltaTime = 0;
    #frames = 0;

    constructor(canvas, onInit = null) {
        this.canvas = canvas;

        this.#init(onInit);
    }

    resize() {
        resizeCanvasToDisplaySize(this.canvas);
    }

    run(time = 0) {
        this.#deltaTime = Math.min(32, time - this.#time);
        this.#time = time;
        this.#frames += this.#deltaTime / 16;

        this.#animate(this.#deltaTime);
        this.#render();

        requestAnimationFrame((t) => this.run(t));
    }

    #init(onInit) {
        this.context = this.canvas.getContext('2d');

        /** @type {CanvasRenderingContext2D} */
        const ctx = this.context;

        this.resize();

        ctx.fillStyle = '#f00';
        ctx.arc(100, 100, 50, 0, 2 * Math.PI);
        ctx.fill();

        if (!onInit) onInit();
    }

    #animate(deltaTime) {

    }

    #render() {}
}