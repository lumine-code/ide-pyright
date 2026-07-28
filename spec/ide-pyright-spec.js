const fs = require("fs");
const { resolveServer } = require("../lib/server");
const main = require("../lib/main");

describe("ide-pyright server resolution", () => {
  it("prefers the configured path", async () => {
    const launch = await resolveServer(process.execPath);
    expect(launch.command).toBe(process.execPath);
    expect(launch.args).toEqual(["--stdio"]);
  });
  it("falls back to the bundled server module", async () => {
    const launch = await resolveServer("");
    expect(launch.command).toBe(process.execPath);
    expect(fs.existsSync(launch.args[0])).toBe(true);
    expect(launch.env.ELECTRON_RUN_AS_NODE).toBe("1");
  });
});

describe("ide-pyright adapter", () => {
  it("registers with the language-server service", async () => {
    let adapter;
    const disposable = main.consumeIdeClient({
      registerAdapter(registered) {
        adapter = registered;
        return { dispose() {} };
      },
    });
    expect(adapter.id).toBe("ide-pyright");
    expect(adapter.grammarScopes).toEqual(["source.python", "source.python.ipy"]);
    expect(adapter.settingsKeyPaths).toEqual(["ide-pyright"]);
    disposable.dispose();
  });
  it("maps editor settings into Pyright configuration sections", () => {
    let adapter;
    main.consumeIdeClient({
      registerAdapter(registered) {
        adapter = registered;
        return { dispose() {} };
      },
    });
    atom.config.set("ide-pyright.typeCheckingMode", "strict");
    const settings = adapter.getSettings();
    expect(settings.python.analysis.typeCheckingMode).toBe("strict");
    expect(adapter.getWorkspaceConfiguration("python.analysis").typeCheckingMode).toBe("strict");
  });
});
