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
      timeout: 0,
      maxBuffer: 2000*1024,
      killSignal: 'SIGTERM',
      cwd: null,
      env: null
    };
    /* if (process.platform === 'win32') {
      opts.shell = 'powershell.exe';
    } else {
      opts.shell = '/bin/sh';
    } */
    exec(cmd, opts, cb)
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

const next = (i, multiThreading, func, endFunc) => {
  _.defer(()=>{
    if (!multiThreading) {
      func(i + 1);
    }
    if (endFunc) {
      endFunc(i);
    }
  });
};

export const getReadyStatusText = (workDir) => {
  return `Workspace ready at ${workDir}`;
};

export const addFile = (file, s) => {
  const extension = _.last(file.split('.')).toLowerCase();
  let key = file.split(`EXMLs${S}`)[1].split(S)[0]
  key = key.substr(1, key.length);
  let refPak = _.findIndex(s.exmlFiles, {pak: key});
  if (refPak === -1) {
    s.exmlFiles.push({
      pak: key,
      exmls: [],
      selected: false,
      expanded: false
    });
    refPak = s.exmlFiles.length - 1;
  }
  s.exmlFiles[refPak].exmls.push({
    parent: key,
    name: _.last(file.split(S)),
    path: file,
    selected: false,
    extension: extension
  });
  s.exmlFiles[refPak].exmls = _.uniqBy(s.exmlFiles[refPak].exmls, 'path');
};

export const getFileList = () => {
  const s = state.get();
  const exmlDir = `${s.workDir}${S}EXMLs`;
  walk(exmlDir, (err, files)=>{
    if (err) {
      log.error(err);
    }
    const filesLength = files.length;
    each(files, (file, i)=>{
      status.set(`Loading files (${getPercent(i + 1, filesLength)}%)`)
      addFile(file, s);
    });
    state.set({exmlFiles: s.exmlFiles});
    let readyState = filesLength > 0 ? `Loaded ${filesLength} file${filesLength > 1 ? 's' : ''} from ${exmlDir}`
      :
      getReadyStatusText(workDir);
    status.set(readyState);
    window.decompiling = false;
  });
};

const decompileMBINFiles = (mbinDir, exmlDir, multiThreading) => {
  window.decompiling = true;
  editorValue.set('');
  walk(mbinDir, (err, files)=>{
    const _files = _.filter(files, (file)=>{
      let extension = _.last(file.split('.'));
      return extension.toLowerCase() === 'mbin';
    });
    const nonMBINFiles = _.filter(files, (file)=>{
      let extension = _.last(file.split('.')).toLowerCase();
      return extension === 'dds' || extension === 'bin';
    });
    each(nonMBINFiles, (file)=>{
      let exmlPath = file.replace(/MBINs/g, 'EXMLs');
      fse.moveSync(file, exmlPath, {overwrite: true});
    });
    const _filesLength = _files.length;
    let z = 0;
    const end = () => {
      if (z >= _filesLength - 1) {
        getFileList();
      }
    };
    const handleSuccess = (file, i, func) => {
      z++
      let percentage = `${getPercent(z, _filesLength)}%`;
      status.set(`${percentage} Decompiled ${file}`);
      next(i, multiThreading, func, end);
    };
    const handleFail = (file, i, mbinFailures, func) => {
      z++
      mbinFailures.push(file);
      state.set({mbinFailures: mbinFailures});
      status.set(`Failed to decompile ${file}`);
      next(i, multiThreading, func, end);
    };
    const decompile = (i) => {
      if (!_files[i]) {
        getFileList();
        return;
      }
      const file = _files[i];
      const s = state.get();
      try {
        let exmlPath = file.replace(/[.]MBIN/g, '.exml').replace(/MBINs/g, 'EXMLs');
        // Make sure files are only processed once
        let refFailFile = _.findIndex(s.mbinFailures, {file: file});
        if (fs.existsSync(exmlPath) || refFailFile > -1) {
          z++;
          next(i, multiThreading, decompile, end);
          return;
        }
        let exmlDir = exmlPath.split(_.last(exmlPath.split(S)))[0];
        fse.ensureDirSync(exmlDir);
        let command = `.${S}bin${S}MBINCompiler.exe "${file}" "${exmlPath}"`;
        if (!multiThreading) {
          exc(command);
          handleSuccess(file, i, decompile);
        } else {
          exc(command, (err, stdout, stderr)=>{
            let hasStdErr = stderr.trim().length > 0;
            let _err = hasStdErr ? stderr : err;
            if (_err) {
              let editorString = editorValue.get();
              editorString += 'MBINCompiler error(s):\n';
              editorString += `${file}:\n`;
              editorString += `${_err}\n`;
              editorValue.set(editorString);
              handleFail(file, i, s.mbinFailures, decompile);
            } else {
              handleSuccess(file, i, decompile);
            }
          });
        }
      } catch (e) {
        handleFail(file, i, s.mbinFailures, decompile);
      }
    };
    if (multiThreading) {
      // Don't launch a ton of MBINCompiler processes at once
      let count = 0;
      each(_files, (file, i)=>{
        if (count < 3) {
          decompile(i);
        } else {
          _.delay(()=>decompile(i), (i + 1) * 2);
          count = -1;
        }
        count++;
      });
    } else {
      decompile(0);
    }
  });
};

