import {remote} from 'electron';
import {execSync, exec} from 'child_process';
import fs from 'graceful-fs';
import fse from 'fs-extra';
import path from 'path';
import _ from 'lodash';
import xml2js from 'xml2js';
import log from './log';
import each from './each';
import state from './state';
import editorValue from './editor';
import status from './status';

export const S = process.platform === 'win32' ? '\\' : '/';
export const dataDir = remote.app.getPath('userData');
export const workDir = `${dataDir}${S}work`;

log.init(dataDir);
export const _log = log;

export function whichToShow ({outerHeight, itemHeight, scrollTop}) {
  let start = Math.floor(scrollTop / itemHeight);
  let heightOffset = scrollTop % itemHeight;
  let length = Math.ceil((outerHeight + heightOffset) / itemHeight);

  return {
    start: start,
    length: length,
  }
}

export const formatBytes = (bytes, decimals)=>{
  if (bytes === 0) {
    return '0 Byte';
  }
  let k = 1000;
  let dm = decimals + 1 || 3;
  let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toPrecision(dm) + ' ' + sizes[i];
};

export const getPercent = (v1, v2) => ((v1 / v2) * 100).toFixed(0);

export const walk = (dir, done)=>{
  let results = [];
  fs.readdir(dir, (err, list)=>{
    if (err) {
      return done(err);
    }
    let pending = list.length;
    if (!pending) {
      return done(null, results);
    }
    each(list, (file)=>{
      file = path.resolve(dir, file);
      fs.stat(file, (err, stat)=>{
        if (stat && stat.isDirectory()) {
          walk(file, (err, res)=>{
            results = results.concat(res);
            if (!--pending) {
              done(null, results);
            }
          });
        } else {
          results.push(file);
          if (!--pending) {
            done(null, results);
          }
        }
      });
    });
  });
};

export const exc = (cmd, cb)=>{
  if (!cb) {
    execSync(cmd);
  } else {
    let opts = {
      encoding: 'utf8',
      timeout: 0,
      maxBuffer: 200*1024,
      killSignal: 'SIGTERM',
      cwd: null,
      env: null
    };
    if (process.platform === 'win32') {
      opts.shell = 'powershell.exe';
    } else {
      opts.shell = '/bin/sh';
    }
    exec(cmd, cb)
  }

};

export const errorDialog = (string) => {
  remote.dialog.showErrorBox('NMSDE Error', string);
};

export const init = (projectPath = workDir) => {
  if (!fs.existsSync(projectPath)) {
    try {
      fs.mkdirSync(projectPath);
    } catch (e) {
      log.error(`Could not create project directory: ${e}`);
    }
  }
  const mbinDir = `${projectPath}${S}MBINs`;
  const exmlDir = `${projectPath}${S}EXMLs`;
  if (!fs.existsSync(mbinDir)) {
    fs.mkdirSync(mbinDir);
  }
  if (!fs.existsSync(exmlDir)) {
    fs.mkdirSync(exmlDir);
  }
};

export const getSelected = (exmlFiles = []) => {
  let selected = [];
  each(exmlFiles, (pak)=>{
    if (pak.selected) {
      selected = _.concat(selected, pak.exmls);
    } else {
      each(pak.exmls, (exml)=>{
        if (exml.selected) {
          selected.push(exml);
        }
      });
    }
  });
  return selected;
}

const decompileMBINFiles = (mbinDir, exmlDir) => {
  walk(mbinDir, (err, files)=>{
    const _files = _.filter(files, (file)=>{
      let extension = _.last(file.split('.'));
      return extension.toLowerCase() === 'mbin';
    });
    const _filesLength = _files.length;
    const shouldUseSync = _filesLength > 4000;
    each(_files, (file, i)=>{
      let percentage = `${getPercent(i + 1, _filesLength)}%`;
      let success = `${percentage} Decompiled ${file}`;
      let fail = `${percentage} Failed to decompile ${file}`;
      try {
        let exmlPath = file.replace(/[.]MBIN/g, '.exml').replace(/MBINs/g, 'EXMLs');
        let exmlDir = exmlPath.split(_.last(exmlPath.split(S)))[0];
        fse.ensureDirSync(exmlDir);
        let command = `.\\bin\\MBINCompiler.exe ${file} ${exmlPath}`;
        if (shouldUseSync) {
          exc(command);
          status.set(success);
        } else {
          exc(command, (err, stdout, stderr)=>{
            if (err) {
              status.set(fail);
            } else {
              status.set(success);
            }
          });
        }
      } catch (e) {
        status.set(fail);
      }
    });
  });
};

