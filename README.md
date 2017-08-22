# NMS Development Environment

This app provides an easy way for people to create mods for No Man's Sky.

![screenshot](https://github.com/jaszhix/nmsde/raw/master/screenshot.png)

## Features

  * Select game PAK files, and the app extracts the PAKs with PSARC, and decompiles MBINs with MBINCompiler automatically.
  * Select which files you want to rebuild into a pak file, and the app will compile and compress automatically.
  * **Experimental** merge conflict reconciliation is attempted when building pak files with conflicting EXMLs.
  * View the decompiled EXML files in a tree view showing which pak file they originated from.
  * Robust code editor built in using Monaco.