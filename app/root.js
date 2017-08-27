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

import {init, S, getFileList, addFile, getSelected, getReadyStatusText, _log as log} from './utils';
import EditorContainer from './editorContainer';
import SplitPane from 'react-split-pane';
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
      getFileList();
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
    });
  }
  stopMonitor = () => {
    if (this.monitor) {
      this.monitor.stop();
    }
  }
  onFileCreated = (f, stat) => {
    if (window.decompiling) {
      return;
    }
    const extension = _.last(f.split('.')).toLowerCase();
    if (extension === 'exml'
    || extension === 'dds'
    || extension === 'bin') {
      addFile(f);
      status.set(`Loaded ${f}`);
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
      const extension = this.state.exmlFiles[i].exmls[z].extension;
      if (extension === 'bin') {
        // TBD: Setting a GLSL-like syntax coloring for BIN files
        monaco.editor.setModelLanguage(this.editor.getModel(), 'cpp');
      }
      document.title = `${exmlPath} - NMSDE`;
    });
  }
  checkPak = (i, selected) => {
    this.state.exmlFiles[i].selected = !selected;
    each(this.state.exmlFiles[i].exmls, (exml, z)=>{
      this.state.exmlFiles[i].exmls[z].selected = !selected
    });
    state.set({exmlFiles: this.state.exmlFiles});
    this.setSelectedStatus();
  }
  checkFile = (i, z, selected) => {
    this.state.exmlFiles[i].exmls[z].selected = !selected;
    state.set({exmlFiles: this.state.exmlFiles});
    this.setSelectedStatus();
  }
  onTreePaneDragFinished = (size) => {
    state.set({treePaneSize: size});
    this.editor.layout();
  }
  setSelectedStatus = () => {
    const selectedLength = getSelected(this.state.exmlFiles).length;
    let statusText = selectedLength > 0 ? `${selectedLength} file${selectedLength > 1 ? 's' : ''} selected`
      :
      getReadyStatusText();
    status.set(statusText);
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
        {this.state.init ?
          <div className="row">
            <SplitPane
            split="vertical"
            defaultSize={this.state.treePaneSize}
            onDragFinished={this.onTreePaneDragFinished}>
              <div
              ref={(ref)=>this.fileContainer = ref}
              className="fileTree"
              style={fileTreeStyle}>
                {this.fileContainer && this.state.exmlFiles.length > 0 ?
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
              width={window.innerWidth - this.state.treePaneSize}
              language="xml"
              theme="vs-dark"
              editorDidMount={this.editorDidMount}
              options={options} />
            </SplitPane>
            {this.editor ? <StatusBar editor={this.editor} multiThreading={this.state.multiThreading} /> : null}
          </div> : null}
      </div>
    );
  }
}

export default Root;