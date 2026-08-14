# ide-pyright

Basedpyright language-server adapter for Python.

Registers the Basedpyright language server — the maintained Pyright fork with the language-server features Pylance withholds — with the bundled `ide-client` package, providing completions, type-checking diagnostics, navigation, inlay hints, semantic highlighting, and refactoring for Python projects. The package keeps its historical `ide-pyright` name; Basedpyright is a drop-in Pyright and reads the same `pyrightconfig.json`.

## Features

- **Bundled server**: ships Basedpyright, no setup required.
- **Managed upgrade**: installs a newer Basedpyright from npm when you want one, and removing it returns to the bundled copy.
- **Python and IPython**: serves the Python grammar and its IPython dialect.
- **Notebook support**: speaks LSP notebook sync, so with jupyter-view it analyzes Jupyter notebook cells with cross-cell context.
- **Custom binary**: the Server Path setting points at any other Basedpyright `langserver` executable.
- **Interpreter selection**: the Python Path and Virtual Environment Path settings pick the interpreter used for analysis.
- **Import resolution**: extra search paths, a stub directory, and a typeshed override reach source layouts Basedpyright cannot infer.
- **Analysis settings**: type-checking strictness, diagnostic scope, and the include, exclude, and ignore lists map straight to Basedpyright configuration.
- **Feature switches**: any of the thirteen capabilities Basedpyright serves can be turned off, which hands it to another Python server on the same file.
- **Project sessions**: one server per project root, started lazily with the first Python editor.

## Installation

To install `ide-pyright` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/ide-pyright`.

## Services

- `ide-client`: consumed to register the Basedpyright adapter with the editor's language-server client.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