const extractPakFiles = (workDir, mbinDir, exmlDir) => {
  fs.readdir(workDir, (err, files)=>{
    const _files = _.filter(files, (file)=>{
      let extension = _.last(file.split('.'));
      return extension.toLowerCase() === 'pak';
    });
    const _filesLength = _files.length;
    each(_files, (file, i)=>{
      const fileDir = `${mbinDir}${S}_${file}`
        .replace(/[.]pak/g, '');
      const pakPath = `${workDir}${S}${file}`;
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir);
      }
      if (fs.existsSync(pakPath)) {
        exc(`.\\bin\\psarc.exe extract -y --input=${pakPath} --to=${fileDir}`);
      }
      status.set(`${getPercent(i + 1, _filesLength)}% Extracted ${pakPath}`);
    });
    status.set('Decompiling MBINs, please wait...');
    decompileMBINFiles(mbinDir, exmlDir);
  });
};

export const copyPakFiles = (pakFiles) => {
  const s = state.get();
  const mbinDir = `${s.workDir}${S}MBINs`;
  const exmlDir = `${s.workDir}${S}EXMLs`;
  status.set('Importing PAK files');
  each(pakFiles, (pakFile)=>{
    const file = _.last(pakFile.split(S));
    fse.copySync(pakFile, `${s.workDir}${S}${file.replace(/\s/g, '.')}`);
  });
  status.set('Extracting PAK files, please wait...');
  extractPakFiles(s.workDir, mbinDir, exmlDir);
};
window.copyPakFiles = copyPakFiles;

export const clearWorkSpace = () => {
  const s = state.get();
  status.set('Clearing workspace, please wait...');
  fse.emptyDir(s.workDir, (err)=>{
    if (err) {
      log.error(err);
    }
    init(s.workDir);
    state.set({exmlFiles: []});
    editorValue.set('');
    status.set('Finished clearing the workspace');
  });
};
window.clearWorkSpace = clearWorkSpace;

const buildPAKFile = (psarcList, stagingDir, workDir) => {
  status.set('Building PAK file')
  exc(`.${S}bin${S}_psarc.exe ${psarcList.join(' ')}`);
  walk(stagingDir, (err, files)=>{
    if (err) {
      log.error(err);
    }
    const _files = _.filter(files, (file)=>{
      let extension = _.last(file.split('.'));
      return extension.toLowerCase() === 'pak';
    });
    if (_files.length > 0) {
      let destination = `${workDir}${S}NMSDE-${Date.now()}.pak`;
      fse.moveSync(_files[0], destination);
      status.set(`PAK file successfully created at ${destination}`);
    } else {
      status.set('PAK file failed to build.');
    }
  });
};

const compileMBINFiles = (workDir, stagingDir) => {
  walk(stagingDir, (err, files)=>{
    if (err) {
      log.error(err);
    }
    const _files = _.filter(files, (file)=>{
      let extension = _.last(file.split('.'));
      return extension.toLowerCase() === 'exml';
    });
    const _filesLength = _files.length;
    const psarcList = [];
    each(_files, (file, i)=>{
      let percentage = `${getPercent(i + 1, _filesLength)}%`;
      let success = `${percentage} Compiled ${file}`;
      let fail = `${percentage} Failed to compile ${file}`;
      try {
        let mbinPath = file.replace(/[.]exml/g, '.MBIN');
        let command = `.\\bin\\MBINCompiler.exe ${file} ${mbinPath}`;

        exc(command);
        psarcList.push(mbinPath);
        status.set(success);
      } catch (e) {
        status.set(fail);
      }
    });
    buildPAKFile(psarcList, stagingDir, workDir);
  });
};

const rebuildXMLFiles = (selectedFiles) => {
  const s = state.get();
  const stagingDir = `${s.workDir}${S}staging`;
  if (!fs.existsSync(stagingDir)) {
    fs.mkdirSync(stagingDir);
  } else {
    fse.removeSync(stagingDir);
    fs.mkdirSync(stagingDir);
  }
  const builder = new xml2js.Builder();
  each(selectedFiles, (file)=>{
    const xml = builder.buildObject(file.xmlObject);
    const stagingPath = `${stagingDir}${S}${file.pakPath}`;//file.path.replace(/EXMLs/g, 'staging');
    const ensurePath = stagingPath.split(_.last(stagingPath.split(S)))[0];
    fse.ensureDirSync(ensurePath);
    fs.writeFileSync(stagingPath, xml, {flag: 'w', encoding: 'utf8'});
    status.set(`Rebuilt XML file ${stagingDir}`)
  });
  status.set('Compiling MBIN files, please wait...');
  compileMBINFiles(s.workDir, stagingDir);
};

