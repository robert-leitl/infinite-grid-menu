import { vec2, vec3 } from "gl-matrix";

export class Vertex {
    constructor(x, y, z) {
        this.position = vec3.fromValues(x, y, z);
        this.normal = vec3.create();
        this.uv = vec2.create();
    }
}