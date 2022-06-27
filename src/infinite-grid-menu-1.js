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

export class InfiniteGridMenu1 {

    #time = 0;
    #deltaTime = 0;
    #frames = 0;

    scrollOffset = vec2.create();

    GRID_SPACING = 300;
    GRID_ITEM_COUNT_PADDING = 2;
    GRID_ITEM_RADIUS = 50;
    GRID_COLUMN_DIAMOND_OFFSET = 0.5;
    GRID_ROW_DIAMOND_OFFSET = Math.sqrt(3) / 2;

    items = [
        new MenuItem('Red', '#EC7063'),
        new MenuItem('Green', '#5DADE2'),
        new MenuItem('Blue', '#F4D03F'),
        new MenuItem('Yellow', '#58D68D'),
        new MenuItem('Magenta', '#AF7AC5'),
        new MenuItem('Yellow', '#566573'),
        new MenuItem('Magenta', '#DC7633'),
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

        this.gridSpacingScale = 1;
        this.gridSpacingOffset = vec2.fromValues(
            this.GRID_ROW_DIAMOND_OFFSET,
            this.GRID_COLUMN_DIAMOND_OFFSET
        );
        this.gridSpacing = vec2.fromValues(
            this.GRID_SPACING * this.gridSpacingOffset[0],
            this.GRID_SPACING
        );
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
        this.pointerDownScrollOffset = vec2.clone(this.scrollOffset);
        this.pointerDownPos = vec2.create();
        this.pointerPos = vec2.create;
        this.pointerFollowerPos = vec2.create();
        this.pointerVelocity = vec2.create();
        this.pointerVelocityLengthFollower = 0;

        this.canvas.addEventListener('pointerdown', e => {
            this.pointerDownScrollOffset = vec2.clone(this.scrollOffset);
            this.pointerDownPos = vec2.set(this.pointerDownPos, e.clientX, e.clientY);
            this.pointerPos = vec2.clone(this.pointerDownPos);
            this.pointerFollowerPos = vec2.clone(this.pointerPos);
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
            }
        });
    }

    #animate(deltaTime) {
        const timeScale = deltaTime / 16;
        const pointerFollowerDamping = .3 * timeScale;

        if (this.pointerDown) {
            vec2.set(
                this.pointerVelocity,
                (this.pointerPos[0] - this.pointerFollowerPos[0]) * pointerFollowerDamping,
                (this.pointerPos[1] - this.pointerFollowerPos[1]) * pointerFollowerDamping
            );
        } else {
            vec2.scale(
                this.pointerVelocity,
                this.pointerVelocity,
                0.9
            );
        }
        this.pointerFollowerPos[0] += this.pointerVelocity[0];
        this.pointerFollowerPos[1] += this.pointerVelocity[1];

        const maxVelocity = 1000;
        const pointerVelocityLength = Math.min(maxVelocity, vec2.length(this.pointerVelocity)) / maxVelocity;
        const pointerVelocityLengthDamping = 0.4 * timeScale;
        this.pointerVelocityLengthFollower += (pointerVelocityLength - this.pointerVelocityLengthFollower) * pointerVelocityLengthDamping;
        this.pointerVelocityLengthFollower = Math.min(0.1, this.pointerVelocityLengthFollower);
        //this.gridSpacingScale = 1 - this.pointerVelocityLengthFollower;
            
        const pointerOffset = vec2.subtract(vec2.create(), this.pointerFollowerPos, this.pointerDownPos);
        vec2.add(this.scrollOffset, this.pointerDownScrollOffset, pointerOffset);
    }

    #render() {
        /** @type {CanvasRenderingContext2D} */
        const ctx = this.context;

        ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

        const relativeScrollOffset = vec2.fromValues(
            this.scrollOffset[0] % this.gridSize[0],
            this.scrollOffset[1] % this.gridSize[1]
        );

        const spacing = vec2.fromValues(
            this.gridSpacing[0] * this.gridSpacingScale,
            this.gridSpacing[1] * this.gridSpacingScale
        );

        this.gridSize[0] = spacing[0] * this.gridItemCount[0];
        this.gridSize[1] = spacing[1] * this.gridItemCount[1];

        const positionPaddingOffset = this.GRID_COLUMN_DIAMOND_OFFSET;
        const viewportCenter = vec2.scale(vec2.create(), this.viewportSize, 0.5);
        const maxViewportSize = Math.max(this.viewportSize[0], this.viewportSize[1]);

        for(let iY=0; iY<this.gridItemCount[1]; ++iY) {
            for(let iX=0; iX<this.gridItemCount[0]; ++iX) {
                const position = vec2.fromValues(
                    (iX - positionPaddingOffset) * spacing[0] + relativeScrollOffset[0],
                    (iY - positionPaddingOffset) * spacing[1] + relativeScrollOffset[1]
                );
                position[1] += (iX % 2) * this.GRID_COLUMN_DIAMOND_OFFSET * this.GRID_SPACING * this.gridSpacingScale;
                this.#wrapPositionComponent(position, 0);
                this.#wrapPositionComponent(position, 1);

                const scale = 1 - Math.min(1, Math.max(0, vec2.length(vec2.subtract(vec2.create(), position, viewportCenter)) / maxViewportSize));

                const itemIndex = (iX + iY * this.gridItemCount[0]) % this.items.length;
                this.items[itemIndex].render(this.context, this.GRID_ITEM_RADIUS * scale, position);
            }
        }
    }

    #resizeItemGrid() {
        // find the max number of items to be rendered and convert the number to an
        // even number. This will allow alternating column/row offsets
        this.gridItemCount[0] = Math.ceil(this.viewportSize[0] / this.gridSpacing[0]) + this.GRID_ITEM_COUNT_PADDING * 2;
        this.gridItemCount[0] = 2 * Math.ceil(this.gridItemCount[0] / 2);
        this.gridItemCount[1] = Math.ceil(this.viewportSize[1] / this.gridSpacing[1]) + this.GRID_ITEM_COUNT_PADDING * 2;
        this.gridItemCount[1] = 2 * Math.ceil(this.gridItemCount[1] / 2);
    }

    #wrapPositionComponent(position, ndx) {
        const gridItemSize = this.GRID_ITEM_RADIUS * 2;
        if (position[ndx] > this.viewportSize[ndx] + gridItemSize) {
            position[ndx] -= this.gridSize[ndx];
        } else if (position[ndx] < -gridItemSize) {
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