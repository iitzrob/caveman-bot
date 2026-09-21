const fs = require('fs');
const path = require('path');

// A tiny, dependency-free JSON-file store. Good enough for points and
// ticket metadata without needing a real database or native bindings.
function createStore(fileName, defaultValue = {}) {
  const filePath = path.join(__dirname, '..', 'data', fileName);

  function ensure() {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    }
  }

  function readAll() {
    ensure();
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return { ...defaultValue };
    }
  }

  function writeAll(data) {
    ensure();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  return {
    get(key) {
      return readAll()[key];
    },
    set(key, value) {
      const data = readAll();
      data[key] = value;
      writeAll(data);
    },
    delete(key) {
      const data = readAll();
      delete data[key];
      writeAll(data);
    },
    all() {
      return readAll();
    },
    overwriteAll(data) {
      writeAll(data);
    },
  };
}

module.exports = createStore;
