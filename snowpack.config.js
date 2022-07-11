// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  root: './src/',
  mount: {},
  plugins: [
    ['snowpack-plugin-glslify', { "compress": false }]
  ],
  devOptions: {
    port: 1234
  },
  buildOptions: {
    out: './dist/',
    metaUrlPath: 'web_modules'
  },
};
