/*
 * Jexl
 * Copyright 2020 Tom Shawver
 */

const TokenType = require('../constants/TokenType')

/**
 * Handles a subexpression that's used to define a transform argument's value.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.argVal = function (ast) {
  if (ast) {
    this._cursor[this.nodeTransformer.transform('args')].push(ast)
  }
}

/**
 * Handles new array literals by adding them as a new node in the AST,
 * initialized with an empty array.
 */
exports.arrayStart = function () {
  this._placeAtCursor({
    [this.nodeTransformer.transform('type')]: TokenType.ArrayLiteral,
    [this.nodeTransformer.transform('value')]: []
  })
}

/**
 * Handles a subexpression representing an element of an array literal.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.arrayVal = function (ast) {
  if (ast) {
    this._cursor[this.nodeTransformer.transform('value')].push(ast)
  }
}

/**
 * Handles tokens of type 'binaryOp', indicating an operation that has two
 * inputs: a left side and a right side.
 * @param {{type: <string>}} token A token object
 */
exports.binaryOp = function (token) {
  const precedence = this._grammar.elements[token.value].precedence || 0
  let parent = this._cursor._parent

  while (
    parent &&
    parent[this.nodeTransformer.transform('operator')] &&
    this._grammar.elements[parent[this.nodeTransformer.transform('operator')]]
      .precedence >= precedence
  ) {
    this._cursor = parent
    parent = parent._parent
  }

  const node = {
    [this.nodeTransformer.transform('type')]: TokenType.BinaryExpression,
    [this.nodeTransformer.transform('operator')]: token.value,
    [this.nodeTransformer.transform('left')]: this._cursor
  }

  this._setParent(this._cursor, node)
  this._cursor = parent
  this._placeAtCursor(node)
}

/**
 * Handles successive nodes in an identifier chain.  More specifically, it
 * sets values that determine how the following identifier gets placed in the
 * AST.
 */
exports.dot = function () {
  this._nextIdentEncapsulate =
    this._cursor &&
    this._cursor[this.nodeTransformer.transform('type')] !==
      TokenType.UnaryExpression &&
    (this._cursor[this.nodeTransformer.transform('type')] !==
      TokenType.BinaryExpression ||
      (this._cursor[this.nodeTransformer.transform('type')] ===
        TokenType.BinaryExpression &&
        this._cursor[this.nodeTransformer.transform('right')]))
  this._nextIdentRelative =
    !this._cursor || (this._cursor && !this._nextIdentEncapsulate)
  if (this._nextIdentRelative) {
    this._relative = true
  }
}

/**
 * Handles a subexpression used for filtering an array returned by an
 * identifier chain.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.filter = function (ast) {
  this._placeBeforeCursor({
    [this.nodeTransformer.transform('type')]: TokenType.FilterExpression,
    [this.nodeTransformer.transform('expr')]: ast,
    [this.nodeTransformer.transform('relative')]: this._subParser.isRelative(),
    [this.nodeTransformer.transform('subject')]: this._cursor
  })
}

/**
 * Handles identifier tokens when used to indicate the name of a function to
 * be called.
 * @param {{type: <string>}} token A token object
 */
exports.functionCall = function () {
  if (!this._cursor[this.nodeTransformer.transform('value')]) {
    throw new Error('Function call should have name.')
  }

  this._placeBeforeCursor({
    [this.nodeTransformer.transform('type')]: TokenType.FunctionCall,
    [this.nodeTransformer.transform('name')]: this._cursor[
      this.nodeTransformer.transform('value')
    ],
    [this.nodeTransformer.transform('args')]: [],
    start: this._cursor.start,
    end: this._cursor.end
  })
}

/**
 * Handles identifier tokens by adding them as a new node in the AST.
 * @param {{type: <string>}} token A token object
 */
exports.identifier = function (token) {
  const node = {
    [this.nodeTransformer.transform('type')]: TokenType.Identifier,
    [this.nodeTransformer.transform('value')]: token.value,
    ...(this._minify ? {} : { start: token.start }),
    ...(this._minify ? {} : { end: token.end })
  }

  if (this._nextIdentEncapsulate) {
    node[this.nodeTransformer.transform('from')] = this._cursor
    this._placeBeforeCursor(node)
    this._nextIdentEncapsulate = false
  } else {
    if (this._nextIdentRelative) {
      node[this.nodeTransformer.transform('relative')] = true
      this._nextIdentRelative = false
    }

    this._placeAtCursor(node)
  }
}

/**
 * Handles literal values, such as strings, booleans, and numerics, by adding
 * them as a new node in the AST.
 * @param {{type: <string>}} token A token object
 */
exports.literal = function (token) {
  this._placeAtCursor({
    [this.nodeTransformer.transform('type')]: TokenType.Literal,
    [this.nodeTransformer.transform('value')]: token.value
  })
}

/**
 * Queues a new object literal key to be written once a value is collected.
 * @param {{type: <string>}} token A token object
 */
exports.objKey = function (token) {
  this._curObjKey = token.value
}

/**
 * Handles new object literals by adding them as a new node in the AST,
 * initialized with an empty object.
 */
exports.objStart = function () {
  this._placeAtCursor({
    [this.nodeTransformer.transform('type')]: TokenType.ObjectLiteral,
    [this.nodeTransformer.transform('value')]: {}
  })
}

/**
 * Handles an object value by adding its AST to the queued key on the object
 * literal node currently at the cursor.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.objVal = function (ast) {
  this._cursor[this.nodeTransformer.transform('value')][this._curObjKey] = ast
}

/**
 * Handles traditional subexpressions, delineated with the groupStart and
 * groupEnd elements.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.subExpression = function (ast) {
  this._placeAtCursor(ast)
}

/**
 * Handles a completed alternate subexpression of a ternary operator.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.ternaryEnd = function (ast) {
  this._cursor[this.nodeTransformer.transform('alternate')] = ast
}

/**
 * Handles a completed consequent subexpression of a ternary operator.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.ternaryMid = function (ast) {
  this._cursor[this.nodeTransformer.transform('consequent')] = ast
}

/**
 * Handles the start of a new ternary expression by encapsulating the entire
 * AST in a ConditionalExpression node, and using the existing tree as the
 * test element.
 */
exports.ternaryStart = function () {
  this._tree = {
    [this.nodeTransformer.transform('type')]: TokenType.ConditionalExpression,
    [this.nodeTransformer.transform('test')]: this._tree
  }

  this._cursor = this._tree
}

/**
 * Handles token of type 'unaryOp', indicating that the operation has only
 * one input: a right side.
 * @param {{type: <string>}} token A token object
 */
exports.unaryOp = function (token) {
  this._placeAtCursor({
    [this.nodeTransformer.transform('type')]: TokenType.UnaryExpression,
    [this.nodeTransformer.transform('operator')]: token.value
  })
}
