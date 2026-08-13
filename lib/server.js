const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");

// Where the editor can fetch a newer Basedpyright than the one this package
// pins.
//
// Unlike the Rust servers, this is an *upgrade tier* rather than the only way
// to get one: the `basedpyright` dependency below is always present, so
// uninstalling drops back to it and can never leave the user with nothing.
// What it buys is independence from this package's release cadence —
// Basedpyright tracks Pyright's roughly weekly releases, and a repin is
// otherwise the only way to follow it.
//
// `basedpyright` declares no required runtime dependency (only an optional
// `fsevents`, whose absence it reports and works around), so extracting the
// published tarball is the whole install.
exports.managedServer = {
  source: "npm",
  displayName: "Basedpyright",
  packages: ["basedpyright"],
  module: "node_modules/basedpyright/dist/pyright-langserver.js",
  bundled: true,
};

exports.resolveServer = async (configuredPath, managed = null) => {
  // The server enables its worker-thread analyzer only when its file-based
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

  // A copy the user asked the editor to install wins over the pinned one; both
  // are launched the same way. The entry resolves everything relative to its
  // own `__dirname`, so it runs from either location unchanged.
  //
  // The exact server dependency ships with this package. Invoking its module
  // through the editor's Node executable avoids platform-specific .bin shims.
  const serverModule =
    managed?.modulePath || require.resolve("basedpyright/dist/pyright-langserver.js");
  return {
    command: process.execPath,
    args: [serverModule, "--stdio", cancellationArgument],
    env: { ELECTRON_RUN_AS_NODE: "1" },
    fileCancellationFolder,
    version: managed?.version,
  };
};
