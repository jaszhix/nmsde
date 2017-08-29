import {remote} from 'electron';
import React from 'react';
import _ from 'lodash';
import {whichToShow, removePak, removeExml} from './utils';
import each from './each';

const {Menu, MenuItem} = remote;

class Tree extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
  componentDidMount(){
    this.props.fileContainer.addEventListener('scroll', this.handleScroll);
    this.setViewableRange(this.props.fileContainer);
    this.buildContextMenu(true);


    const checkRef = () => {
      if (!this.rootRef) {
        _.delay(checkRef, 500);
      } else {
        this.rootRef.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const browserWindow = remote.getCurrentWindow();
          browserWindow.__e = e;
          this.contextMenu.popup(browserWindow);
        }, false);
      }
    };
    checkRef();
  }
  componentWillUnmount(){
    if (this.props.fileContainer) {
      this.props.fileContainer.removeEventListener('scroll', this.handleScroll);
    }
  }
  buildContextMenu = (init) => {
    let hasSelections, hasExpanded = false;

    if (!init) {
      each(this.props.files, (pak, i)=>{
        if (pak.selected) {
          hasSelections = true;
        }
        if (pak.expanded) {
          hasExpanded = true;
        }
        each(pak.exmls, (exml, z)=>{
          if (exml.selected) {
            hasSelections = true;
          }
        });
      });
      this.contextMenu.clear();
    } else {
      this.contextMenu = new Menu();
    }

    this.contextMenu.append(new MenuItem({
      label: hasSelections ? 'Deselect All' : 'Select All',
      click: (item) => {
        each(this.props.files, (pak, i)=>{
          this.props.onPakCheck(i, hasSelections);
          each(pak.exmls, (exml, z)=>{
            this.props.onFileCheck(i, z, hasSelections)
          });
        });
        this.buildContextMenu();
      }
    }));
    this.contextMenu.append(new MenuItem({
      label: hasExpanded ? 'Collapse All' : 'Expand All',
      click: (item) => {
        each(this.props.files, (pak, i)=>{
          this.onPakClick(i, hasExpanded);
        });
        this.buildContextMenu();
      }
    }));
    this.contextMenu.append(new MenuItem({type: 'separator'}));
    this.contextMenu.append(new MenuItem({
      label: 'Remove From Workspace',
      click: (item, browserWindow) => {
        if (browserWindow.__e.srcElement.id.substr(0, 5) === 'pak__') {
          const i = parseInt(browserWindow.__e.srcElement.id[5]);
          removePak(i);
        } else if (browserWindow.__e.srcElement.id.length > 0) {
          removeExml(browserWindow.__e.srcElement.id);
        }
        browserWindow.__e = undefined;
      }
    }));
  }
  setViewableRange = (node) => {
    if (!node) {
      return;
    }
    console.log('Setting viewable range');
    this.range = whichToShow({
      outerHeight: node.clientHeight,
      scrollTop: node.scrollTop,
      itemHeight: 28
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
    _.defer(()=>{
      this.setViewableRange(this.props.fileContainer);
      this.buildContextMenu();
    });
  }
  handlePakSelection = (i, selected) => {
    this.props.onPakCheck(i, selected);
    _.defer(this.buildContextMenu);
  }
  handleExmlSelection = (i, z, selected) => {
    this.props.onFileCheck(i, z, selected);
    _.defer(this.buildContextMenu);
  }
  getRootRef = (ref) => {
    this.rootRef = ref;
  }
  render() {
    return (
      <div
      ref={this.getRootRef}
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
                <span
                id={`pak__${i}`}
                className={`fancytree-node ${exp ? 'fancytree-expanded' : ''} fancytree-folder fancytree-has-children fancytree-exp-${expLetter} fancytree-ico-${expLetter}f ${pak.selected ? 'fancytree-selected' : ''}`}>
                  <span
                  id={`pak__${i}`}
                  className="fancytree-expander"
                  onClick={()=>this.onPakClick(i, exp)} />
                  <span
                  id={`pak__${i}`}
                  className="fancytree-checkbox"
                  onClick={()=>this.handlePakSelection(i, pak.selected)} />
                  <span id={`pak__${i}`} className="fancytree-icon" />
                  <span
                  id={`pak__${i}`}
                  className="fancytree-title"
                  onClick={()=>this.onPakClick(i, exp)}>
                    {pak.pak.replace(/[_]/g, ' _ ')}
                  </span>
                </span>
                {exp ?
                  <ul>
                    {_.map(pak.exmls, (exml, z)=>{
                      let y = i - 1;
                      let v = 0;

                      while (y > -1) {
                        v += this.props.files[y].expanded ? this.props.files[y].exmls.length + 1 : 1;
                        y--;
                      }
                      let x = z + 1 + v;
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
                          <span
                          id={exml.path}
                          className={`fancytree-node fancytree-exp-n fancytree-ico-c ${exml.selected ? 'fancytree-selected' : ''} ${isActive ? 'fancytree-active fancytree-focused' : ''}`}>
                            <span
                            id={exml.path}
                            className="fancytree-expander" />
                            <span
                            id={exml.path}
                            className="fancytree-checkbox"
                            onClick={()=>this.handleExmlSelection(i, z, exml.selected)} />
                            <span
                            id={exml.path}
                            className="fancytree-icon" />
                            <span
                            id={exml.path}
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
