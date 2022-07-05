import { quat, vec3, vec2, mat3 } from 'gl-matrix';

export class ArcballControl {

    // the current rotation quaternion
    rotationQuat = quat.create();
    targetRotationQuat = quat.create();
    pointerQuat = quat.create();


    snapVertexPos;

    constructor(canvas, vertices, updateCallback) {
        this.canvas = canvas;
        this.updateCallback = updateCallback ? updateCallback : () => null;
        this.vertices = vertices;

        quat.normalize(this.rotationQuat, this.rotationQuat);
        quat.normalize(this.targetRotationQuat, this.targetRotationQuat);

        this.pointerDown = false;
        this.pointerDownPos = vec2.create();
        this.pointerPos = vec2.create();
        this.followPos = vec3.create();
        this.prevFollowPos = vec3.create();
        this.autoRotationSpeed = 0;

        this.pointerAngle = 0;
        this.pointerAxis = vec3.create();

        canvas.style.touchAction = 'none';

        canvas.addEventListener('pointerdown', e => {
            this.pointerDownPos = vec2.fromValues(e.clientX, e.clientY);
            this.followPos = vec3.fromValues(e.clientX, e.clientY, 0);
            this.pointerPos = vec2.fromValues(e.clientX, e.clientY);
            this.prevFollowPos = vec3.fromValues(e.clientX, e.clientY, 0);
            this.pointerDown = true;
            this.autoRotationSpeed = 0;
            this.snapVertexPos = null;
        });
        canvas.addEventListener('pointerup', e => {
            if (!this.pointerDown) return;

            this.pointerDown = false;
            this.snapToNearestPoint();
        });
        canvas.addEventListener('pointerleave', e => {
            if (!this.pointerDown) return;

            this.pointerDown = false;
            this.snapToNearestPoint();
        });
        canvas.addEventListener('pointermove', e => {
            if (this.pointerDown) {
                this.pointerPos[0] = e.clientX;
                this.pointerPos[1] = e.clientY;
            }
        });
    }

    update(deltaTime) {
        const timeScale = 16 / (deltaTime + 0.01);

        // the mouse follower
        const pointerDamping = 1 * timeScale;
        this.followPos[0] += (this.pointerPos[0] - this.followPos[0]) / pointerDamping;
        this.followPos[1] += (this.pointerPos[1] - this.followPos[1]) / pointerDamping;

        let slerpDamping = 0.8;
        let angleFactor = timeScale;
        let snapQuat = quat.create();
        let a;  // rotate from point a
        let b;  // to point b

        if (this.pointerDown) {
            // get points on the arcball and corresponding normals
            const p = this.#project(this.followPos);
            const q = this.#project(this.prevFollowPos);
            a = vec3.normalize(vec3.create(), p);
            b = vec3.normalize(vec3.create(), q);

            // scroll faster
            angleFactor *= 1.5;

            // get the normalized axis of rotation
            const axis = vec3.cross(vec3.create(), a, b);
            vec3.normalize(axis, axis);

            // get the amount of rotation
            const d = Math.max(-1, Math.min(1, vec3.dot(a, b)));
            const angle = Math.acos(d) * angleFactor;

            // store the angle velocity and axis
            this.pointerAngle = angle;
            this.pointerAxis = axis;

            // get the new rotation quat
            quat.setAxisAngle(this.pointerQuat, this.pointerAxis, this.pointerAngle);
        } else {
            quat.slerp(this.pointerQuat, this.pointerQuat, quat.create(), 0.1);
        }
        
        if (this.snapVertexPos) {
            // transform the nearest vertex position to world space
            a = vec3.transformQuat(vec3.create(), this.snapVertexPos, this.targetRotationQuat);
            vec3.normalize(a, a);
            b = vec3.fromValues(0, 0, 1);

            // get the normalized axis of rotation
            const axis = vec3.cross(vec3.create(), a, b);
            vec3.normalize(axis, axis);

            // get the amount of rotation
            const d = Math.max(-1, Math.min(1, vec3.dot(a, b)));
            const angle = Math.acos(d) * 0.5;

            // get the new rotation quat
            quat.setAxisAngle(snapQuat, axis, angle);

            slerpDamping = 0.3;
        }

        const combinedQuat = quat.multiply(quat.create(), snapQuat, this.pointerQuat);

        // get the new rotation by adding the offset quarternion (r) to the 
        // previous target rotation
        quat.multiply(this.targetRotationQuat, combinedQuat, this.targetRotationQuat);

        // lerp between the target and the current rotation
        quat.slerp(this.rotationQuat, this.rotationQuat, this.targetRotationQuat, slerpDamping);
        //this.rotationQuat = this.targetRotationQuat;

        // normalize the rotation quat to be applied to the target
        //quat.normalize(this.rotationQuat, this.rotationQuat);

        // update for the next iteration
        this.prevFollowPos = vec3.clone(this.followPos);
        this.updateCallback();
    }

