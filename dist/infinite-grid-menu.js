import { resizeCanvasToDisplaySize } from "./utils/canvas-utils.js";

export class InfiniteGridMenu {

    #time = 0;
    #deltaTime = 0;
    #frames = 0;

    items = [
        {
            label: 'Item 1',
            color: '#f00'
        },
        {
            label: 'Item 2',
            color: '#f00'
        },
        {
            label: 'Item 3',
            color: '#00f'
        },
        {
            label: 'Item 4',
            color: '#ff0'
        },
        {
            label: 'Item 5',
            color: '#f0f'
        },
        {
            label: 'Item 6',
            color: '#0ff'
        }
    ]

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