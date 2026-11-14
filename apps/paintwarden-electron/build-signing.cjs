// Only opt in when a complete credential set exists. Partial setup must still produce
// an explicitly unsigned beta, not a misleading half-signed/notarized artifact.
function signingConfiguration(platform, env) {
  const values =
    platform === "darwin"
      ? [
          "MAC_CERTIFICATE_P12_BASE64",
          "MAC_CERTIFICATE_PASSWORD",
          "APPLE_ID",
          "APPLE_APP_SPECIFIC_PASSWORD",
          "APPLE_TEAM_ID",
        ]
      : ["WINDOWS_CERTIFICATE_P12_BASE64", "WINDOWS_CERTIFICATE_PASSWORD"];
  const signed = values.every((key) => Boolean(env[key]));
  const certificate = platform === "darwin" ? "MAC_CERTIFICATE_P12_BASE64" : "WINDOWS_CERTIFICATE_P12_BASE64";
  const password = platform === "darwin" ? "MAC_CERTIFICATE_PASSWORD" : "WINDOWS_CERTIFICATE_PASSWORD";
  return {
    signed,
    env: {
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
      CSC_LINK: signed ? env[certificate] : "",
      CSC_KEY_PASSWORD: signed ? env[password] : "",
      APPLE_ID: signed && platform === "darwin" ? env.APPLE_ID : "",
      APPLE_APP_SPECIFIC_PASSWORD: signed && platform === "darwin" ? env.APPLE_APP_SPECIFIC_PASSWORD : "",
      APPLE_TEAM_ID: signed && platform === "darwin" ? env.APPLE_TEAM_ID : "",
    },
  };
}
module.exports = { signingConfiguration };
