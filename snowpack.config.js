// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  root: './src/',
  mount: {},
  plugins: [],
  devOptions: {
    port: 1234
  },
  buildOptions: {
    out: './dist/',
    baseUrl: '/infinite-grid-menu/dist/'
  },
};