const checkAndMerge = (selectedFiles, conflicts, conflictPaths) => {
  const next = () => {
    status.set('Rebuilding and staging XML files, please wait...')
    rebuildXMLFiles(selectedFiles);
  };
  if (conflictPaths.length > 0) {
    // Merge
    each(conflicts, (value, key)=>{
      let conflictFiles = _.filter(selectedFiles, (file)=>{
        return file.pakPath === key;
      });
      if (conflictFiles.length < 2) {
        next();
        return false;
      }
      let conflictXMLObjects = _.map(conflictFiles, 'xmlObject');
      let mergedXMLObject = _.merge(...conflictXMLObjects);
      let refSelectedFile = _.findIndex(selectedFiles, {path: conflictFiles[0].path});
      selectedFiles[refSelectedFile].xmlObject = mergedXMLObject;
      _.pullAt(conflictFiles, 0);
      let remainingConflictIndexes = [];
      each(conflictFiles, (file)=>{
        let refSelectedFile = _.findIndex(selectedFiles, {path: file.path});
        remainingConflictIndexes.push(refSelectedFile);
      });
      each(remainingConflictIndexes, (key)=>{
        _.pullAt(selectedFiles, key);
      });
    });
  }
  next();
};

const getXMLObject = (selectedFiles, i, conflicts, conflictPaths) => {
  status.set(`Processing XML for ${selectedFiles[i].path}`);
  fs.readFile(selectedFiles[i].path, 'utf-8', (err, data)=>{
    if (err) {
      log.error(err);
    }
    xml2js.parseString(data, (err, xml)=>{
      if (err) {
        log.error(err);
      }
      selectedFiles[i].xmlObject = xml;
      status.set(`Retrieved XML object for ${selectedFiles[i].path}`);
      if (selectedFiles[i + 1]) {
        getXMLObject(selectedFiles, i + 1, conflicts, conflictPaths);
      } else {
        checkAndMerge(selectedFiles, conflicts, conflictPaths);
      }
    });
  });
};

export const compileSelection = () => {
  const selectedFiles = getSelected(state.get().exmlFiles);
  if (selectedFiles.length === 0) {
    errorDialog('No files are selected.');
    return;
  }
  status.set('Checking for conflicts');
  let checkedFiles = [];
  let conflicts = {};
  each(selectedFiles, (exml, i)=>{
    selectedFiles[i].pakPath = exml.path.split(`EXMLs${S}`)[1].split(`${exml.parent}${S}`)[1];
    let refCheckedPath = _.findIndex(checkedFiles, {pakPath: selectedFiles[i].pakPath});
    if (refCheckedPath === -1) {
      checkedFiles.push(selectedFiles[i]);
    } else {
      if (!conflicts[selectedFiles[i].pakPath]) {
        conflicts[selectedFiles[i].pakPath] = [];
      } else {
        status.set(`Conflict found, adding to merge queue ${selectedFiles[i].pakPath}`);
      }
      conflicts[selectedFiles[i].pakPath].push(selectedFiles[i]);
    }
  });
  const conflictPaths = Object.keys(conflicts);
  const conflictsLength = conflictPaths.length;
  if (conflictsLength > 0) {
    status.set(`${conflictsLength} conflict${conflictsLength > 1 ? 's' : ''} found, will attempt reconciliation`);
  }
  getXMLObject(selectedFiles, 0, conflicts, conflictPaths)
};
window.compileSelection = compileSelection;

export const saveCurrentFile = () => {
  const s = state.get();
  const value = editorValue.get();

  if (!s.activeFile) {
    errorDialog('No files are open.');
    return;
  }

  fs.writeFile(s.activeFile, value, {encoding: 'utf8', flag: 'w'}, (err)=>{
    if (err) {
      status.set(`Unable to write file: ${err.message}`);
    } else {
      status.set(`Saved ${s.activeFile}`);
    }
  });
};
window.saveCurrentFile = saveCurrentFile;