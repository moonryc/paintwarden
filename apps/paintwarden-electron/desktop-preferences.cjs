const { randomBytes } = require("node:crypto");
const { readFile, writeFile, rename, rm } = require("node:fs/promises");
const { supportedLanguages, t } = require("./desktop-i18n.cjs");
const { parsedChoice } = require("./desktop-core.cjs");

function parsedPhoneAccess(value) {
  return {
    enabled: value?.enabled === true,
    port: Number.isInteger(value?.port) && value.port > 0 && value.port <= 65535 ? value.port : 48177,
  };
}

// Serialize read/modify/write operations so changing servers and language concurrently
// cannot overwrite the other preference. The file remains separate from vault backups.
function createPreferences(file, defaultLanguage = "en") {
  let pending = Promise.resolve();
  async function read() {
    try {
      const value = JSON.parse(await readFile(file, "utf8"));
      return {
        ...parsedChoice(value),
        ...(value.phoneAccess ? { phoneAccess: parsedPhoneAccess(value.phoneAccess) } : {}),
        language: supportedLanguages.includes(value.language) ? value.language : defaultLanguage,
      };
    } catch {
      return { mode: null, language: defaultLanguage };
    }
  }
  function update(change) {
    const operation = pending.then(async () => {
      const merged = { ...(await read()), ...change };
      const next = {
        ...parsedChoice(merged),
        language: merged.language,
        ...(merged.phoneAccess ? { phoneAccess: parsedPhoneAccess(merged.phoneAccess) } : {}),
      };
      const temporary = `${file}.${randomBytes(8).toString("hex")}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
        await rename(temporary, file);
      } catch (error) {
        await rm(temporary, { force: true });
        throw error;
      }
      return next;
    });
    pending = operation.catch(() => undefined);
    return operation;
  }
  return {
    read,
    setPhoneAccess: (value) => update({ phoneAccess: parsedPhoneAccess(value) }),
    setConnection: (choice) => update(parsedChoice(choice)),
    setLanguage: (language) => {
      if (!supportedLanguages.includes(language))
        return Promise.reject(new Error(t("errors.invalidLanguage")));
      return update({ language });
    },
  };
}
module.exports = { createPreferences };
