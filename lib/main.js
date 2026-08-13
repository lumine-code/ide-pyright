const { CompositeDisposable } = require("lumine");
const { resolveServer, managedServer } = require("./server");

const setting = (key) => lumine.config.get(`ide-pyright.${key}`);

// An empty setting means "no opinion", not "the empty value": Basedpyright
// merges what it is sent over what a `pyrightconfig.json` says, so sending ""
// as a stub path or [] as an include list would silently win over the
// project's own configuration. Booleans have no empty state and are always
// sent.
const text = (key) => setting(key) || undefined;
const list = (key) => {
  const value = setting(key);
  return value?.length ? value : undefined;
};

const analysisSettings = () => ({
  typeCheckingMode: setting("analysis.typeCheckingMode"),
  diagnosticMode: setting("analysis.diagnosticMode"),
  extraPaths: list("analysis.extraPaths"),
  stubPath: text("analysis.stubPath"),
  typeshedPaths: list("analysis.typeshedPaths"),
  include: list("analysis.include"),
  exclude: list("analysis.exclude"),
  ignore: list("analysis.ignore"),
  autoSearchPaths: setting("analysis.autoSearchPaths"),
  useLibraryCodeForTypes: setting("analysis.useLibraryCodeForTypes"),
  autoImportCompletions: setting("analysis.autoImportCompletions"),
  logLevel: setting("analysis.logLevel"),
});

const pythonSettings = () => ({
  pythonPath: text("pythonPath"),
  venvPath: text("venvPath"),
  analysis: analysisSettings(),
});

module.exports = {
  consumeIdeClient(service) {
    const adapter = {
      id: "ide-pyright",
      displayName: "Basedpyright Language Server",
      // The IPython dialect is a superset of Python, so the server serves it
      // too; the client's scope table already maps it to `python`.
      grammarScopes: ["source.python", "source.python.ipy"],
      sessionScope: "project-root",
      settingsKeyPaths: ["ide-pyright"],
      managedServer,
      async resolveServer(context) {
        const launch = await resolveServer(setting("serverPath"), context.managedServer);
        return { ...launch, cwd: context.rootPath, transport: "stdio" };
      },
      getSettings() {
        return { python: pythonSettings() };
      },
      // Basedpyright asks for both spellings; the answers are the same
      // objects, since its settings are a superset of Pyright's.
      getWorkspaceConfiguration(section) {
        if (section === "python" || section === "basedpyright") return pythonSettings();
        if (section === "python.analysis" || section === "basedpyright.analysis")
          return analysisSettings();
        return section ? lumine.config.get(section) : { python: pythonSettings() };
      },
    };

    const subscriptions = new CompositeDisposable(service.registerAdapter(adapter));
    // Everything else reaches a running server through didChangeConfiguration;
    // which executable is running is settled when it starts.
    subscriptions.add(
      lumine.config.onDidChange("ide-pyright.serverPath", () => {
        for (const session of service.getSessions()) {
          if (session.adapter !== adapter || ["stopping", "stopped"].includes(session.state))
            continue;
          service.restart(session).catch((error) => {
            lumine.notifications.addError("Unable to restart Basedpyright Language Server", {
              detail: error.message,
              dismissable: true,
            });
          });
        }
      }),
    );
    return subscriptions;
  },
};
