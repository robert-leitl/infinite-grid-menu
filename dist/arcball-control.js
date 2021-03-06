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
    rotationAxis = vec3.fromValues(1, 0, 0);

    // the direction to move the snap target to (in world space)
    snapDirection = vec3.fromValues(0, 0, 1);

    // the direction of the target to move to the snap direction (in world space)
    snapTargetDirection;

    EPSILON = 0.1;
    IDENTITY_QUAT = quat.create();

    constructor(canvas, updateCallback) {
        this.canvas = canvas;
        this.updateCallback = updateCallback ? updateCallback : () => null;

        this.isPointerDown = false;
        this.pointerPos = vec2.create();
        this.previousPointerPos = vec2.create();
        this._rotationVelocity = 0;    // smooth rotational velocity
        this._combinedQuat = quat.create();     // to smooth out the rotational axis

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
        const timeScale = deltaTime / targetFrameDuration + 0.00001;

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
                quat.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY_QUAT, INTENSITY);
            }
        } else {
            // the intensity of the continuation for the pointer rotation (lower --> longer continuation)
            const INTENSITY = 0.1 * timeScale;

            // decrement the pointer rotation smoothly to the identity quaternion
            quat.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY_QUAT, INTENSITY);

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
        this.orientation = quat.multiply(quat.create(), combinedQuat, this.orientation);
        quat.normalize(this.orientation, this.orientation);

        // the intensity of the rotation axis changes to reach the new axis (lower value --> slower movement)
        const RA_INTENSITY = .8 * timeScale;

        // smooth out the combined rotation axis
        quat.slerp(this._combinedQuat, this._combinedQuat, combinedQuat, RA_INTENSITY);
        quat.normalize(this._combinedQuat, this._combinedQuat);

        // the intensity of the rotation angel to reach the new angel (lower value --> slower movement)
        const RV_INTENSITY = 0.5 * timeScale;

        // check if there is a significant change in rotation, otherwise
        // getAxisAngle will return an arbitrary fixed axis which will result
        // in jumps during the animation
        const rad = Math.acos(this._combinedQuat[3]) * 2.0;
        const s = Math.sin(rad / 2.0);
        let rv = 0;
        if (s > 0.000001) {
            // calculate the rotation axis and velocity from the combined rotation
            // --> quat.getAxisAngle(this.rotationAxis, this._combinedQuat) / (2 * Math.PI);
            rv = rad / (2 * Math.PI);
            this.rotationAxis[0] = this._combinedQuat[0] / s;
            this.rotationAxis[1] = this._combinedQuat[1] / s;
            this.rotationAxis[2] = this._combinedQuat[2] / s;
        }

        // smooth out the velocity
        this._rotationVelocity += (rv - this._rotationVelocity) * RV_INTENSITY;
        this.rotationVelocity = this._rotationVelocity / timeScale;

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