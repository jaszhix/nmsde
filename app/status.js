import Reflux from 'reflux';

const status = Reflux.createStore({
  init() {
    this.state = {
      status: 'Initializing'
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