const extractPakFiles = (workDir, mbinDir, exmlDir, exmlFiles, multiThreading) => {
  fs.readdir(workDir, (err, files)=>{
    const _files = _.filter(files, (file)=>{
      let extension = _.last(file.split('.'));
      return extension.toLowerCase() === 'pak';
    });
    const _filesLength = _files.length;
    const end = (i) => {
      if (i === _filesLength - 1) {
        status.set('Decompiling MBINs, please wait...');
        decompileMBINFiles(mbinDir, exmlDir, multiThreading);
      }
    };
    const extract = (i) => {
      const file = _files[i];
      const fileDir = `${mbinDir}${S}_${file}`
        .replace(/[.]pak/g, '');
      const pakPath = `${workDir}${S}${file}`;
      let shouldSkip = false;
      each(exmlFiles, (pak)=>{
        if (`${pak.pak}.pak` === file) {
          shouldSkip = true;
        }
      });
      if (shouldSkip) {
        next(i, multiThreading, extract, end);
        return;
      }
      fse.ensureDirSync(fileDir);
      if (fs.existsSync(pakPath)) {
        let command = `.${S}bin${S}psarc.exe extract -y --input="${pakPath}" --to="${fileDir}"`;
        let success = `${getPercent(i + 1, _filesLength)}% Extracted ${pakPath}`;
        let fail = `Failed to extract ${pakPath}`;
        try {
          if (!multiThreading) {
            exc(command);
            status.set(success);
            next(i, multiThreading, extract, end);
          } else {
            exc(command, (err, stdout, stderr)=>{
              let hasStdErr = stderr.trim().length > 0;
              let _err = hasStdErr ? stderr : err;
              if (_err) {
                let editorString = editorValue.get();
                editorString += `${file}:\n`;
                editorString += `${_err}\n`;
                editorValue.set(editorString);
                status.set(fail);
                next(i, multiThreading, extract, end);
              } else {
                status.set(success);
                next(i, multiThreading, extract, end);
              }
            });
          }

        } catch (e) {
          status.set(fail);
          next(i, multiThreading, extract, end);
        }
      }
    };
    if (multiThreading) {
      each(_files, (file, i)=>{
        extract(i);
      });
    } else {
      extract(0);
    }
  });
};