    quatFromVectors(a, b, angleFactor = 1) {
        // get the normalized axis of rotation
        const axis = vec3.cross(vec3.create(), a, b);
        vec3.normalize(axis, axis);

        // get the amount of rotation
        const d = Math.max(-1, Math.min(1, vec3.dot(a, b)));
        const angle = Math.acos(d) * angleFactor;

        // return the new rotation quat
        return quat.setAxisAngle(quat.create(), axis, angle);
    }

    snapToNearestPoint() {
        // map the XY-Plane normal to the model space
        const n = vec3.fromValues(0, 0, 1);
        const iq = quat.conjugate(quat.create(), this.rotationQuat);
        const nt = vec3.transformQuat(vec3.create(), n, iq);    // normal in model space
        
        // find the nearest vertex 
        let maxD = -1;
        let nearestVertexPos;
        for(let i=0; i<this.vertices.length; ++i) {
            const d = vec3.dot(nt, this.vertices[i].position);
            if (d > maxD) {
                maxD = d;
                nearestVertexPos = this.vertices[i].position;
            }
        }

        this.snapVertexPos = nearestVertexPos;

        
        
        // get the new target rotation from the nearest vertex pos and the normal
        /*const np = vec3.normalize(vec3.create(), t);
        const nq = vec3.normalize(vec3.create(), n);

        // get the normalized axis of rotation
        const axis = vec3.cross(vec3.create(), n, t);
        vec3.normalize(axis, axis);

        // get the amount of rotation
        const d = Math.max(-1, Math.min(1, vec3.dot(np, nq)));
        const angle = -Math.acos(d);

        // get the new rotation quat
        const r = quat.setAxisAngle(quat.create(), axis, angle);

        // get the new rotation by adding the offset quarternion (r) to the 
        // previous target rotation
        quat.multiply(this.targetRotationQuat, this.rotationQuat, r);
        this.rotationQuat = this.targetRotationQuat;*/

        //quat.identity(this.targetRotationQuat);
    }

    quatToString(q) {
        return `(${Math.round(q[0]*1000)/1000},${Math.round(q[1]*1000)/1000},${Math.round(q[2]*1000)/1000},${Math.round(q[3]*1000)/1000})`
    }

    /**
     * Maps pointer coordinates to canonical coordinates [-1, 1] 
     * and projects them onto the arcball surface or onto a 
     * hyperbolical function outside the arcball.
     * 
     * @return vec3 The arcball coords
     * 
     * @see https://www.xarg.org/2021/07/trackball-rotation-using-quaternions/
     */
    #project(pos) {
        const r = 1; // arcball radius
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        const s = Math.max(w, h) - 1;

        // map to -1 to 1
        const x = (2 * pos[0] - w - 1) / s;
        const y = (2 * pos[1] - h - 1) / s;
        let z = 0;
        const xySq = x * x + y * y;
        const rSq = r * r;

        if (xySq <= rSq / 2)
            z = Math.sqrt(rSq - xySq);
        else
            z = (rSq / 2) / Math.sqrt(xySq); // hyperbolical function

        return vec3.fromValues(-x, y, z);
    }
}