module.exports = function withNativeRawTcpPrinter(config) {
  // Native autolinking handles code registration. The app's existing printer
  // plugin remains the single owner of LAN permission declarations.
  return config;
};