export const copyPakFiles = (pakFiles) => {
  if (window.clearingWorkspace) {
    return;
  }
  const s = state.get();
  const mbinDir = `${s.workDir}${S}MBINs`;
  const exmlDir = `${s.workDir}${S}EXMLs`;
  status.set('Importing PAK files');
  each(pakFiles, (pakFile)=>{
    const file = _.last(pakFile.split(S));
    fse.copySync(pakFile, `${s.workDir}${S}${file.replace(/\s/g, '.')}`);
  });
  status.set('Extracting PAK files, please wait...');
  extractPakFiles(s.workDir, mbinDir, exmlDir, s.exmlFiles, s.multiThreading);
};
window.copyPakFiles = copyPakFiles;

export const clearWorkSpace = () => {
  if (window.clearingWorkspace || window.decompiling) {
    return;
  }
  window.clearingWorkspace = true;
  const s = state.get();
  status.set('Clearing workspace, please wait...');
  walk(s.workDir, (err, files)=>{
    const filesLength = files.length;
    const next = (i, func) => {
      let percentage = `${getPercent(i + 1, filesLength)}%`;
      status.set(`${percentage} Deleted ${files[i]}`);
      if (i === filesLength - 1) {
        init(s.workDir);
        state.set({exmlFiles: []});
        editorValue.set('');
        status.set('Finished clearing the workspace');
        window.clearingWorkspace = false;
      } else {
        _.defer(()=>func(i + 1));
      }
    }
    const remove = (i) => {
      fse.remove(files[i], (err)=>{
        if (err) {
          log.error(err);
          status.set(`Unable to remove file: ${err}`);
        }
        next(i, remove);
      });
    };
    remove(0);
  });
};
window.clearWorkSpace = clearWorkSpace;

const buildPAKFile = (psarcList, stagingDir, workDir) => {
  status.set('Building PAK file')
  const fail = 'PAK file failed to build.';
  try {
    exc(`.${S}bin${S}_psarc.exe ${psarcList.join(' ')}`);
  } catch (e) {
    status.set(fail);
  }
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
      status.set(fail);
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
    const nonMBINFiles = _.filter(files, (file)=>{
      let extension = _.last(file.split('.')).toLowerCase();
      return extension === 'dds' || extension === 'bin';
    });
    const _filesLength = _files.length;
    const psarcList = [];
    each(_files, (file, i)=>{
      let percentage = `${getPercent(i + 1, _filesLength)}%`;
      let success = `${percentage} Compiled ${file}`;
      let fail = `Failed to compile ${file}`;
      try {
        let mbinPath = file.replace(/[.]exml/g, '.MBIN');
        let command = `.${S}bin${S}MBINCompiler.exe "${file}" "${mbinPath}"`;
        exc(command);
        psarcList.push(mbinPath);
        status.set(success);
      } catch (e) {
        status.set(fail);
      }
    });
    each(nonMBINFiles, (file)=>{
      psarcList.push(file);
      status.set(`Added file to build ${file}`);
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
    const stagingPath = `${stagingDir}${S}${file.pakPath}`;
    const ensurePath = stagingPath.split(_.last(stagingPath.split(S)))[0];
    fse.ensureDirSync(ensurePath);
    if (file.extension === 'exml') {
      const xml = builder.buildObject(file.xmlObject);
      fs.writeFileSync(stagingPath, xml, {flag: 'w', encoding: 'utf8'});
      status.set(`Rebuilt XML file ${stagingPath}`);
    } else {
      fse.copySync(file.path, stagingPath);
      status.set(`Copied file to staging directory ${stagingPath}`);
    }
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
  const next = () => {
    if (selectedFiles[i + 1]) {
      getXMLObject(selectedFiles, i + 1, conflicts, conflictPaths);
    } else {
      checkAndMerge(selectedFiles, conflicts, conflictPaths);
    }
  };
  if (selectedFiles[i].extension !== 'exml') {
    next();
    return;
  }
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
      next();
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
    } else if (checkedFiles[refCheckedPath].extension === 'exml') {
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

const toggleMultiThreading = () => {
  let multiThreading = state.get().multiThreading;
  state.set({multiThreading: !multiThreading});
};
window.toggleMultiThreading = toggleMultiThreading;