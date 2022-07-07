import { vec2 } from "../web_modules/pkg/gl-matrix.js";

export class SpringConstraint2 {
    constructor(a, b, distance) {
        this.a = a;
        this.b = b;
        this.distance = distance;
        this.temp = vec2.create();
    }

    satisify() {
        vec2.sub(this.temp, this.a.position, this.b.position);

        const currentDist = vec2.len(this.temp);
        if (currentDist === 0) return; // prevents division by 0

        // correction vector
        vec2.scale(this.temp, this.temp, 1 - (this.distance / currentDist));
        // only apply the half correction to each node
        vec2.scale(this.temp, this.temp, 0.5);

        // apply correction to nodes
        if (!this.a.isFixed) vec2.sub(this.a.position, this.a.position, this.temp);
        if (!this.b.isFixed) vec2.add(this.b.position, this.b.position, this.temp);
    }
};