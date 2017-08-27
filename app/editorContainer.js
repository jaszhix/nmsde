import React from 'react';
import Reflux from 'reflux';
import MonacoEditor from './monaco';

import editorValue from './editor';

class EditorContainer extends Reflux.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.store = editorValue;
  }
  onEditorChange = (newValue) => {
    editorValue.set(newValue);
  }
  render() {
    return (
      <div className="col-xs-12" style={{maxWidth: `${this.props.width}px`}}>
        <div className="row" style={{height: `${this.state.height}px`}}>
          <MonacoEditor
          value={this.state.editorValue}
          onChange={this.onEditorChange}
          {...this.props} />
        </div>
      </div>
    );
  }
}

export default EditorContainer;