import { vec2 } from "../web_modules/pkg/gl-matrix.js";

export class SpringSimulation2 {

    CONSTRAINT_ITERATIONS = 1;
    TIMESTEP = (18 / 1000);
    DAMPING = 0.08;
    DRAG = 1 - this.DAMPING;

    constructor(nodes, constraints) {
        this.nodes = nodes;
        this.constraints = constraints;
    }

    reset() {
        this.nodes.forEach(node => node.reset());
    }

    update(deltaTime) {
        const timeScale = deltaTime / 16;

        // satisfy constraints
        for (let i = 0; i < this.CONSTRAINT_ITERATIONS; i += 1) {
            this.constraints.forEach(constraint => constraint.satisify());
        }

        // add forces and perform verlet integration
        const timesq = Math.pow((this.TIMESTEP * timeScale), 2);
        this.nodes.forEach(node => {
            node.integrate(timesq, this.DRAG)
        });
    }

    isRelaxed() {
        return this.nodes.every(node => node.isRelaxed);
    }

    findNearestNode(position) {
        const l = this.nodes.length;
        let minDist = Number.MAX_VALUE;
        let result = null;
        for(let i=0; i<l; ++i) {
            const node = this.nodes[i];
            const dist = vec2.sqrLen(vec2.sub(vec2.create(), node.position, position));

            if (dist < minDist) {
                result = node;
                minDist = dist;
            }
        }
        return result;
    }
}