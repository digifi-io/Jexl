export type ICompiledAST = Record<string, unknown>
export type EvalResult =
  | number
  | string
  | boolean
  | null
  | undefined
  | Record<string, unknown>

export interface IJexlExpression {
  getAst(): ICompiledAST
}

export interface ICompileOptions {
  minify?: boolean
}

export interface IEvalOptions {
  strictMode?: boolean
  strictOptions?: {
    disableThrowVariableNotFoundError?: boolean
    disableThrowReadPropertyOfNullOrUndefinedError?: boolean
  }
  emptyContextValue?: number | string | boolean | null
  timeout?: number
}

export class Jexl {
  public static astVersion: number

  public evalSync(
    code: string,
    context: Record<string, unknown>,
    options?: IEvalOptions
  ): EvalResult
  public evalSyncPreCompiled(
    ast: ICompiledAST,
    context: Record<string, unknown>,
    options?: IEvalOptions
  ): EvalResult
  public compile(code: string, options?: ICompileOptions): IJexlExpression
  public findIdentifiersByAst(ast: ICompiledAST): string[]
  public findFunctionNamesByAst(ast: ICompiledAST): string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public addFunctions(map: Record<string, (...args: any[]) => unknown>): void
}

export class JexlError extends Error {}
export class ExecutionError extends JexlError {}

declare const jexl: Jexl
export default jexl
