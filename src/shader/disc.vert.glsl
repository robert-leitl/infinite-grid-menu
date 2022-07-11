#version 300 es

uniform mat4 uWorldMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uCameraPosition;
uniform vec4 uRotationAxisVelocity;

in vec3 aModelPosition;
in vec3 aModelNormal;
in vec2 aModelUvs;
in mat4 aInstanceMatrix;

out vec2 vUvs;
out float vAlpha;
flat out int vInstanceId;

#define PI 3.141593

void main() {
    vec4 worldPosition = uWorldMatrix * aInstanceMatrix * vec4(aModelPosition, 1.);


    // center of the disc in world space
    vec3 centerPos = (uWorldMatrix * aInstanceMatrix * vec4(0., 0., 0., 1.)).xyz;
    float radius = length(centerPos.xyz);

    // skip the center vertex of the disc geometry
    if (gl_VertexID > 0) {
        // stretch the disc according to the axis and velocity of the rotation
        vec3 rotationAxis = uRotationAxisVelocity.xyz;
        float rotationVelocity = min(.125, uRotationAxisVelocity.w * 15.);
        // the stretch direction is orthogonal to the rotation axis and the position
        vec3 stretchDir = normalize(cross(centerPos, rotationAxis));
        // the position of this vertex relative to the center position
        vec3 relativeVertexPos = normalize(worldPosition.xyz - centerPos);
        // vertices more in line with the stretch direction get a larger offset
        float strength = dot(stretchDir, relativeVertexPos);
        strength = rotationVelocity * sign(strength) * smoothstep(0., .7, abs(strength));
        // apply the stretch distortion
        worldPosition.xyz += stretchDir * strength;
    }

    // move the vertex back to the overall sphere
    worldPosition.xyz = radius * normalize(worldPosition.xyz);
    

    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;

    vAlpha = pow(normalize(worldPosition.xyz).z, 1.);
    vUvs = aModelUvs;
    vInstanceId = gl_InstanceID;
}