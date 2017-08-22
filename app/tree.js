import React from 'react';
import _ from 'lodash';
import {whichToShow} from './utils';

class Tree extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
  componentDidMount(){
    this.props.fileContainer.addEventListener('scroll', this.handleScroll);
    this.setViewableRange(this.props.fileContainer);
  }
  componentWillUnmount(){
    if (this.props.fileContainer) {
      this.props.fileContainer.removeEventListener('scroll', this.handleScroll);
    }
  }
  setViewableRange = (node) => {
    if (!node) {
      return;
    }
    console.log('Setting viewable range');
    this.range = whichToShow({
      outerHeight: node.clientHeight,
      scrollTop: node.scrollTop,
      itemHeight: 29
    });
    this.forceUpdate();
  }
  handleScroll = () => {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(this.scrollListener, 25);
  }
  scrollListener = () => {
    if (!this.props.fileContainer) {
      return;
    }
    this.setViewableRange(this.props.fileContainer);
  }
  onPakClick = (i, exp) => {
    this.props.onPakClick(i, exp);
    _.defer(()=>this.setViewableRange(this.props.fileContainer));
  }
  render() {
    return (
      <div
      className="tree-checkbox-hierarchical well border-left-danger border-left-lg"
      style={{
        padding: '0px',
        backgroundColor: '#1e1e1e',
        color: '#4db8fe'
      }}>
        <ul
        className="ui-fancytree fancytree-container fancytree-plain"
        tabIndex="0"
        style={{overflowX: 'hidden'}}>
          {_.map(this.props.files, (pak, i)=>{
            let exp = pak.expanded;
            let expLetter = exp ? 'e' : 'c';
            return (
              <li
              key={i}>
                <span className={`fancytree-node ${exp ? 'fancytree-expanded' : ''} fancytree-folder fancytree-has-children fancytree-exp-${expLetter} fancytree-ico-${expLetter}f ${pak.selected ? 'fancytree-selected' : ''}`}>
                  <span
                  className="fancytree-expander"
                  onClick={()=>this.onPakClick(i, exp)} />
                  <span
                  className="fancytree-checkbox"
                  onClick={()=>this.props.onPakCheck(i, pak.selected)} />
                  <span className="fancytree-icon" />
                  <span
                  className="fancytree-title"
                  onClick={()=>this.onPakClick(i, exp)}>
                    {pak.pak.replace(/[_]/g, ' _ ')}
                  </span>
                </span>
                {exp ?
                  <ul>
                    {_.map(pak.exmls, (exml, z)=>{
                      let x = z + this.props.files.length + 1;
                      let isVisible = x >= this.range.start && x <= this.range.start + this.range.length;
                      let isActive = exml.path === this.props.activeFile;
                      if (!isVisible) {
                        return (
                          <li
                          key={z}
                          style={{height: '28px'}}/>
                        );
                      }
                      return (
                        <li key={z}>
                          <span className={`fancytree-node fancytree-exp-n fancytree-ico-c ${exml.selected ? 'fancytree-selected' : ''} ${isActive ? 'fancytree-active fancytree-focused' : ''}`}>
                            <span className="fancytree-expander" />
                            <span
                            className="fancytree-checkbox"
                            onClick={()=>this.props.onFileCheck(i, z, exml.selected)} />
                            <span className="fancytree-icon" />
                            <span
                            className="fancytree-title"
                            onClick={()=>this.props.onFileClick(i, z, exml.path)}>
                              {exml.name.replace(/[_]/g, ' _ ')}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul> : null}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}

export default Tree;
