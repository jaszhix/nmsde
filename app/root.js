import fs from 'graceful-fs';
import watch from 'watch';

import state from './state';
import editorValue from './editor';
import status from './status';
import each from './each';
import React from 'react';
import Reflux from 'reflux';
import _ from 'lodash';
import v from 'vquery';

import {init, walk, S, getSelected, getPercent, _log as log} from './utils';
import EditorContainer from './editorContainer';
import Tree from './tree';
import StatusBar from './statusbar';

class Root extends Reflux.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.store = state;
  }
  componentDidMount() {
    window.addEventListener('resize', this.onWindowResize);
    v('#splash').remove();
    init();
  }
  componentDidUpdate(pP, pS) {
    if (pS.workDir !== this.state.workDir
    || pS.init !== this.state.init && this.state.init) {
      this.stopMonitor();
      this.startMonitor();
      this.getFileList();
    }
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.onWindowResize);
    this.stopMonitor();
  }
  editorDidMount = (editor, monaco) => {
    this.editor = editor;
    this.editor.onKeyDown(this.onEditorKeyDown);
    this.editor.focus();
    this.forceUpdate();
  }
  onEditorKeyDown = (e) => {
    if (e.keyCode === 59) {
      console.log('f1');
    }
  }
  onWindowResize = () => {
    state.set({
      width: window.innerWidth,
      height: window.innerHeight - 20
    });
    if (this.editor) {
      this.editor.layout();
    }
  }
  startMonitor = () => {
    log.error(`Creating monitor for ${this.state.workDir}`);
    watch.createMonitor(`${this.state.workDir}${S}EXMLs`, {
      ignoreDotFiles: true,
      ignoreNotPermitted: false,

    }, (monitor)=>{
      this.monitor = monitor;
      this.monitor.on('changed', (f, current, prev)=>{
        status.set(`Updated ${f}`);
      });
      this.monitor.on('created', this.onFileCreated);
      this.monitor.on('removed', this.removeFile);
    });
  }
  stopMonitor = () => {
    if (this.monitor) {
      this.monitor.stop();
    }
  }
  onFileCreated = (f, stat) => {
    if (f.substr(-5, f.length) === '.exml') {
      this.addFile(f);
      status.set(`Loaded ${f}`);
    } else {
      this.getFileList(f);
      state.set({exmlFiles: this.state.exmlFiles});
    }
  }
  removeFile = (f, stat) => {
    const removedKeys = [];
    each(this.state.exmlFiles, (pak, i)=>{
      each(pak.exmls, (exml, z)=>{
        if (exml.path === f) {
          removedKeys.push([i, z]);
        }
      });
    });
    each(removedKeys, (key)=>{
      let [i, z] = key;
      _.pullAt(this.state.exmlFiles[i].exmls, z);
      if (this.state.exmlFiles[i].exmls.length === 0) {
        _.pullAt(this.state.exmlFiles, i);
      }
    });

    if (removedKeys.length > 0) {
      state.set({exmlFiles: this.state.exmlFiles});
      status.set(`Deleted ${f}`);
    }
  }
  addFile = (file) => {
    let key = file.split(`EXMLs${S}`)[1].split(S)[0]
    key = key.substr(1, key.length);
    let refPak = _.findIndex(this.state.exmlFiles, {pak: key});
    if (refPak === -1) {
      this.state.exmlFiles.push({
        pak: key,
        exmls: [],
        selected: false,
        expanded: false
      });
      refPak = this.state.exmlFiles.length - 1;
    }
    this.state.exmlFiles[refPak].exmls.push({
      parent: key,
      name: _.last(file.split(S)),
      path: file,
      selected: false
    });
    return refPak;
  }
  getFileList = (overrideDir) => {
    console.log(`${this.state.workDir}${S}EXMLs`);
    const exmlDir = overrideDir ? overrideDir : `${this.state.workDir}${S}EXMLs`;
    walk(exmlDir, (err, files)=>{
      if (err) {
        log.error(err);
      }
      const filesLength = files.length;
      each(files, (file, i)=>{
        status.set(`Loading files (${getPercent(i + 1, filesLength)}%)`)
        let refPak = this.addFile(file);
        this.state.exmlFiles[refPak].exmls = _.uniqBy(this.state.exmlFiles[refPak].exmls, 'path')
      });
      state.set({exmlFiles: this.state.exmlFiles});
      let readyState = !overrideDir && filesLength > 0 ? `Loaded ${filesLength} file${filesLength > 1 ? 's' : ''} from ${exmlDir}`
        :
        `Workspace ready at ${this.state.workDir}`;
      status.set(readyState);
    });
  }
  togglePakExpand = (i, expanded) => {
    this.state.exmlFiles[i].expanded = !expanded;
    state.set({exmlFiles: this.state.exmlFiles});
  }
  openFile = (i, z, exmlPath) => {
    fs.readFile(exmlPath, {encoding: 'utf8'}, (err, xml)=>{
      if (err) {
        log.error(err);
        return;
      }
      editorValue.set(xml);
      state.set({
        exmlFiles: this.state.exmlFiles,
        activeFile: exmlPath
      });
      document.title = `${exmlPath} - NMSDE`;
    });
  }
  checkPak = (i, selected) => {
    this.state.exmlFiles[i].selected = !selected;
    each(this.state.exmlFiles[i].exmls, (exml, z)=>{
      this.state.exmlFiles[i].exmls[z].selected = !selected
    });
    state.set({exmlFiles: this.state.exmlFiles});
    const selectedLength = getSelected(this.state.exmlFiles).length;
    status.set(`${selectedLength} file${selectedLength > 1 ? 's' : ''} selected`);
  }
  checkFile = (i, z, selected) => {
    this.state.exmlFiles[i].exmls[z].selected = !selected;
    state.set({exmlFiles: this.state.exmlFiles});
    const selectedLength = getSelected(this.state.exmlFiles).length;
    status.set(`${selectedLength} file${selectedLength > 1 ? 's' : ''} selected`);
  }
  render() {
    const options = {
      selectOnLineNumbers: true,
      roundedSelection: true,
      readOnly: false,
      cursorStyle: 'line',
      automaticLayout: false,
      mouseWheelZoom: true,
      renderLineHighlight: 'gutter',
      scrollbar: {
        horizontalScrollbarSize: 10,
        verticalScrollbarSize: 20
      },
      parameterHints: true,
      contextmenu: true,
      fontLigatures: false,
      fixedOverflowWidgets: true
    }
    const fileTreeStyle = {
      maxHeight: `${this.state.height}px`,
    };
    return (
      <div>
        <div className="row">
          <div
          ref={(ref)=>this.fileContainer = ref}
          className="col-xs-3 fileTree"
          style={fileTreeStyle}>
            {this.state.init && this.fileContainer && this.state.exmlFiles.length > 0 ?
              <Tree
              files={this.state.exmlFiles}
              activeFile={this.state.activeFile}
              onPakClick={this.togglePakExpand}
              onFileClick={this.openFile}
              onPakCheck={this.checkPak}
              onFileCheck={this.checkFile}
              fileContainer={this.fileContainer} />
              :
              <h3 className="welcomeText">Select File > Open to import PAK files.</h3>}
          </div>
          <EditorContainer
          height={this.state.height}
          language="xml"
          theme="vs-dark"
          editorDidMount={this.editorDidMount}
          options={options} />
          {this.editor ? <StatusBar editor={this.editor} /> : null}
        </div>
      </div>
    );
  }
}

export default Root;