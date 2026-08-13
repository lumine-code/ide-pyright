const fs = require("fs");
const os = require("os");
const path = require("path");
const { resolveServer, managedServer } = require("../lib/server");
const main = require("../lib/main");

const register = () => {
  let adapter;
  const service = {
    registerAdapter(registered) {
      adapter = registered;
      return { dispose() {} };
    },
    getSessions: () => [],
    restart: async () => {},
  };
  const disposable = main.consumeIdeClient(service);
  return { adapter, disposable };
};

describe("ide-pyright server resolution", () => {
  it("prefers the configured path", async () => {
    const launch = await resolveServer(process.execPath);
    expect(launch.command).toBe(process.execPath);
    expect(launch.args[0]).toBe("--stdio");
    expect(launch.args[1]).toMatch(/^--cancellationReceive=file:[0-9a-f]{42}$/);
    expect(launch.fileCancellationFolder).toBe(
      path.join(os.tmpdir(), "python-languageserver-cancellation", launch.args[1].split(":")[1]),
    );
  });
  it("falls back to the bundled server module", async () => {
    const launch = await resolveServer("");
    expect(launch.command).toBe(process.execPath);
    expect(fs.existsSync(launch.args[0])).toBe(true);
    expect(launch.args[2]).toMatch(/^--cancellationReceive=file:[0-9a-f]{42}$/);
    expect(launch.env.ELECTRON_RUN_AS_NODE).toBe("1");
  });

  it("gives concurrent servers separate cancellation channels", async () => {
    const [first, second] = await Promise.all([resolveServer(""), resolveServer("")]);
    expect(first.fileCancellationFolder).not.toBe(second.fileCancellationFolder);
  });

  it("launches a managed copy the same way as the bundled one", async () => {
    const managed = { modulePath: "/managed/pyright/langserver.index.js", version: "1.1.999" };
    const launch = await resolveServer("", managed);
    expect(launch.command).toBe(process.execPath);
    expect(launch.args[0]).toBe(managed.modulePath);
    expect(launch.env.ELECTRON_RUN_AS_NODE).toBe("1");
    expect(launch.version).toBe("1.1.999");
  });

  it("returns to the server this package ships once the managed copy is gone", async () => {
    // Uninstalling is safe precisely because this floor is always there.
    const launch = await resolveServer("", null);
    expect(fs.existsSync(launch.args[0])).toBe(true);
    expect(launch.version).toBeUndefined();
  });

  it("declares the bundled floor so uninstall is offered as a fallback", () => {
    expect(managedServer.source).toBe("npm");
    expect(managedServer.bundled).toBe(true);
    expect(managedServer.packages).toEqual(["basedpyright"]);
  });
});

describe("ide-pyright adapter", () => {
  let adapter;
  let disposable;

  beforeEach(async () => {
    // Applies the configSchema, so the defaults the adapter reads are the ones
    // the manifest declares rather than undefined.
    await lumine.packages.activatePackage("ide-pyright");
    ({ adapter, disposable } = register());
  });
  afterEach(async () => {
    disposable.dispose();
    await lumine.packages.deactivatePackage("ide-pyright");
  });

  it("registers with the language-server service", () => {
    expect(adapter.id).toBe("ide-pyright");
    expect(adapter.grammarScopes).toEqual(["source.python", "source.python.ipy"]);
    expect(adapter.settingsKeyPaths).toEqual(["ide-pyright"]);
  });

  it("maps editor settings into the server's configuration sections", () => {
    lumine.config.set("ide-pyright.analysis.typeCheckingMode", "strict");
    lumine.config.set("ide-pyright.analysis.extraPaths", ["src", "vendor"]);
    lumine.config.set("ide-pyright.pythonPath", "/usr/bin/python3");

    const settings = adapter.getSettings();
    expect(settings.python.pythonPath).toBe("/usr/bin/python3");
    expect(settings.python.analysis.typeCheckingMode).toBe("strict");
    expect(settings.python.analysis.extraPaths).toEqual(["src", "vendor"]);
    // The server pulls both spellings of both sections; every answer must
    // agree with what was pushed.
    expect(adapter.getWorkspaceConfiguration("python.analysis").extraPaths).toEqual([
      "src",
      "vendor",
    ]);
    expect(adapter.getWorkspaceConfiguration("python").pythonPath).toBe("/usr/bin/python3");
    expect(adapter.getWorkspaceConfiguration("basedpyright").pythonPath).toBe("/usr/bin/python3");
    expect(adapter.getWorkspaceConfiguration("basedpyright.analysis").extraPaths).toEqual([
      "src",
      "vendor",
    ]);
  });

  it("omits an unset path rather than sending an empty one", () => {
    // Basedpyright merges what it is sent over pyrightconfig.json, so an empty
    // string or list would silently win over the project's own configuration.
    const { python } = adapter.getSettings();
    expect("pythonPath" in python).toBe(true);
    expect(python.pythonPath).toBeUndefined();
    expect(python.venvPath).toBeUndefined();
    expect(python.analysis.stubPath).toBeUndefined();
    expect(python.analysis.extraPaths).toBeUndefined();
    expect(python.analysis.include).toBeUndefined();
    // Booleans have no empty state, so they are always sent.
    expect(python.analysis.useLibraryCodeForTypes).toBe(true);
  });
});

describe("ide-pyright features", () => {
  const { configSchema } = require("../package.json");

  it("offers a switch only for what Basedpyright advertises", () => {
    // Verified against the server's own initialize response, not its docs:
    // Basedpyright 1.39.9 adds call hierarchy, inlay hints and semantic tokens
    // over open-source Pyright, and still has no formatter, code lens, or type
    // hierarchy — a switch for one of those would be a control that does
    // nothing.
    expect(Object.keys(configSchema.features.properties)).toEqual([
      "diagnostics",
      "autocomplete",
      "hover",
      "signature",
      "definition",
      "references",
      "callHierarchy",
      "symbols",
      "outline",
      "rename",
      "codeActions",
      "inlayHints",
      "semanticTokens",
    ]);
  });

  it("defaults every feature on", () => {
    for (const [name, schema] of Object.entries(configSchema.features.properties))
      expect(`${name}: ${schema.default}`).toBe(`${name}: true`);
  });
});
