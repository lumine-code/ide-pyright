const { resolveServer } = require("./server");

const analysisSettings = () => ({
  typeCheckingMode: atom.config.get("ide-pyright.typeCheckingMode"),
  diagnosticMode: atom.config.get("ide-pyright.diagnosticMode"),
});

const pythonSettings = () => ({
  pythonPath: atom.config.get("ide-pyright.pythonPath") || undefined,
  analysis: analysisSettings(),
});

module.exports = {
  consumeIdeClient(service) {
    return service.registerAdapter({
      id: "ide-pyright",
      displayName: "Pyright Language Server",
      // The IPython dialect is a superset of Python, so Pyright serves it too;
      // the client's scope table already maps it to the `python` identifier.
      grammarScopes: ["source.python", "source.python.ipy"],
      sessionScope: "project-root",
      settingsKeyPaths: ["ide-pyright"],
      async resolveServer(context) {
        const launch = await resolveServer(atom.config.get("ide-pyright.serverPath"));
        return { ...launch, cwd: context.rootPath, transport: "stdio" };
      },
      getSettings() {
        return { python: pythonSettings() };
      },
      getWorkspaceConfiguration(section) {
        if (section === "python") return pythonSettings();
        if (section === "python.analysis") return analysisSettings();
        return section ? atom.config.get(section) : { python: pythonSettings() };
      },
    });
  },
};
