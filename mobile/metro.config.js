const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// jspdf's package.json `main` points to jspdf.node.min.js which contains
// AMD require(["html2canvas"]) that Metro's transformer can't parse.
// Force Metro to always use the ES module build instead.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jspdf') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'node_modules/jspdf/dist/jspdf.es.min.js'),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
