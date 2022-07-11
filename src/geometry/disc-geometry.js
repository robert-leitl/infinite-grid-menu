import { Geometry } from "./geometry";

export class DiscGeometry extends Geometry{
    constructor(steps = 4, radius = 1) {
        super();

        steps = Math.max(4, steps);

        const alpha = (2 * Math.PI) / steps;

        // add center vertex
        this.addVertex(0, 0, 0);
        this.lastVertex.uv[0] = 0.5;
        this.lastVertex.uv[1] = 0.5;

        for(let i=0; i<steps; ++i) {
            const x = Math.cos(alpha * i);
            const y = Math.sin(alpha * i);

            this.addVertex(radius * x, radius * y, 0);
            
            this.lastVertex.uv[0] = x * 0.5 + 0.5;
            this.lastVertex.uv[1] = y * 0.5 + 0.5;


            if (i > 0)
                this.addFace(0, i, i+1);  
        }

        this.addFace(0, steps, 1);
    }
}