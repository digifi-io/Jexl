const ExecutionError = require('./ExecutionError')

class ReadFromEmptyObjectError extends ExecutionError {
  constructor(property, from) {
    super(`Cannot read properties of ${from} (reading '${property}')`)

    this.property = property
    this.from = from
    this.name = this.constructor.name
  }
}

module.exports = ReadFromEmptyObjectError
