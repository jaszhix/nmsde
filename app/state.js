import Reflux from 'reflux';
import _ from 'lodash';
import each from './each';

import {workDir, dataDir, init} from './utils';
import Json from './json';

const state = Reflux.createStore({
  init(){
    this.json = new Json(dataDir, 'config.json', {
      workDir: workDir
    }, (err, data)=>{
      if (!err) {
        init(data.workDir);
      } else {
        data = {};
      }
      data.init = true;
      this.set(data, null, false);
    });
    this.state = {
      init: false,
      workDir: workDir,
      pakPaths: [],
      width: window.innerWidth,
      height: window.innerHeight - 20,
      exmlFiles: [],
      activeFile: '',
      triggerSave: false,
      treePaneSize: 400,
      multiThreading: false,
    };
    this.configKeys = [
      'workDir',
      'treePaneSize',
      'multiThreading'
    ];
  },
  set(obj, cb, writeSettings = true){
    if (process.env.NODE_ENV === 'development') {
      try {
        throw new Error('STATE STACK')
      } catch (e) {
        let stackParts = e.stack.split('\n');
        console.log('STATE CALLEE: ', stackParts[2].trim());
      }
    }
    console.log('STATE INPUT: ', obj);
    _.assignIn(this.state, _.cloneDeep(obj));
    console.log('STATE: ', this.state);

    if (writeSettings) {
      each(obj, (value, key)=>{
       if (this.configKeys.indexOf(key) > -1) {
          this.json.set(key, value);
        };
      });
    }

    this.trigger(this.state);
    if (cb && _.isFunction(cb)) {
      _.defer(cb);
    }
  },
  get(){
    return this.state;
  }
});

window.state = state;

export default state;