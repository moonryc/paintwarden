// Build-time opt-in: keep private repository resources hidden until releases are public.
export const releasesAvailable = import.meta.env.PUBLIC_RELEASES_AVAILABLE === "true";

export const repository = "https://github.com/moonryc/paintwarden";
export const releases = `${repository}/releases`;
export const koFi = "https://ko-fi.com/moonryc";

export const betaTesterGuide = `${repository}/blob/main/docs/beta-testers.md`;
export const privacyNetwork = `${repository}/blob/main/docs/privacy.md`;
export const securityReport = `${repository}/security/policy`;
