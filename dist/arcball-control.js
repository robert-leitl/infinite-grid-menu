import { quat, vec3, vec2, mat3 } from './web_modules/pkg/gl-matrix.js';

export class ArcballControl {

    // flag which indicates if the user is currently dragging
    isPointerDown = false;

    // this quarternion describes the current orientation of the object
    orientation = quat.create();

    // the current pointer rotation as a quarternion
    pointerRotation = quat.create();

    // the velocity of the rotation
    rotationVelocity = 0;

    // the axis of the rotation
    rotationAxis = vec3.create();

    // the direction to move the snap target to (in world space)
    snapDirection = vec3.fromValues(0, 0, 1);

    // the direction of the target to move to the snap direction (in world space)
    snapTargetDirection;

    EPSILON = 0.0001;

    constructor(canvas, updateCallback) {
        this.canvas = canvas;
        this.updateCallback = updateCallback ? updateCallback : () => null;

        this.isPointerDown = false;
        this.pointerPos = vec2.create();
        this.previousPointerPos = vec2.create();
        this.autoRotationSpeed = 0;

        canvas.addEventListener('pointerdown', e => {
            this.pointerPos = vec2.fromValues(e.clientX, e.clientY);
            this.previousPointerPos = vec2.clone(this.pointerPos);
            this.isPointerDown = true;
        });
        canvas.addEventListener('pointerup', e => {
            this.isPointerDown = false;
        });
        canvas.addEventListener('pointerleave', e => {
            this.isPointerDown = false;
        });
        canvas.addEventListener('pointermove', e => {
            if (this.isPointerDown) {
                vec2.set(this.pointerPos, e.clientX, e.clientY);
            }
        });

        // disable native touch handling
        canvas.style.touchAction = 'none';
    }

    update(deltaTime, targetFrameDuration = 16) {
        const timeScale = deltaTime / targetFrameDuration;

        let angleFactor = timeScale;
        let snapRotation = quat.create();

        if (this.isPointerDown) {
            // the intensity of the pointer to reach the new position (lower value --> slower movement)
            const INTENSITY = 0.3 * timeScale;
            // the factor to amplify the rotation angle (higher value --> faster rotation)
            const ANGLE_AMPLIFICATION = 5 / timeScale;

            // get only a part of the pointer movement to smooth out the movement
            const midPointerPos = vec2.sub(vec2.create(), this.pointerPos, this.previousPointerPos);
            vec2.scale(midPointerPos, midPointerPos, INTENSITY);

            if (vec2.sqrLen(midPointerPos) > this.EPSILON) {
                vec2.add(midPointerPos, this.previousPointerPos, midPointerPos);

                // get points on the arcball and corresponding normals
                const p = this.#project(midPointerPos);
                const q = this.#project(this.previousPointerPos);
                const a = vec3.normalize(vec3.create(), p);
                const b = vec3.normalize(vec3.create(), q);
    
                // copy for the next iteration
                vec2.copy(this.previousPointerPos, midPointerPos);
    
                // scroll faster
                angleFactor *= ANGLE_AMPLIFICATION;
    
                // get the new rotation quat
                this.quatFromVectors(a, b, this.pointerRotation, angleFactor);
            } else {
                quat.identity(this.pointerRotation);
            }
        } else {
            // the intensity of the continuation for the pointer rotation (lower --> shorter continuation)
            const INTENSITY = 0.1 * timeScale;

            // decrement the pointer rotation smoothly to the identity quaternion
            quat.slerp(this.pointerRotation, this.pointerRotation, quat.create(), INTENSITY);

            if (this.snapTargetDirection) {
                // defines the strength of snapping rotation (lower --> less strong)
                const INTENSITY = 0.2;

                const a = this.snapTargetDirection
                const b = this.snapDirection;
    
                // smooth out the snapping by damping the effect of farther away points
                const sqrDist = vec3.squaredDistance(a, b);
                const distanceFactor =  Math.max(0.1, 1 - sqrDist * 10);
    
                // slow down snapping
                angleFactor *= INTENSITY * distanceFactor;
    
                this.quatFromVectors(a, b, snapRotation, angleFactor);
            }
        }

        // combine the pointer rotation with the snap rotation and add it to the orientation
        const combinedQuat = quat.multiply(quat.create(), snapRotation, this.pointerRotation);
        this.orientation = quat.multiply(quat.normalize(quat.create(), quat.create()), combinedQuat, this.orientation);
        quat.normalize(this.orientation, this.orientation);
        if (vec3.sqrLen(this.rotationAxis) < this.EPSILON)
            vec3.set(this.rotationAxis, 0, 1, 0);

        // calculate the rotation axis and velocity from the combined rotation
        this.rotationVelocity = quat.getAxisAngle(this.rotationAxis, combinedQuat) / (2 * Math.PI);
        this.rotationVelocity /= timeScale;
        vec3.normalize(this.rotationAxis, this.rotationAxis);

        this.updateCallback(deltaTime);
    }

    quatFromVectors(a, b, out, angleFactor = 1) {
        // get the normalized axis of rotation
        const axis = vec3.cross(vec3.create(), a, b);
        vec3.normalize(axis, axis);

        // get the amount of rotation
        const d = Math.max(-1, Math.min(1, vec3.dot(a, b)));
        const angle = Math.acos(d) * angleFactor;

        // return the new rotation quat
        return { q: quat.setAxisAngle(out, axis, angle), axis, angle };
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
        const r = 2; // arcball radius
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