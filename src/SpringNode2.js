import { vec2 } from "gl-matrix";

export class SpringNode2 {
    mass = 100.25;
    isFixed = false;
    relaxationThreshold = 0.005;

    constructor(x, y, isFixed = false) {
        this.originalPosition = vec2.fromValues(x, y);
        this.position = vec2.clone(this.originalPosition);
        this.previousPosition = vec2.clone(this.position);
        this.acceleration = vec2.create();
        this.invMass = 1 / this.mass;
        this.isFixed = isFixed;

        // helper
        this.temp = vec2.create();
    }

    addForce(force) {
        // F = m * a
        vec2.add(this.acceleration, this.acceleration, vec2.scale(vec2.create(), force, this.invMass));
    }

    integrate(timesq, drag) {
        if (this.isFixed) {
            vec2.copy(this.position, this.originalPosition);
        } else {
            // delta to previous position
            vec2.sub(this.temp, this.position, this.previousPosition);
            // apply the drag
            vec2.scale(this.temp, this.temp, drag);
            // add it to the current position
            vec2.add(this.temp, this.temp, this.position);
            // get position change from current acceleration
            vec2.scale(this.acceleration, this.acceleration, timesq);
            // add the position change by acceleration
            vec2.add(this.temp, this.temp, this.acceleration);

            // set values for next iteration
            vec2.copy(this.previousPosition, this.position);
            vec2.copy(this.position, this.temp);
            vec2.zero(this.acceleration);
        }
    }

    get isRelaxed() {
        if (!this.tmp1) return false;
        return this.tmp1.subVectors(this, this.previousPosition).length() < this.relaxationThreshold;
    }

    reset() {
        vec2.copy(this.position, this.originalPosition);
        vec2.copy(this.previousPosition, this.position);
    }
}