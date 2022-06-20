import { resizeCanvasToDisplaySize } from "./utils/canvas-utils.js";
import { vec2 } from "./web_modules/pkg/gl-matrix.js";

class MenuItem {
    constructor(label, color) {
        this.label = label;
        this.color = color;
    }

    render(/** @type {CanvasRenderingContext2D} */ ctx, position) {
        ctx.strokeStyle = null;
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(position[0], position[1], 25, 0, 2 * Math.PI);
        ctx.fill();
        ctx.closePath();
    }
}

export class InfiniteGridMenu {

    #time = 0;
    #deltaTime = 0;
    #frames = 0;

    scrollOffset = vec2.create();

    items = [
        new MenuItem('Red', '#f00'),
        new MenuItem('Green', '#0f0'),
        new MenuItem('Blue', '#00f'),
        new MenuItem('Yellow', '#ff0'),
        new MenuItem('Magenta', '#f0f'),
        new MenuItem('Yellow', '#333'),
        new MenuItem('Magenta', '#aaa'),
        new MenuItem('Magenta', '#eee'),
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

        this.itemCount = this.items.length;
        this.gridWidth = Math.ceil(Math.sqrt(this.itemCount));
        this.gridHeight = Math.ceil(this.itemCount / this.gridWidth);
        this.gridSize = this.gridWidth * this.gridHeight;
        this.gridSpacing = 200;

        console.log(this.gridWidth, this.gridHeight);

        this.resize();

        if (onInit) onInit(this);
    }

    #animate(deltaTime) {

    }

    #render() {
        /** @type {CanvasRenderingContext2D} */
        const ctx = this.context;

        ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

        const maxItemCount = vec2.fromValues(
            Math.ceil(this.canvas.clientWidth / this.gridSpacing),
            Math.ceil(this.canvas.clientHeight / this.gridSpacing)
        );

        const maxGridCountX = Math.floor(this.canvas.clientWidth / (this.gridSpacing * this.gridWidth));
        const gridDisplacement = this.gridSize - this.itemCount;
        let ndx = 0;
        for(let iY=0; iY<maxItemCount[1]; ++iY) {
            for(let iX=0; iX<maxItemCount[0]; ++iX) {
                
                let itemIndex = iX % this.gridWidth + (iY % this.gridHeight) * this.gridWidth;
                const gridIndex = Math.floor(iX / this.gridWidth) + Math.floor(iY / this.gridHeight) * maxGridCountX;
                itemIndex += gridIndex * gridDisplacement;
                itemIndex %= this.itemCount;

                this.items[itemIndex].render(this.context, [iX * this.gridSpacing, iY * this.gridSpacing]);

                ndx++;
            }
        }
    }
}