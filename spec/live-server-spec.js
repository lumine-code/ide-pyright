const fs = require("fs");
const os = require("os");
const path = require("path");
const main = require("../lib/main");
const { LiveLspClient, fileUri } = require("./helpers/live-lsp-client");

describe("ide-pyright bundled server", () => {
  let adapter, client, disposable, rootPath;
  let originalTimeout;

  beforeEach(async () => {
    jasmine.useRealClock();
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
    rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "ide-pyright-live-"));
    await lumine.packages.activatePackage("ide-pyright");
    disposable = main.consumeIdeClient({
      registerAdapter(registered) {
        adapter = registered;
        return { dispose() {} };
      },
    });
    client = new LiveLspClient(adapter, rootPath);
  });

  afterEach(async () => {
    await client.stop();
    disposable.dispose();
    await lumine.packages.deactivatePackage("ide-pyright");
    fs.rmSync(rootPath, { recursive: true, force: true });
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  it("advertises and serves Basedpyright's complete shared IDE surface", async () => {
    const { capabilities, serverInfo } = await client.start();
    expect(serverInfo.name).toBe("basedpyright");
    expect(capabilities.notebookDocumentSync.notebookSelector[0].cells).toEqual([
      { language: "python" },
    ]);
    expect(capabilities.callHierarchyProvider).toBe(true);
    expect(capabilities.inlayHintProvider).toBe(true);
    expect(capabilities.semanticTokensProvider.full).toBe(true);
    expect(capabilities.documentOnTypeFormattingProvider.firstTriggerCharacter).toBe("{");

    const uri = fileUri(path.join(rootPath, "example.py"));
    client.open(uri, 'answer: int = "wrong"\nanswer.bi');
    const diagnostics = await client.waitFor(
      () =>
        client
          .messages("textDocument/publishDiagnostics")
          .find(({ params }) => params.diagnostics.some(({ message }) => /assign/i.test(message)))
          ?.params.diagnostics,
      "assignment diagnostic",
    );
    expect(diagnostics.some(({ message }) => /assign/i.test(message))).toBe(true);

    const completion = await client.request("textDocument/completion", {
      textDocument: { uri },
      position: { line: 1, character: 9 },
    });
    const items = Array.isArray(completion) ? completion : completion.items;
    expect(items.map(({ label }) => label)).toContain("bit_count");
  });
});
