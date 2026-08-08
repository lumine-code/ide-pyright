const fs = require("fs");
const os = require("os");
const path = require("path");
const { resolveServer } = require("../lib/server");
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
});

describe("ide-pyright adapter", () => {
  let adapter;
  let disposable;

  beforeEach(async () => {
    // Applies the configSchema, so the defaults the adapter reads are the ones
    // the manifest declares rather than undefined.
    await atom.packages.activatePackage("ide-pyright");
    ({ adapter, disposable } = register());
  });
  afterEach(async () => {
    disposable.dispose();
    await atom.packages.deactivatePackage("ide-pyright");
  });

  it("registers with the language-server service", () => {
    expect(adapter.id).toBe("ide-pyright");
    expect(adapter.grammarScopes).toEqual(["source.python", "source.python.ipy"]);
    expect(adapter.settingsKeyPaths).toEqual(["ide-pyright"]);
  });

  it("maps editor settings into Pyright configuration sections", () => {
    atom.config.set("ide-pyright.analysis.typeCheckingMode", "strict");
    atom.config.set("ide-pyright.analysis.extraPaths", ["src", "vendor"]);
    atom.config.set("ide-pyright.pythonPath", "/usr/bin/python3");

    const settings = adapter.getSettings();
    expect(settings.python.pythonPath).toBe("/usr/bin/python3");
    expect(settings.python.analysis.typeCheckingMode).toBe("strict");
    expect(settings.python.analysis.extraPaths).toEqual(["src", "vendor"]);
    // Pyright pulls both sections; they must agree with what was pushed.
    expect(adapter.getWorkspaceConfiguration("python.analysis").extraPaths).toEqual([
      "src",
      "vendor",
    ]);
    expect(adapter.getWorkspaceConfiguration("python").pythonPath).toBe("/usr/bin/python3");
  });

  it("omits an unset path rather than sending an empty one", () => {
    // Pyright merges what it is sent over pyrightconfig.json, so an empty
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

  it("offers a switch only for what Pyright advertises", () => {
    // Verified against the server's own initialize response, not its docs:
    // formatting, inlay hints, code lens and semantic tokens are Pylance
    // features that open-source Pyright does not have, and a switch for one
    // would be a control that does nothing.
    expect(Object.keys(configSchema.features.properties)).toEqual([
      "diagnostics",
      "autocomplete",
      "hover",
      "signature",
      "definition",
      "references",
      "symbols",
      "outline",
      "rename",
      "codeActions",
    ]);
  });

  it("defaults every feature on", () => {
    for (const [name, schema] of Object.entries(configSchema.features.properties))
      expect(`${name}: ${schema.default}`).toBe(`${name}: true`);
  });
});
