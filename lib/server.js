const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");

exports.resolveServer = async (configuredPath) => {
  // Pyright enables its worker-thread analyzer only when its file-based
  // cancellation channel is configured. A unique directory also keeps request
  // markers isolated when several projects have a server open at once.
  const cancellationName = crypto.randomBytes(21).toString("hex");
  const cancellationArgument = `--cancellationReceive=file:${cancellationName}`;
  const fileCancellationFolder = path.join(
    os.tmpdir(),
    "python-languageserver-cancellation",
    cancellationName,
  );

  if (configuredPath) {
    await fs.promises.access(configuredPath, fs.constants.X_OK);
    return {
      command: configuredPath,
      args: ["--stdio", cancellationArgument],
      fileCancellationFolder,
    };
  }

  // The exact server dependency ships with this package. Invoking its module
  // through the editor's Node executable avoids platform-specific .bin shims.
  const serverModule = require.resolve("pyright/langserver.index.js");
  return {
    command: process.execPath,
    args: [serverModule, "--stdio", cancellationArgument],
    env: { ELECTRON_RUN_AS_NODE: "1" },
    fileCancellationFolder,
  };
};
