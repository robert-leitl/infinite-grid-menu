import { resizeCanvasToDisplaySize } from "./utils/canvas-utils";
import { vec2 } from "gl-matrix";
import { SpringNode2 } from "./physics/SpringNode2";
import { SpringConstraint2 } from "./physics/SpringConstraint2";
import { SpringSimulation2 } from "./physics/SpringSimulation2";

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



export class InfiniteGridMenu2 {

    #time = 0;
    #deltaTime = 0;
    #frames = 0;

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

        //////// Init Simulation
        const clen = 50;
        const wSeg = 4;
        const hSeg = 4;
        const nodes = [];
        const constraints = [];
        for(let j=0; j<(hSeg + 1); ++j) {
            for(let n=0; n<(wSeg + 1); ++n) {
                nodes.push(new SpringNode2(400 + 10 * n, 400 + 10 * j));
            }
        }

        const wOff = wSeg + 1;
        for(let iy = 0; iy < hSeg; ++iy) {
            for(let ix = 0; ix < wSeg; ++ix) {
                let i1 = iy * wOff + ix;
                let i2 = iy * wOff + ix + 1;
                let i3 = (iy + 1) * wOff + ix + 1;

                constraints.push(new SpringConstraint2(nodes[i1], nodes[i2], clen));
                constraints.push(new SpringConstraint2(nodes[i2], nodes[i3], clen));
                constraints.push(new SpringConstraint2(nodes[i3], nodes[i1], clen));

                i1 = (iy + 1) * wOff + ix + 1;
                i2 = (iy + 1) * wOff + ix;
                i3 = iy * wOff + ix;

                constraints.push(new SpringConstraint2(nodes[i1], nodes[i2], clen));
                constraints.push(new SpringConstraint2(nodes[i2], nodes[i3], clen));
                constraints.push(new SpringConstraint2(nodes[i3], nodes[i1], clen));
            }
        }
        for(let iy = 0; iy < hSeg - 1; ++iy) {
            for(let ix = 0; ix < wSeg - 1; ++ix) {
                let i1 = iy * wOff + ix;
                let i2 = iy * wOff + ix + 2;
                let i3 = (iy + 2) * wOff + ix + 2;

                constraints.push(new SpringConstraint2(nodes[i1], nodes[i2], 2 * clen));
                constraints.push(new SpringConstraint2(nodes[i2], nodes[i3], 2 * clen));
                constraints.push(new SpringConstraint2(nodes[i3], nodes[i1], 2 * clen));

                i1 = (iy + 2) * wOff + ix + 2;
                i2 = (iy + 2) * wOff + ix;
                i3 = iy * wOff + ix;

                constraints.push(new SpringConstraint2(nodes[i1], nodes[i2], 2 * clen));
                constraints.push(new SpringConstraint2(nodes[i2], nodes[i3], 2 * clen));
                constraints.push(new SpringConstraint2(nodes[i3], nodes[i1], 2 * clen));
            }
        }
        
        this.pointerNode = new SpringNode2(0, 0, true);
        this.pointerConstraint = new SpringConstraint2(null, this.pointerNode, 0);
        this.simulation = new SpringSimulation2(nodes, constraints);

        this.#initEventHandling();

        this.resize();

        if (onInit) onInit(this);
    }

    #initEventHandling() {
        this.pointerDownPos = vec2.create();
        this.pointerPos = vec2.create();
        this.pointerOffset = vec2.create();

        this.canvas.addEventListener('pointerdown', e => {
            this.pointerDownPos = vec2.set(this.pointerDownPos, e.clientX, e.clientY);
            this.pointerPos = vec2.clone(this.pointerDownPos);
            this.pointerDown = true;
            this.#addPointerConstraint();
        });
        this.canvas.addEventListener('pointerup', e => {
            this.pointerDown = false;
            this.#removePointerConstraint();
        });
        this.canvas.addEventListener('pointerleave', e => {
            this.pointerDown = false;
            this.#removePointerConstraint();
        });
        this.canvas.addEventListener('pointermove', e => {
            if (this.pointerDown) {
                this.pointerPos[0] = e.clientX;
                this.pointerPos[1] = e.clientY;
            }
        });
    }

    #addPointerConstraint() {
        const nearestNode = this.simulation.findNearestNode(this.pointerDownPos);
        vec2.sub(this.pointerOffset, nearestNode.position, this.pointerDownPos);
        this.pointerConstraint.a = nearestNode;
        this.simulation.constraints.push(this.pointerConstraint);
    }

    #removePointerConstraint() {
        const index = this.simulation.constraints.indexOf(this.pointerConstraint);
        if (index > -1) {
            this.simulation.constraints.splice(index, 1);
        }
    }

    #animate(deltaTime) {
        const timeScale = deltaTime / 16;

        vec2.copy(this.pointerNode.position, this.pointerPos);
        vec2.add(this.pointerNode.position, this.pointerNode.position, this.pointerOffset);

        this.simulation.update(deltaTime);

        // wrap the positions of the nodes
        this.simulation.nodes.forEach(node => {
            const p = node.position;
        });
    }

    #render() {
        /** @type {CanvasRenderingContext2D} */
        const ctx = this.context;

        ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

        this.simulation.nodes.forEach(node => {
            ctx.strokeStyle = null;
            ctx.beginPath();
            ctx.fillStyle = '#00f';
            ctx.arc(node.position[0], node.position[1], 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.closePath();
        })
    }

    #wrapPositionComponent(position, ndx) {
        const gridItemSize = this.GRID_ITEM_RADIUS * 2;
        if (position[ndx] > this.viewportSize[ndx] + gridItemSize) {
            position[ndx] -= this.gridSize[ndx];
        } else if (position[ndx] < -gridItemSize) {
            position[ndx] += this.gridSize[ndx];
        }
    }
}