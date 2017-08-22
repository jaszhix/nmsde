import Reflux from 'reflux';

const editorValue = Reflux.createStore({
  init() {
    this.state = {
      editorValue: ''
    }
  },
  set(editorValue) {
    this.state.editorValue = editorValue;
    this.trigger(this.state);
  },
  get() {
    return this.state.editorValue;
  }
});

export default editorValue;