const { nodeNameToMinifiedValueMap } = require('../constants/minification')

class MinifyAstNodeTransformer {
  constructor() {
    this._transformMap = nodeNameToMinifiedValueMap
  }

  transform(key) {
    return this._transformMap[key] || key
  }
}

module.exports = MinifyAstNodeTransformer
