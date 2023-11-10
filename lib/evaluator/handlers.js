/*
 * Jexl
 * Copyright 2020 Tom Shawver
 */

const MissedVariableError = require('../errors/MissedVariableError')
const JexlError = require('../errors/JexlError')
const ReadFromEmptyObjectError = require('../errors/ReadFromEmptyObjectError')
const TokenType = require('../constants/TokenType')

/**
 * Evaluates an ArrayLiteral by returning its value, with each element
 * independently run through the evaluator.
 * @param {{type: 'ObjectLiteral', value: <{}>}} ast An expression tree with an
 *      ObjectLiteral as the top node
 * @returns {Promise.<[]>} resolves to a map contained evaluated values.
 * @private
 */
exports[TokenType.ArrayLiteral] = function (ast) {
  return this.evalArray(ast[this.nodeTransformer.transform('value')])
}

/**
 * Evaluates a BinaryExpression node by running the Grammar's evaluator for
 * the given operator. Note that binary expressions support two types of
 * evaluators: `eval` is called with the left and right operands pre-evaluated.
 * `evalOnDemand`, if it exists, will be called with the left and right operands
 * each individually wrapped in an object with an "eval" function that returns
 * a promise with the resulting value. This allows the binary expression to
 * evaluate the operands conditionally.
 * @param {{type: 'BinaryExpression', operator: <string>, left: {},
 *      right: {}}} ast An expression tree with a BinaryExpression as the top
 *      node
 * @returns {Promise<*>} resolves with the value of the BinaryExpression.
 * @private
 */
exports[TokenType.BinaryExpression] = function (ast) {
  const operator = ast[this.nodeTransformer.transform('operator')]

  const grammarOp = this._grammar.elements[operator]

  if (grammarOp.evalOnDemand) {
    const wrap = (subAst) => ({ eval: () => this.eval(subAst) })

    return grammarOp.evalOnDemand(
      wrap(ast[this.nodeTransformer.transform('left')]),
      wrap(ast[this.nodeTransformer.transform('right')])
    )
  }

  return this.Promise.all([
    this.eval(ast[this.nodeTransformer.transform('left')]),
    this.eval(ast[this.nodeTransformer.transform('right')])
  ]).then((arr) => grammarOp.eval(arr[0], arr[1]))
}

/**
 * Evaluates a ConditionalExpression node by first evaluating its test branch,
 * and resolving with the consequent branch if the test is truthy, or the
 * alternate branch if it is not. If there is no consequent branch, the test
 * result will be used instead.
 * @param {{type: 'ConditionalExpression', test: {}, consequent: {},
 *      alternate: {}}} ast An expression tree with a ConditionalExpression as
 *      the top node
 * @private
 */
exports[TokenType.ConditionalExpression] = function (ast) {
  return this.eval(ast[this.nodeTransformer.transform('test')]).then((res) => {
    if (res) {
      if (ast[this.nodeTransformer.transform('consequent')]) {
        return this.eval(ast[this.nodeTransformer.transform('consequent')])
      }

      return res
    }

    return this.eval(ast[this.nodeTransformer.transform('alternate')])
  })
}

/**
 * Evaluates a FilterExpression by applying it to the subject value.
 * @param {{type: 'FilterExpression', relative: <boolean>, expr: {},
 *      subject: {}}} ast An expression tree with a FilterExpression as the top
 *      node
 * @returns {Promise<*>} resolves with the value of the FilterExpression.
 * @private
 */
exports[TokenType.FilterExpression] = function (ast) {
  return this.eval(ast[this.nodeTransformer.transform('subject')]).then(
    (subject) => {
      if (ast[this.nodeTransformer.transform('relative')]) {
        return this._filterRelative(
          subject,
          ast[this.nodeTransformer.transform('expr')]
        )
      }

      return this._filterStatic(
        subject,
        ast[this.nodeTransformer.transform('expr')]
      )
    }
  )
}

