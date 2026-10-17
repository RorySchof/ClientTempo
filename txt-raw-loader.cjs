/** Webpack/Turbopack loader: emit a .txt file as `export default "<contents>"`. */
module.exports = function txtRawLoader(source) {
  return `export default ${JSON.stringify(source)};`;
};
