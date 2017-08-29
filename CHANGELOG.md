# Changelog

## 0.3.0

  * Added a context menu for the file tree. Includes Select/Deselect All, Expand/Collapse All options, and Remove From Workspace.
  * Fixed a couple issues preventing PAK files from being created.
  * Fixed the importation step getting stuck when PAK files contain no MBINs.
  * Fixed the syntax coloring not switching to XML, after selecting a BIN file.
  * Added more logging, including when the app attempts to merge conflicting EXML files.

## 0.2.0

  * Added support for BIN files.
  * Fixed a bug excluding non-EXML files from from built PAK files.
  * Fixed a bug causing all the workspace files to be re-processed when adding files to the workspace.
  * Fixed the scroll range visibility in the file tree when several PAKs are expanded.
  * Improved the extraction and decompiling processes.
  * Addressed issues with the status not updating.
  * Made the file tree sidebar resizeable.
  * Updated MBINCompiler to the newest release.

## 0.1.1

  * Fixed an issue causing PSARC/MBINCompiler to not work when spaces are in the workspace path.

## 0.1.0

  * Initial release.