const Jexl = require('./Jexl')
const {
  ExecutionError,
  TimeoutError,
  JexlError,
  MissedVariableError,
  ReadFromEmptyObjectError
} = require('./errors')

module.exports = new Jexl()
module.exports.Jexl = Jexl

module.exports.ExecutionError = ExecutionError
module.exports.TimeoutError = TimeoutError
module.exports.JexlError = JexlError
module.exports.MissedVariableError = MissedVariableError
module.exports.ReadFromEmptyObjectError = ReadFromEmptyObjectError
