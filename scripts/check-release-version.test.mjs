import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { checkReleaseVersion } from "./check-release-version.mjs";

// Keep the expected release surface independent of the discovery implementation.
const directories = [
  "",
  "apps/paint-vault",
  "apps/paint-vault-web",
  "apps/paint-vault-site",
  "apps/paint-vault-electron",
  "packages/paint-core",
  "packages/paint-i18n",
  "packages/vault-ui",
];
const manifests = directories.map((directory) => (directory ? `${directory}/package.json` : "package.json"));
const version = "1.2.3";
function fixture() {
  return {
    ...Object.fromEntries(manifests.map((file) => [file, { version }])),
    "package.json": {
      version,
      workspaces: [
        "apps/paint-vault",
        "apps/paint-vault-web",
        "apps/paint-vault-site",
        "apps/paint-vault-electron",
        "packages/*",
      ],
    },
    "package-lock.json": {
      version,
      packages: Object.fromEntries(directories.map((directory) => [directory, { version }])),
    },
  };
}
function check(files, tag = `v${version}`) {
  return checkReleaseVersion(
    tag,
    (file) => {
      if (!Object.hasOwn(files, file)) throw new Error("fixture file missing");
      return files[file];
    },
    (pattern) => manifests.filter((file) => path.matchesGlob(file, `${pattern}/package.json`)),
  );
}

for (const tag of ["v1.2.3", "1.2.3", "v0.0.0", "v12.34.56"]) {
  test(`accepts matching release tag ${tag}`, () => {
    const files = fixture();
    const expected = tag.replace(/^v/, "");
    for (const manifest of manifests) files[manifest].version = expected;
    files["package-lock.json"].version = expected;
    for (const entry of Object.values(files["package-lock.json"].packages)) entry.version = expected;
    assert.deepEqual(check(files, tag), { expected, errors: [] });
  });
}
for (const tag of [
  "",
  "v1.2",
  "v1.2.3.4",
  "vv1.2.3",
  "V1.2.3",
  "v1.2.3-beta.1",
  "v1.2.3+build",
  " v1.2.3",
  "v1.2.3\n",
]) {
  test(`rejects invalid tag ${JSON.stringify(tag)} without reading files`, () => {
    const result = checkReleaseVersion(tag, () => assert.fail("invalid tags must not read files"));
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Release tags look like/);
  });
}
for (const file of manifests) {
  for (const mutation of ["drift", "missing version", "missing file"]) {
    test(`rejects ${file}: ${mutation}`, () => {
      const files = fixture();
      if (mutation === "drift") files[file].version = "9.9.9";
      if (mutation === "missing version") delete files[file].version;
      if (mutation === "missing file") delete files[file];
      assert.ok(check(files).errors.some((error) => error.startsWith(`${file} version is `)));
    });
  }
}
for (const mutation of ["drift", "missing"]) {
  test(`rejects lockfile top-level version: ${mutation}`, () => {
    const files = fixture();
    if (mutation === "drift") files["package-lock.json"].version = "9.9.9";
    else delete files["package-lock.json"].version;
    assert.equal(check(files).errors.length, 1);
    assert.match(check(files).errors[0], /^package-lock.json version is /);
  });
}
for (const directory of directories) {
  for (const mutation of ["drift", "missing version", "missing entry"]) {
    test(`rejects lockfile packages[${JSON.stringify(directory)}]: ${mutation}`, () => {
      const files = fixture();
      const entries = files["package-lock.json"].packages;
      if (mutation === "drift") entries[directory].version = "9.9.9";
      if (mutation === "missing version") delete entries[directory].version;
      if (mutation === "missing entry") delete entries[directory];
      const { errors } = check(files);
      assert.equal(errors.length, 1);
      assert.ok(errors[0].startsWith(`package-lock.json packages[${JSON.stringify(directory)}] version is `));
    });
  }
}
test("rejects missing lockfile and missing packages map", () => {
  const files = fixture();
  delete files["package-lock.json"].packages;
  assert.equal(check(files).errors.length, directories.length);
  delete files["package-lock.json"];
  assert.ok(check(files).errors.some((error) => error.startsWith("Cannot read package-lock.json:")));
});
test("reports malformed JSON as a readable validation failure", () => {
  const result = checkReleaseVersion("v1.2.3", () => JSON.parse("{"));
  assert.ok(result.errors.some((error) => error.startsWith("Cannot read package.json:")));
});
test("reports multiple version mismatches together", () => {
  const files = fixture();
  for (const manifest of manifests) files[manifest].version = "9.9.9";
  assert.equal(check(files).errors.length, directories.length);
});

