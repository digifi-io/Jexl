const ExecutionError = require('./ExecutionError')

class MissedVariableError extends ExecutionError {
  constructor(variable) {
    super(`Variable ${variable} is not defined.`)

    this.variable = variable
    this.name = this.constructor.name
  }
}

module.exports = MissedVariableError
