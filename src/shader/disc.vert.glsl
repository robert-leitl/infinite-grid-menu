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

void main() {
    vec4 worldPosition = aInstanceMatrix * uWorldMatrix * vec4(aModelPosition, 1.);

    
    vec4 discOriginPos = aInstanceMatrix * uWorldMatrix * vec4(0., 0., 0., 1.);
    float radius = length(discOriginPos.xyz);
    vec3 velocityDirection = cross(discOriginPos.xyz, uRotationAxisVelocity.xyz);
    vec3 relativeVertexPos = worldPosition.xyz - discOriginPos.xyz;
    float offsetStrength = dot(velocityDirection, relativeVertexPos);
    offsetStrength = uRotationAxisVelocity.w * offsetStrength * 2.;
    worldPosition.xyz += velocityDirection * offsetStrength;
    worldPosition.xyz = radius * normalize(worldPosition.xyz);


    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;

    vAlpha = pow(normalize(worldPosition.xyz).z, 1.);
    vUvs = aModelUvs;
}