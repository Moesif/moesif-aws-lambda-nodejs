class SingletonBatcher {
  static instance;

  constructor(handleBatch, maxSize, maxTime) {
    if (SingletonBatcher.instance) {
      SingletonBatcher.instance.handleBatch = handleBatch;
      SingletonBatcher.instance.maxSize = maxSize;
      SingletonBatcher.instance.maxTime = maxTime;

      return SingletonBatcher.instance;
    }
    this.dataArray = [];
    this.handleBatch = handleBatch;
    this.maxSize = maxTime;
    SingletonBatcher.instance = this;
  }

  add(data) {
    this.dataArray.push(data);
    if (this.dataArray.length >= this.maxSize) {
      this.flush();
    } else if (this.maxTime && this.dataArray.length === 1) {
      var self = this;
      this._timeout = setTimeout(() => {
        self.flush();
      }, this.maxTime);
    }
  }

  flush() {
    // note, in case the handleBatch is a
    // delayed function, then it swaps before
    // sending the current data.
    clearTimeout(this._timeout);
    this._lastFlush = Date.now();
    var currentDataArray = this.dataArray;
    this.dataArray = [];
    this.handleBatch(currentDataArray);
  }
}

function createBatcher(handleBatch, maxSize, maxTime) {
  return new SingletonBatcher(handleBatch, maxSize, maxTime);
}

module.exports = createBatcher;
