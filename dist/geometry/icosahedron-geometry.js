import { Geometry } from "./geometry.js";

/**
 * Based on https://github.com/sketchpunk/FunWithWebGL2/blob/master/lesson_083_uv_mapped_icosphere/test.html
 */
export class IcosahedronGeometry extends Geometry{
    constructor() {
        super();

        const t = Math.sqrt(5) * 0.5 + 0.5; // 0.5 + Math.sqrt(5) / 2
        this.addVertex(
            -1,  t,  0, //Z Plane orthogonal rectangles (Vertical)
            1,  t,  0,
            -1, -t,  0,
            1, -t,  0,

            0, -1,  t, //X Plane orthogonal rectangles
            0,  1,  t,
            0, -1, -t,
            0,  1, -t,

            t,  0, -1, // Y Plane orthogonal rectangles
            t,  0,  1,
            -t,  0, -1,
            -t,  0,  1
        ).addFace(
            0, 11, 5,	// 5 faces around point 0
            0, 5, 1,
            0, 1, 7,
            0, 7, 10,
            0, 10, 11,

            1, 5, 9,	// 5 adjacent faces
            5, 11, 4,
            11, 10, 2,
            10, 7, 6,
            7, 1, 8,

            3, 9, 4,	// 5 faces around point 3
            3, 4, 2,
            3, 2, 6,
            3, 6, 8,
            3, 8, 9,

            4, 9, 5,	// 5 adjacent faces
            2, 4, 11,
            6, 2, 10,
            8, 6, 7,
            9, 8, 1
        );
    }
}