# ide-pyright

Pyright language-server adapter for Python.

Registers the Pyright language server with the bundled `ide-client` package, providing completions, type-checking diagnostics, navigation, and refactoring for Python projects.

## Features

- **Bundled server**: ships Pyright, no setup required.
- **Custom binary**: the Server Path setting points at any other Pyright `langserver` executable.
- **Interpreter selection**: the Python Path setting picks the interpreter used for analysis.
- **Analysis settings**: type-checking strictness and diagnostic scope map straight to Pyright configuration.
- **Project sessions**: one server per project root, started lazily with the first Python editor.

## Installation

To install `ide-pyright` search for _ide-pyright_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/ide-pyright`.

## Services

- **[ide-client](https://lumine-code.github.io/docs.html#services/ide-client)** (`^1.0.0`): consumed to register the Pyright adapter with the editor's language-server client.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