function cli(t, { tag, envTag, mutate = () => {} } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "paint-vault-release-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "scripts"));
  copyFileSync(
    new URL("./check-release-version.mjs", import.meta.url),
    path.join(root, "scripts/check-release-version.mjs"),
  );
  const files = fixture();
  mutate(files);
  for (const [file, contents] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), JSON.stringify(contents));
  }
  const env = { ...process.env };
  delete env.GITHUB_REF_NAME;
  if (envTag !== undefined) env.GITHUB_REF_NAME = envTag;
  return spawnSync(
    process.execPath,
    [path.join(root, "scripts/check-release-version.mjs"), ...(tag === undefined ? [] : [tag])],
    {
      cwd: tmpdir(), // Resolve fixtures relative to the script, not the caller's directory.
      env,
      encoding: "utf8",
    },
  );
}
for (const options of [{ tag: "v1.2.3" }, { envTag: "v1.2.3" }, { tag: "v1.2.3", envTag: "invalid" }]) {
  test(`CLI succeeds: ${JSON.stringify(options)}`, (t) => {
    const result = cli(t, options);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /All root\/workspace packages and root lockfile versions are at 1\.2\.3/);
    assert.equal(result.stderr, "");
  });
}
for (const options of [{}, { tag: "invalid" }, { envTag: "invalid" }, { tag: "invalid", envTag: "v1.2.3" }]) {
  test(`CLI fails invalid/missing tag: ${JSON.stringify(options)}`, (t) => {
    const result = cli(t, options);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Release tags look like/);
    assert.equal(result.stdout, "");
  });
}
test("CLI fails version drift without printing success", (t) => {
  const result = cli(t, {
    tag: "v1.2.3",
    mutate: (files) => {
      files["package-lock.json"].packages["packages/vault-ui"].version = "9.9.9";
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /packages\["packages\/vault-ui"\] version is 9\.9\.9/);
  assert.equal(result.stdout, "");
});

for (const directory of directories.slice(1)) {
  for (const target of ["manifest", "lock entry"]) {
    test(`CLI discovers and rejects ${directory} ${target} version drift`, (t) => {
      const result = cli(t, {
        tag: `v${version}`,
        mutate: (files) => {
          const entry =
            target === "manifest"
              ? files[`${directory}/package.json`]
              : files["package-lock.json"].packages[directory];
          entry.version = "9.9.9";
        },
      });
      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes(directory), result.stderr);
      assert.match(result.stderr, /version is 9\.9\.9/);
      assert.equal(result.stdout, "");
    });
  }
}

for (const directory of ["packages/future-workspace", "tools/future-workspace"]) {
  for (const mutation of ["none", "manifest drift", "lock drift", "missing lock entry"]) {
    test(`CLI discovers future workspace ${directory}: ${mutation}`, (t) => {
      const result = cli(t, {
        tag: `v${version}`,
        mutate: (files) => {
          // packages/* already covers the new package; a new explicit declaration
          // must work too, without updating the checker or its fixture directory list.
          if (directory.startsWith("tools/")) files["package.json"].workspaces.push(directory);
          files[`${directory}/package.json`] = {
            version: mutation === "manifest drift" ? "9.9.9" : version,
          };
          if (mutation !== "missing lock entry") {
            files["package-lock.json"].packages[directory] = {
              version: mutation === "lock drift" ? "9.9.9" : version,
            };
          }
        },
      });
      assert.equal(result.status, mutation === "none" ? 0 : 1, result.stderr);
      if (mutation === "none") {
        assert.equal(result.stderr, "");
      } else {
        assert.ok(result.stderr.includes(directory), result.stderr);
        assert.match(result.stderr, /version is (9\.9\.9|missing)/);
        assert.equal(result.stdout, "");
      }
    });
  }
}

test("supports object-form workspace declarations and overlapping patterns", (t) => {
  const result = cli(t, {
    tag: `v${version}`,
    mutate: (files) => {
      files["package.json"].workspaces = {
        packages: [...files["package.json"].workspaces, "packages/paint-i18n"],
      };
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
});

test("reports an overlapping workspace only once", () => {
  const files = fixture();
  files["package.json"].workspaces.push("packages/paint-i18n");
  files["packages/paint-i18n/package.json"].version = "9.9.9";
  assert.equal(check(files).errors.length, 1);
});

for (const workspaces of [undefined, "packages/*", {}, [42], [""]]) {
  test(`rejects invalid workspace declarations: ${JSON.stringify(workspaces)}`, () => {
    const files = fixture();
    files["package.json"].workspaces = workspaces;
    assert.ok(check(files).errors.some((error) => error.startsWith("package.json workspaces must")));
  });
}

test("CLI fails closed if a declared workspace pattern matches no manifests", (t) => {
  const result = cli(t, {
    tag: `v${version}`,
    mutate: (files) => files["package.json"].workspaces.push("tools/missing"),
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No workspace package.json matches "tools\/missing"/);
  assert.equal(result.stdout, "");
});

test("reports workspace discovery failures as readable validation failures", () => {
  const files = fixture();
  const result = checkReleaseVersion(
    `v${version}`,
    (file) => files[file],
    () => {
      throw new Error("cannot list directory");
    },
  );
  assert.ok(result.errors.some((error) => /Cannot discover workspaces.*cannot list directory/.test(error)));
});
