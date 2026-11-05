const { withGradleProperties, withProjectBuildGradle } = require('expo/config-plugins');

const KEY = 'android.cmakeVersion';
const VERSION = '4.1.2';
const MARKER = '// with-windows-cmake-version';

// CMake 4 refuses libraries that declare a very old cmake_minimum_required unless this is set.
const SNIPPET = `
${MARKER}
allprojects { p ->
  p.pluginManager.withPlugin('com.android.base') {
    p.android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_POLICY_VERSION_MINIMUM=3.5')
  }
}
`;

// The Ninja bundled with the Android SDK's default CMake (3.22.1) cannot use paths over 260
// characters, which this repo's native object files exceed on Windows. Newer CMake bundles a
// Ninja that can (Windows long paths must be enabled). Other platforms keep the default.
module.exports = (config) => {
  if (process.platform !== 'win32') {
    return config;
  }
  const withVersion = withGradleProperties(config, (cfg) => {
    if (!cfg.modResults.some((item) => item.key === KEY)) {
      cfg.modResults.push({ type: 'property', key: KEY, value: VERSION });
    }
    return cfg;
  });
  return withProjectBuildGradle(withVersion, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};