/**
 * Evaluates an Identifier by either stemming from the evaluated 'from'
 * expression tree or accessing the context provided when this Evaluator was
 * constructed.
 * @param {{type: 'Identifier', value: <string>, [from]: {}}} ast An expression
 *      tree with an Identifier as the top node
 * @returns {Promise<*>|*} either the identifier's value, or a Promise that
 *      will resolve with the identifier's value.
 * @private
 */
exports[TokenType.Identifier] = function (ast) {
  const valueNodeName = this.nodeTransformer.transform('value')
  const relativeNodeName = this.nodeTransformer.transform('relative')
  const fromNodeName = this.nodeTransformer.transform('from')

  if (!ast[fromNodeName]) {
    if (ast[valueNodeName] === 'null' && !ast[relativeNodeName]) {
      return null
    }

    if (ast[valueNodeName] === 'undefined' && !ast[relativeNodeName]) {
      return undefined
    }

    if (
      !ast[relativeNodeName] &&
      this.shouldThrowErrorIfVariableIsNotFound() &&
      (!this._context.hasOwnProperty(ast[valueNodeName]) ||
        this._context[ast[valueNodeName]] === undefined)
    ) {
      throw new MissedVariableError(ast[valueNodeName])
    }

    const value = ast[relativeNodeName]
      ? this._relContext[ast[valueNodeName]]
      : this._context[ast[valueNodeName]]

    return value === undefined ? null : value
  }

  return this.eval(ast[fromNodeName]).then((context) => {
    if (context === undefined || context === null) {
      if (this.shouldThrowErrorIfReadPropertyOfNullOrUndefined()) {
        throw new ReadFromEmptyObjectError(ast[valueNodeName], context)
      }

      return this.emptyContextValue
    }

    if (Array.isArray(context)) {
      context = context[0]
    }

    if (!context.hasOwnProperty(ast[valueNodeName])) {
      return undefined
    }

    return context[ast[valueNodeName]]
  })
}

/**
 * Evaluates a Literal by returning its value property.
 * @param {{type: 'Literal', value: <string|number|boolean>}} ast An expression
 *      tree with a Literal as its only node
 * @returns {string|number|boolean} The value of the Literal node
 * @private
 */
exports[TokenType.Literal] = function (ast) {
  return ast[this.nodeTransformer.transform('value')]
}

/**
 * Evaluates an ObjectLiteral by returning its value, with each key
 * independently run through the evaluator.
 * @param {{type: 'ObjectLiteral', value: <{}>}} ast An expression tree with an
 *      ObjectLiteral as the top node
 * @returns {Promise<{}>} resolves to a map contained evaluated values.
 * @private
 */
exports[TokenType.ObjectLiteral] = function (ast) {
  return this.evalMap(ast[this.nodeTransformer.transform('value')])
}

/**
 * Evaluates a FunctionCall node by applying the supplied arguments to a
 * function defined in one of the grammar's function pools.
 * @param {{type: 'FunctionCall', name: <string>}} ast An
 *      expression tree with a FunctionCall as the top node
 * @returns {Promise<*>|*} the value of the function call, or a Promise that
 *      will resolve with the resulting value.
 * @private
 */
exports[TokenType.FunctionCall] = function (ast) {
  const functionName = ast[this.nodeTransformer.transform('name')]
  const func = this._grammar.functions[functionName]

  if (!func) {
    throw new JexlError(`${functionName} is not defined.`)
  }

  return this.evalArray(
    ast[this.nodeTransformer.transform('args')] || []
  ).then((args) => func(...args))
}

/**
 * Evaluates a Unary expression by passing the right side through the
 * operator's eval function.
 * @param {{type: 'UnaryExpression', operator: <string>, right: {}}} ast An
 *      expression tree with a UnaryExpression as the top node
 * @returns {Promise<*>} resolves with the value of the UnaryExpression.
 * @constructor
 */
exports[TokenType.UnaryExpression] = function (ast) {
  return this.eval(ast[this.nodeTransformer.transform('right')]).then(
    (right) => {
      const operator = ast[this.nodeTransformer.transform('operator')]

      return this._grammar.elements[operator].eval(right)
    }
  )
}
