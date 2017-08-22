import React from 'react';
import Reflux from 'reflux';
import PropTypes from 'prop-types';

import status from './status';

class StatusBar extends Reflux.Component {
  static propTypes = {
    editor: PropTypes.object.isRequired
  }
  constructor(props) {
    super(props);
    this.state = {
      position: {
        lineNumber: 1,
        column: 1
      }
    };
    this.stores = [status];
    this.storeKeys = ['status']
  }
  componentDidMount() {
    this.props.editor.onDidChangeCursorPosition(this.onEditorCursorPositionChange);
  }
  onEditorCursorPositionChange = (e) => {
    this.setState({position: e.position});
  }
  render() {
    return (
      <div
      className="navbar-fixed-bottom statusBar">
        <div className="row">
          <div className="col-xs-6">
            {this.state.status.replace(/[_]/g, ' _ ')}
          </div>
          <div className="col-xs-6 textAlignRight">
            {`Line ${this.state.position.lineNumber}, Column ${this.state.position.column}`}
          </div>
        </div>
      </div>
    );
  }
}

export default StatusBar;