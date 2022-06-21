import { resizeCanvasToDisplaySize } from "./utils/canvas-utils";
import { vec2 } from "gl-matrix";

class MenuItem {

    constructor(label, color) {
        this.label = label;
        this.color = color;
    }

    render(/** @type {CanvasRenderingContext2D} */ ctx, radius, position) {
        ctx.strokeStyle = null;
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(position[0], position[1], radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.closePath();
    }
}

export class InfiniteGridMenu {

    #time = 0;
    #deltaTime = 0;
    #frames = 0;

    scrollOffset = vec2.create();

    GRID_ITEM_COUNT_PADDING = 2;
    GRID_ITEM_RADIUS = 25;

    items = [
        new MenuItem('Red', '#f00'),
        new MenuItem('Green', '#0f0'),
        new MenuItem('Blue', '#00f'),
        new MenuItem('Yellow', '#ff0'),
        new MenuItem('Magenta', '#f0f'),
        new MenuItem('Yellow', '#333'),
        new MenuItem('Magenta', '#aaa'),
        new MenuItem('Magenta', '#eee'),
    ];

    gridItems = [];

    constructor(canvas, onInit = null) {
        this.canvas = canvas;

        this.#init(onInit);
    }

    resize() {
        this.viewportSize = vec2.set(
            this.viewportSize,
            this.canvas.clientWidth,
            this.canvas.clientHeight
        );

        resizeCanvasToDisplaySize(this.canvas);

        this.#resizeItemGrid();
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
        
        this.viewportSize = vec2.fromValues(
            this.canvas.clientWidth,
            this.canvas.clientHeight
        )

        this.gridSpacing = 200;
        this.gridItemCount = vec2.create();
        this.gridSize = vec2.create();

        this.scrollOffset = vec2.fromValues(
            this.viewportSize[0] / 2, 
            this.viewportSize[1] / 2
        );

        this.#initEventHandling();

        this.resize();

        if (onInit) onInit(this);
    }

    #initEventHandling() {
        this.canvas.addEventListener('pointerdown', e => {
            this.pointerDownScrollOffset = vec2.clone(this.scrollOffset);
            this.pointerDownPos = vec2.fromValues(e.clientX, e.clientY);
            this.pointerPos = vec2.fromValues(e.clientX, e.clientY);
            this.pointerDown = true;
        });
        this.canvas.addEventListener('pointerup', e => {
            this.pointerDown = false;
        });
        this.canvas.addEventListener('pointerleave', e => {
            this.pointerDown = false;
        });
        this.canvas.addEventListener('pointermove', e => {
            if (this.pointerDown) {
                this.pointerPos[0] = e.clientX;
                this.pointerPos[1] = e.clientY;

                const pointerOffset = vec2.subtract(vec2.create(), this.pointerPos, this.pointerDownPos);
                vec2.add(this.scrollOffset, this.pointerDownScrollOffset, pointerOffset);
            }
        });
    }

    #animate(deltaTime) {

    }

    #render() {
        /** @type {CanvasRenderingContext2D} */
        const ctx = this.context;

        ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

        const relativeScrollOffet = vec2.fromValues(
            this.scrollOffset[0] % this.viewportSize[0],
            this.scrollOffset[1] % this.viewportSize[1]
        );

        for(let iY=0; iY<this.gridItemCount[1]; ++iY) {
            for(let iX=0; iX<this.gridItemCount[0]; ++iX) {
                const position = vec2.fromValues(
                    (iX - 1) * this.gridSpacing + relativeScrollOffet[0],
                    (iY - 1) * this.gridSpacing + relativeScrollOffet[1]
                );
                this.#wrapPositionComponent(position, 0);
                this.#wrapPositionComponent(position, 1);
                this.items[2].render(this.context, this.GRID_ITEM_RADIUS, position);
            }
        }
    }

    #resizeItemGrid() {
        // find the max number of items to be rendered and convert the number to an
        // even number. This will allow alternating column/row offsets
        this.gridItemCount[0] = Math.ceil(this.viewportSize[0] / this.gridSpacing) + this.GRID_ITEM_COUNT_PADDING;
        this.gridItemCount[0] = 2 * Math.ceil(this.gridItemCount[0] / 2);
        this.gridItemCount[1] = Math.ceil(this.viewportSize[1] / this.gridSpacing) + this.GRID_ITEM_COUNT_PADDING;
        this.gridItemCount[1] = 2 * Math.ceil(this.gridItemCount[1] / 2);
        this.gridSize[0] = this.gridSpacing * this.gridItemCount[0];
        this.gridSize[1] = this.gridSpacing * this.gridItemCount[1];
    }

    #wrapPositionComponent(position, ndx) {
        if (position[ndx] > this.viewportSize[ndx] + this.GRID_ITEM_RADIUS * 2) {
            position[ndx] -= this.gridSize[ndx];
        } else if (position[ndx] < -this.GRID_ITEM_RADIUS * 2) {
            position[ndx] += this.gridSize[ndx];
        }
    }

    #getItemFromGridIndex(iX, iY, offset) {
        let itemIndex = iX % this.gridItemCountX + (iY % this.gridItemCountY) * this.gridItemCountX;
        const gridIndex = Math.floor(iX / this.gridItemCountX) + Math.floor(iY / this.gridItemCountY) * this.gridItemCountX;
        itemIndex += gridIndex * this.gridDisplacement + offset;
        itemIndex %= this.itemCount;

        return this.items[itemIndex];
    }

    #getPositionFromItemIndex(itemIndex) {}
}