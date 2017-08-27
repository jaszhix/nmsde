import Reflux from 'reflux';

const status = Reflux.createStore({
  init() {
    this.state = {
      status: 'Preparing workspace, please wait...'
    }
  },
  set(status) {
    this.state.status = status;
    this.trigger(this.state);
  },
  get() {
    return this.state.status;
  }
});

export default status;