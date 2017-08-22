const fs = require('fs');

class Json {
  constructor(path, fileName, defaultObj, cb){
    this.fileName = fileName;
    this.path = `${path}/${this.fileName}`;
    this.data = defaultObj ? defaultObj : {};
    this.init(this.path, cb);
  }
  init(readPath, cb){
    fs.readFile(readPath, (err, data=this.data)=>{
      if (err) {
        fs.writeFile(this.path, JSON.stringify(this.data), (err, data)=>{
          if (err) {
            console.log(err);
            return;
          }
          cb(null, this.data);
        });
      }
      try {
        this.data = JSON.parse(data);
        cb(null, this.data);
      } catch (e) {
        cb(true);
      }
    });
  }
  writeFile(cb){
    fs.writeFile(this.path, JSON.stringify(this.data), (err, data)=>{
      if (err) {
        console.log(err);
        return;
      }
      if (typeof cb === 'function') {
        cb(this.data);
      }
    });
  }
  set(key, value){
    this.data[key] = value;
    this.writeFile(null, this.data.hasOwnProperty('maintenanceTS'));
  }
  get(key){
    try {
      return this.data;
    } catch (e) {
      return null;
    }
  }
  remove(key){
    delete this.data[key];
    this.writeFile();
  }
}

module.exports = Json;