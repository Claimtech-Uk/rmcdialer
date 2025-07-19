
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model Claim
 * 
 */
export type Claim = $Result.DefaultSelection<Prisma.$ClaimPayload>
/**
 * Model UserAddress
 * 
 */
export type UserAddress = $Result.DefaultSelection<Prisma.$UserAddressPayload>
/**
 * Model ClaimRequirement
 * 
 */
export type ClaimRequirement = $Result.DefaultSelection<Prisma.$ClaimRequirementPayload>
/**
 * Model ClaimVehiclePackage
 * 
 */
export type ClaimVehiclePackage = $Result.DefaultSelection<Prisma.$ClaimVehiclePackagePayload>
/**
 * Model UserLog
 * 
 */
export type UserLog = $Result.DefaultSelection<Prisma.$UserLogPayload>

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs>;

  /**
   * `prisma.claim`: Exposes CRUD operations for the **Claim** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Claims
    * const claims = await prisma.claim.findMany()
    * ```
    */
  get claim(): Prisma.ClaimDelegate<ExtArgs>;

  /**
   * `prisma.userAddress`: Exposes CRUD operations for the **UserAddress** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UserAddresses
    * const userAddresses = await prisma.userAddress.findMany()
    * ```
    */
  get userAddress(): Prisma.UserAddressDelegate<ExtArgs>;

  /**
   * `prisma.claimRequirement`: Exposes CRUD operations for the **ClaimRequirement** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ClaimRequirements
    * const claimRequirements = await prisma.claimRequirement.findMany()
    * ```
    */
  get claimRequirement(): Prisma.ClaimRequirementDelegate<ExtArgs>;

  /**
   * `prisma.claimVehiclePackage`: Exposes CRUD operations for the **ClaimVehiclePackage** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ClaimVehiclePackages
    * const claimVehiclePackages = await prisma.claimVehiclePackage.findMany()
    * ```
    */
  get claimVehiclePackage(): Prisma.ClaimVehiclePackageDelegate<ExtArgs>;

  /**
   * `prisma.userLog`: Exposes CRUD operations for the **UserLog** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UserLogs
    * const userLogs = await prisma.userLog.findMany()
    * ```
    */
  get userLog(): Prisma.UserLogDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 5.22.0
   * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    Claim: 'Claim',
    UserAddress: 'UserAddress',
    ClaimRequirement: 'ClaimRequirement',
    ClaimVehiclePackage: 'ClaimVehiclePackage',
    UserLog: 'UserLog'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs, clientOptions: PrismaClientOptions }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], this['params']['clientOptions']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> = {
    meta: {
      modelProps: "user" | "claim" | "userAddress" | "claimRequirement" | "claimVehiclePackage" | "userLog"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      Claim: {
        payload: Prisma.$ClaimPayload<ExtArgs>
        fields: Prisma.ClaimFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ClaimFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ClaimFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimPayload>
          }
          findFirst: {
            args: Prisma.ClaimFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ClaimFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimPayload>
          }
          findMany: {
            args: Prisma.ClaimFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimPayload>[]
          }
          create: {
            args: Prisma.ClaimCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimPayload>
          }
          createMany: {
            args: Prisma.ClaimCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.ClaimDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimPayload>
          }
          update: {
            args: Prisma.ClaimUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimPayload>
          }
          deleteMany: {
            args: Prisma.ClaimDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ClaimUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ClaimUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimPayload>
          }
          aggregate: {
            args: Prisma.ClaimAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateClaim>
          }
          groupBy: {
            args: Prisma.ClaimGroupByArgs<ExtArgs>
            result: $Utils.Optional<ClaimGroupByOutputType>[]
          }
          count: {
            args: Prisma.ClaimCountArgs<ExtArgs>
            result: $Utils.Optional<ClaimCountAggregateOutputType> | number
          }
        }
      }
      UserAddress: {
        payload: Prisma.$UserAddressPayload<ExtArgs>
        fields: Prisma.UserAddressFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserAddressFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAddressPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserAddressFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAddressPayload>
          }
          findFirst: {
            args: Prisma.UserAddressFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAddressPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserAddressFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAddressPayload>
          }
          findMany: {
            args: Prisma.UserAddressFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAddressPayload>[]
          }
          create: {
            args: Prisma.UserAddressCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAddressPayload>
          }
          createMany: {
            args: Prisma.UserAddressCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.UserAddressDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAddressPayload>
          }
          update: {
            args: Prisma.UserAddressUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAddressPayload>
          }
          deleteMany: {
            args: Prisma.UserAddressDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserAddressUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.UserAddressUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAddressPayload>
          }
          aggregate: {
            args: Prisma.UserAddressAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUserAddress>
          }
          groupBy: {
            args: Prisma.UserAddressGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserAddressGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserAddressCountArgs<ExtArgs>
            result: $Utils.Optional<UserAddressCountAggregateOutputType> | number
          }
        }
      }
      ClaimRequirement: {
        payload: Prisma.$ClaimRequirementPayload<ExtArgs>
        fields: Prisma.ClaimRequirementFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ClaimRequirementFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimRequirementPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ClaimRequirementFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimRequirementPayload>
          }
          findFirst: {
            args: Prisma.ClaimRequirementFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimRequirementPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ClaimRequirementFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimRequirementPayload>
          }
          findMany: {
            args: Prisma.ClaimRequirementFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimRequirementPayload>[]
          }
          create: {
            args: Prisma.ClaimRequirementCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimRequirementPayload>
          }
          createMany: {
            args: Prisma.ClaimRequirementCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.ClaimRequirementDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimRequirementPayload>
          }
          update: {
            args: Prisma.ClaimRequirementUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimRequirementPayload>
          }
          deleteMany: {
            args: Prisma.ClaimRequirementDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ClaimRequirementUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ClaimRequirementUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimRequirementPayload>
          }
          aggregate: {
            args: Prisma.ClaimRequirementAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateClaimRequirement>
          }
          groupBy: {
            args: Prisma.ClaimRequirementGroupByArgs<ExtArgs>
            result: $Utils.Optional<ClaimRequirementGroupByOutputType>[]
          }
          count: {
            args: Prisma.ClaimRequirementCountArgs<ExtArgs>
            result: $Utils.Optional<ClaimRequirementCountAggregateOutputType> | number
          }
        }
      }
      ClaimVehiclePackage: {
        payload: Prisma.$ClaimVehiclePackagePayload<ExtArgs>
        fields: Prisma.ClaimVehiclePackageFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ClaimVehiclePackageFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimVehiclePackagePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ClaimVehiclePackageFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimVehiclePackagePayload>
          }
          findFirst: {
            args: Prisma.ClaimVehiclePackageFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimVehiclePackagePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ClaimVehiclePackageFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimVehiclePackagePayload>
          }
          findMany: {
            args: Prisma.ClaimVehiclePackageFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimVehiclePackagePayload>[]
          }
          create: {
            args: Prisma.ClaimVehiclePackageCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimVehiclePackagePayload>
          }
          createMany: {
            args: Prisma.ClaimVehiclePackageCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.ClaimVehiclePackageDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimVehiclePackagePayload>
          }
          update: {
            args: Prisma.ClaimVehiclePackageUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimVehiclePackagePayload>
          }
          deleteMany: {
            args: Prisma.ClaimVehiclePackageDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ClaimVehiclePackageUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ClaimVehiclePackageUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimVehiclePackagePayload>
          }
          aggregate: {
            args: Prisma.ClaimVehiclePackageAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateClaimVehiclePackage>
          }
          groupBy: {
            args: Prisma.ClaimVehiclePackageGroupByArgs<ExtArgs>
            result: $Utils.Optional<ClaimVehiclePackageGroupByOutputType>[]
          }
          count: {
            args: Prisma.ClaimVehiclePackageCountArgs<ExtArgs>
            result: $Utils.Optional<ClaimVehiclePackageCountAggregateOutputType> | number
          }
        }
      }
      UserLog: {
        payload: Prisma.$UserLogPayload<ExtArgs>
        fields: Prisma.UserLogFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserLogFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserLogPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserLogFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserLogPayload>
          }
          findFirst: {
            args: Prisma.UserLogFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserLogPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserLogFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserLogPayload>
          }
          findMany: {
            args: Prisma.UserLogFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserLogPayload>[]
          }
          create: {
            args: Prisma.UserLogCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserLogPayload>
          }
          createMany: {
            args: Prisma.UserLogCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          delete: {
            args: Prisma.UserLogDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserLogPayload>
          }
          update: {
            args: Prisma.UserLogUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserLogPayload>
          }
          deleteMany: {
            args: Prisma.UserLogDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserLogUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.UserLogUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserLogPayload>
          }
          aggregate: {
            args: Prisma.UserLogAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUserLog>
          }
          groupBy: {
            args: Prisma.UserLogGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserLogGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserLogCountArgs<ExtArgs>
            result: $Utils.Optional<UserLogCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
  }


  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    claims: number
    user_logs: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    claims?: boolean | UserCountOutputTypeCountClaimsArgs
    user_logs?: boolean | UserCountOutputTypeCountUser_logsArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountClaimsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClaimWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountUser_logsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserLogWhereInput
  }


  /**
   * Count Type ClaimCountOutputType
   */

  export type ClaimCountOutputType = {
    requirements: number
    vehiclePackages: number
  }

  export type ClaimCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    requirements?: boolean | ClaimCountOutputTypeCountRequirementsArgs
    vehiclePackages?: boolean | ClaimCountOutputTypeCountVehiclePackagesArgs
  }

  // Custom InputTypes
  /**
   * ClaimCountOutputType without action
   */
  export type ClaimCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimCountOutputType
     */
    select?: ClaimCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ClaimCountOutputType without action
   */
  export type ClaimCountOutputTypeCountRequirementsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClaimRequirementWhereInput
  }

  /**
   * ClaimCountOutputType without action
   */
  export type ClaimCountOutputTypeCountVehiclePackagesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClaimVehiclePackageWhereInput
  }


  /**
   * Count Type UserAddressCountOutputType
   */

  export type UserAddressCountOutputType = {
    users: number
  }

  export type UserAddressCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    users?: boolean | UserAddressCountOutputTypeCountUsersArgs
  }

  // Custom InputTypes
  /**
   * UserAddressCountOutputType without action
   */
  export type UserAddressCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAddressCountOutputType
     */
    select?: UserAddressCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserAddressCountOutputType without action
   */
  export type UserAddressCountOutputTypeCountUsersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserAvgAggregateOutputType = {
    id: number | null
    justcall_id: number | null
  }

  export type UserSumAggregateOutputType = {
    id: bigint | null
    justcall_id: number | null
  }

  export type UserMinAggregateOutputType = {
    id: bigint | null
    email_address: string | null
    password: string | null
    is_enabled: boolean | null
    status: string | null
    first_name: string | null
    last_name: string | null
    phone_number: string | null
    date_of_birth: Date | null
    previous_name: string | null
    current_user_address_id: string | null
    current_user_id_document_id: string | null
    current_signature_file_id: string | null
    third_party_claim_partner: string | null
    introducer: string | null
    solicitor: string | null
    credit_response_selection_completed: boolean | null
    justcall_id: number | null
    voluum_click_id: string | null
    pipedrive_id: string | null
    google_drive_link: string | null
    last_login: Date | null
    remember_token: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: bigint | null
    email_address: string | null
    password: string | null
    is_enabled: boolean | null
    status: string | null
    first_name: string | null
    last_name: string | null
    phone_number: string | null
    date_of_birth: Date | null
    previous_name: string | null
    current_user_address_id: string | null
    current_user_id_document_id: string | null
    current_signature_file_id: string | null
    third_party_claim_partner: string | null
    introducer: string | null
    solicitor: string | null
    credit_response_selection_completed: boolean | null
    justcall_id: number | null
    voluum_click_id: string | null
    pipedrive_id: string | null
    google_drive_link: string | null
    last_login: Date | null
    remember_token: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email_address: number
    password: number
    is_enabled: number
    status: number
    first_name: number
    last_name: number
    phone_number: number
    date_of_birth: number
    previous_name: number
    current_user_address_id: number
    current_user_id_document_id: number
    current_signature_file_id: number
    notification_channels: number
    third_party_claim_partner: number
    introducer: number
    solicitor: number
    credit_response_selection_completed: number
    justcall_id: number
    voluum_click_id: number
    pipedrive_id: number
    google_drive_link: number
    last_login: number
    remember_token: number
    checkboard_address_links_api_request: number
    checkboard_address_links_api_response: number
    checkboard_user_invite_api_request: number
    checkboard_user_batch_api_request: number
    checkboard_user_verify_otp_api_request: number
    created_at: number
    updated_at: number
    _all: number
  }


  export type UserAvgAggregateInputType = {
    id?: true
    justcall_id?: true
  }

  export type UserSumAggregateInputType = {
    id?: true
    justcall_id?: true
  }

  export type UserMinAggregateInputType = {
    id?: true
    email_address?: true
    password?: true
    is_enabled?: true
    status?: true
    first_name?: true
    last_name?: true
    phone_number?: true
    date_of_birth?: true
    previous_name?: true
    current_user_address_id?: true
    current_user_id_document_id?: true
    current_signature_file_id?: true
    third_party_claim_partner?: true
    introducer?: true
    solicitor?: true
    credit_response_selection_completed?: true
    justcall_id?: true
    voluum_click_id?: true
    pipedrive_id?: true
    google_drive_link?: true
    last_login?: true
    remember_token?: true
    created_at?: true
    updated_at?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email_address?: true
    password?: true
    is_enabled?: true
    status?: true
    first_name?: true
    last_name?: true
    phone_number?: true
    date_of_birth?: true
    previous_name?: true
    current_user_address_id?: true
    current_user_id_document_id?: true
    current_signature_file_id?: true
    third_party_claim_partner?: true
    introducer?: true
    solicitor?: true
    credit_response_selection_completed?: true
    justcall_id?: true
    voluum_click_id?: true
    pipedrive_id?: true
    google_drive_link?: true
    last_login?: true
    remember_token?: true
    created_at?: true
    updated_at?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email_address?: true
    password?: true
    is_enabled?: true
    status?: true
    first_name?: true
    last_name?: true
    phone_number?: true
    date_of_birth?: true
    previous_name?: true
    current_user_address_id?: true
    current_user_id_document_id?: true
    current_signature_file_id?: true
    notification_channels?: true
    third_party_claim_partner?: true
    introducer?: true
    solicitor?: true
    credit_response_selection_completed?: true
    justcall_id?: true
    voluum_click_id?: true
    pipedrive_id?: true
    google_drive_link?: true
    last_login?: true
    remember_token?: true
    checkboard_address_links_api_request?: true
    checkboard_address_links_api_response?: true
    checkboard_user_invite_api_request?: true
    checkboard_user_batch_api_request?: true
    checkboard_user_verify_otp_api_request?: true
    created_at?: true
    updated_at?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _avg?: UserAvgAggregateInputType
    _sum?: UserSumAggregateInputType
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: bigint
    email_address: string | null
    password: string | null
    is_enabled: boolean
    status: string | null
    first_name: string | null
    last_name: string | null
    phone_number: string | null
    date_of_birth: Date | null
    previous_name: string | null
    current_user_address_id: string | null
    current_user_id_document_id: string | null
    current_signature_file_id: string | null
    notification_channels: JsonValue | null
    third_party_claim_partner: string | null
    introducer: string
    solicitor: string | null
    credit_response_selection_completed: boolean
    justcall_id: number | null
    voluum_click_id: string | null
    pipedrive_id: string | null
    google_drive_link: string | null
    last_login: Date | null
    remember_token: string | null
    checkboard_address_links_api_request: JsonValue | null
    checkboard_address_links_api_response: JsonValue | null
    checkboard_user_invite_api_request: JsonValue | null
    checkboard_user_batch_api_request: JsonValue | null
    checkboard_user_verify_otp_api_request: JsonValue | null
    created_at: Date | null
    updated_at: Date | null
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email_address?: boolean
    password?: boolean
    is_enabled?: boolean
    status?: boolean
    first_name?: boolean
    last_name?: boolean
    phone_number?: boolean
    date_of_birth?: boolean
    previous_name?: boolean
    current_user_address_id?: boolean
    current_user_id_document_id?: boolean
    current_signature_file_id?: boolean
    notification_channels?: boolean
    third_party_claim_partner?: boolean
    introducer?: boolean
    solicitor?: boolean
    credit_response_selection_completed?: boolean
    justcall_id?: boolean
    voluum_click_id?: boolean
    pipedrive_id?: boolean
    google_drive_link?: boolean
    last_login?: boolean
    remember_token?: boolean
    checkboard_address_links_api_request?: boolean
    checkboard_address_links_api_response?: boolean
    checkboard_user_invite_api_request?: boolean
    checkboard_user_batch_api_request?: boolean
    checkboard_user_verify_otp_api_request?: boolean
    created_at?: boolean
    updated_at?: boolean
    claims?: boolean | User$claimsArgs<ExtArgs>
    address?: boolean | User$addressArgs<ExtArgs>
    user_logs?: boolean | User$user_logsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>


  export type UserSelectScalar = {
    id?: boolean
    email_address?: boolean
    password?: boolean
    is_enabled?: boolean
    status?: boolean
    first_name?: boolean
    last_name?: boolean
    phone_number?: boolean
    date_of_birth?: boolean
    previous_name?: boolean
    current_user_address_id?: boolean
    current_user_id_document_id?: boolean
    current_signature_file_id?: boolean
    notification_channels?: boolean
    third_party_claim_partner?: boolean
    introducer?: boolean
    solicitor?: boolean
    credit_response_selection_completed?: boolean
    justcall_id?: boolean
    voluum_click_id?: boolean
    pipedrive_id?: boolean
    google_drive_link?: boolean
    last_login?: boolean
    remember_token?: boolean
    checkboard_address_links_api_request?: boolean
    checkboard_address_links_api_response?: boolean
    checkboard_user_invite_api_request?: boolean
    checkboard_user_batch_api_request?: boolean
    checkboard_user_verify_otp_api_request?: boolean
    created_at?: boolean
    updated_at?: boolean
  }

  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    claims?: boolean | User$claimsArgs<ExtArgs>
    address?: boolean | User$addressArgs<ExtArgs>
    user_logs?: boolean | User$user_logsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      claims: Prisma.$ClaimPayload<ExtArgs>[]
      address: Prisma.$UserAddressPayload<ExtArgs> | null
      user_logs: Prisma.$UserLogPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: bigint
      email_address: string | null
      password: string | null
      is_enabled: boolean
      status: string | null
      first_name: string | null
      last_name: string | null
      phone_number: string | null
      date_of_birth: Date | null
      previous_name: string | null
      current_user_address_id: string | null
      current_user_id_document_id: string | null
      current_signature_file_id: string | null
      notification_channels: Prisma.JsonValue | null
      third_party_claim_partner: string | null
      introducer: string
      solicitor: string | null
      credit_response_selection_completed: boolean
      justcall_id: number | null
      voluum_click_id: string | null
      pipedrive_id: string | null
      google_drive_link: string | null
      last_login: Date | null
      remember_token: string | null
      checkboard_address_links_api_request: Prisma.JsonValue | null
      checkboard_address_links_api_response: Prisma.JsonValue | null
      checkboard_user_invite_api_request: Prisma.JsonValue | null
      checkboard_user_batch_api_request: Prisma.JsonValue | null
      checkboard_user_verify_otp_api_request: Prisma.JsonValue | null
      created_at: Date | null
      updated_at: Date | null
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    claims<T extends User$claimsArgs<ExtArgs> = {}>(args?: Subset<T, User$claimsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClaimPayload<ExtArgs>, T, "findMany"> | Null>
    address<T extends User$addressArgs<ExtArgs> = {}>(args?: Subset<T, User$addressArgs<ExtArgs>>): Prisma__UserAddressClient<$Result.GetResult<Prisma.$UserAddressPayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    user_logs<T extends User$user_logsArgs<ExtArgs> = {}>(args?: Subset<T, User$user_logsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserLogPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */ 
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'BigInt'>
    readonly email_address: FieldRef<"User", 'String'>
    readonly password: FieldRef<"User", 'String'>
    readonly is_enabled: FieldRef<"User", 'Boolean'>
    readonly status: FieldRef<"User", 'String'>
    readonly first_name: FieldRef<"User", 'String'>
    readonly last_name: FieldRef<"User", 'String'>
    readonly phone_number: FieldRef<"User", 'String'>
    readonly date_of_birth: FieldRef<"User", 'DateTime'>
    readonly previous_name: FieldRef<"User", 'String'>
    readonly current_user_address_id: FieldRef<"User", 'String'>
    readonly current_user_id_document_id: FieldRef<"User", 'String'>
    readonly current_signature_file_id: FieldRef<"User", 'String'>
    readonly notification_channels: FieldRef<"User", 'Json'>
    readonly third_party_claim_partner: FieldRef<"User", 'String'>
    readonly introducer: FieldRef<"User", 'String'>
    readonly solicitor: FieldRef<"User", 'String'>
    readonly credit_response_selection_completed: FieldRef<"User", 'Boolean'>
    readonly justcall_id: FieldRef<"User", 'Int'>
    readonly voluum_click_id: FieldRef<"User", 'String'>
    readonly pipedrive_id: FieldRef<"User", 'String'>
    readonly google_drive_link: FieldRef<"User", 'String'>
    readonly last_login: FieldRef<"User", 'DateTime'>
    readonly remember_token: FieldRef<"User", 'String'>
    readonly checkboard_address_links_api_request: FieldRef<"User", 'Json'>
    readonly checkboard_address_links_api_response: FieldRef<"User", 'Json'>
    readonly checkboard_user_invite_api_request: FieldRef<"User", 'Json'>
    readonly checkboard_user_batch_api_request: FieldRef<"User", 'Json'>
    readonly checkboard_user_verify_otp_api_request: FieldRef<"User", 'Json'>
    readonly created_at: FieldRef<"User", 'DateTime'>
    readonly updated_at: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
  }

  /**
   * User.claims
   */
  export type User$claimsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Claim
     */
    select?: ClaimSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimInclude<ExtArgs> | null
    where?: ClaimWhereInput
    orderBy?: ClaimOrderByWithRelationInput | ClaimOrderByWithRelationInput[]
    cursor?: ClaimWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ClaimScalarFieldEnum | ClaimScalarFieldEnum[]
  }

  /**
   * User.address
   */
  export type User$addressArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAddress
     */
    select?: UserAddressSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAddressInclude<ExtArgs> | null
    where?: UserAddressWhereInput
  }

  /**
   * User.user_logs
   */
  export type User$user_logsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserLog
     */
    select?: UserLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserLogInclude<ExtArgs> | null
    where?: UserLogWhereInput
    orderBy?: UserLogOrderByWithRelationInput | UserLogOrderByWithRelationInput[]
    cursor?: UserLogWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserLogScalarFieldEnum | UserLogScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model Claim
   */

  export type AggregateClaim = {
    _count: ClaimCountAggregateOutputType | null
    _avg: ClaimAvgAggregateOutputType | null
    _sum: ClaimSumAggregateOutputType | null
    _min: ClaimMinAggregateOutputType | null
    _max: ClaimMaxAggregateOutputType | null
  }

  export type ClaimAvgAggregateOutputType = {
    id: number | null
    user_id: number | null
  }

  export type ClaimSumAggregateOutputType = {
    id: bigint | null
    user_id: bigint | null
  }

  export type ClaimMinAggregateOutputType = {
    id: bigint | null
    user_id: bigint | null
    type: string | null
    status: string | null
    lender: string | null
    solicitor: string | null
    client_last_updated_at: Date | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type ClaimMaxAggregateOutputType = {
    id: bigint | null
    user_id: bigint | null
    type: string | null
    status: string | null
    lender: string | null
    solicitor: string | null
    client_last_updated_at: Date | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type ClaimCountAggregateOutputType = {
    id: number
    user_id: number
    type: number
    status: number
    lender: number
    solicitor: number
    client_last_updated_at: number
    created_at: number
    updated_at: number
    _all: number
  }


  export type ClaimAvgAggregateInputType = {
    id?: true
    user_id?: true
  }

  export type ClaimSumAggregateInputType = {
    id?: true
    user_id?: true
  }

  export type ClaimMinAggregateInputType = {
    id?: true
    user_id?: true
    type?: true
    status?: true
    lender?: true
    solicitor?: true
    client_last_updated_at?: true
    created_at?: true
    updated_at?: true
  }

  export type ClaimMaxAggregateInputType = {
    id?: true
    user_id?: true
    type?: true
    status?: true
    lender?: true
    solicitor?: true
    client_last_updated_at?: true
    created_at?: true
    updated_at?: true
  }

  export type ClaimCountAggregateInputType = {
    id?: true
    user_id?: true
    type?: true
    status?: true
    lender?: true
    solicitor?: true
    client_last_updated_at?: true
    created_at?: true
    updated_at?: true
    _all?: true
  }

  export type ClaimAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Claim to aggregate.
     */
    where?: ClaimWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Claims to fetch.
     */
    orderBy?: ClaimOrderByWithRelationInput | ClaimOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ClaimWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Claims from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Claims.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Claims
    **/
    _count?: true | ClaimCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ClaimAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ClaimSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ClaimMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ClaimMaxAggregateInputType
  }

  export type GetClaimAggregateType<T extends ClaimAggregateArgs> = {
        [P in keyof T & keyof AggregateClaim]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateClaim[P]>
      : GetScalarType<T[P], AggregateClaim[P]>
  }




  export type ClaimGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClaimWhereInput
    orderBy?: ClaimOrderByWithAggregationInput | ClaimOrderByWithAggregationInput[]
    by: ClaimScalarFieldEnum[] | ClaimScalarFieldEnum
    having?: ClaimScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ClaimCountAggregateInputType | true
    _avg?: ClaimAvgAggregateInputType
    _sum?: ClaimSumAggregateInputType
    _min?: ClaimMinAggregateInputType
    _max?: ClaimMaxAggregateInputType
  }

  export type ClaimGroupByOutputType = {
    id: bigint
    user_id: bigint
    type: string | null
    status: string | null
    lender: string | null
    solicitor: string | null
    client_last_updated_at: Date | null
    created_at: Date | null
    updated_at: Date | null
    _count: ClaimCountAggregateOutputType | null
    _avg: ClaimAvgAggregateOutputType | null
    _sum: ClaimSumAggregateOutputType | null
    _min: ClaimMinAggregateOutputType | null
    _max: ClaimMaxAggregateOutputType | null
  }

  type GetClaimGroupByPayload<T extends ClaimGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ClaimGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ClaimGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ClaimGroupByOutputType[P]>
            : GetScalarType<T[P], ClaimGroupByOutputType[P]>
        }
      >
    >


  export type ClaimSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    type?: boolean
    status?: boolean
    lender?: boolean
    solicitor?: boolean
    client_last_updated_at?: boolean
    created_at?: boolean
    updated_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    requirements?: boolean | Claim$requirementsArgs<ExtArgs>
    vehiclePackages?: boolean | Claim$vehiclePackagesArgs<ExtArgs>
    _count?: boolean | ClaimCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["claim"]>


  export type ClaimSelectScalar = {
    id?: boolean
    user_id?: boolean
    type?: boolean
    status?: boolean
    lender?: boolean
    solicitor?: boolean
    client_last_updated_at?: boolean
    created_at?: boolean
    updated_at?: boolean
  }

  export type ClaimInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    requirements?: boolean | Claim$requirementsArgs<ExtArgs>
    vehiclePackages?: boolean | Claim$vehiclePackagesArgs<ExtArgs>
    _count?: boolean | ClaimCountOutputTypeDefaultArgs<ExtArgs>
  }

  export type $ClaimPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Claim"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      requirements: Prisma.$ClaimRequirementPayload<ExtArgs>[]
      vehiclePackages: Prisma.$ClaimVehiclePackagePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: bigint
      user_id: bigint
      type: string | null
      status: string | null
      lender: string | null
      solicitor: string | null
      client_last_updated_at: Date | null
      created_at: Date | null
      updated_at: Date | null
    }, ExtArgs["result"]["claim"]>
    composites: {}
  }

  type ClaimGetPayload<S extends boolean | null | undefined | ClaimDefaultArgs> = $Result.GetResult<Prisma.$ClaimPayload, S>

  type ClaimCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ClaimFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ClaimCountAggregateInputType | true
    }

  export interface ClaimDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Claim'], meta: { name: 'Claim' } }
    /**
     * Find zero or one Claim that matches the filter.
     * @param {ClaimFindUniqueArgs} args - Arguments to find a Claim
     * @example
     * // Get one Claim
     * const claim = await prisma.claim.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ClaimFindUniqueArgs>(args: SelectSubset<T, ClaimFindUniqueArgs<ExtArgs>>): Prisma__ClaimClient<$Result.GetResult<Prisma.$ClaimPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Claim that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ClaimFindUniqueOrThrowArgs} args - Arguments to find a Claim
     * @example
     * // Get one Claim
     * const claim = await prisma.claim.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ClaimFindUniqueOrThrowArgs>(args: SelectSubset<T, ClaimFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ClaimClient<$Result.GetResult<Prisma.$ClaimPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Claim that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimFindFirstArgs} args - Arguments to find a Claim
     * @example
     * // Get one Claim
     * const claim = await prisma.claim.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ClaimFindFirstArgs>(args?: SelectSubset<T, ClaimFindFirstArgs<ExtArgs>>): Prisma__ClaimClient<$Result.GetResult<Prisma.$ClaimPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Claim that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimFindFirstOrThrowArgs} args - Arguments to find a Claim
     * @example
     * // Get one Claim
     * const claim = await prisma.claim.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ClaimFindFirstOrThrowArgs>(args?: SelectSubset<T, ClaimFindFirstOrThrowArgs<ExtArgs>>): Prisma__ClaimClient<$Result.GetResult<Prisma.$ClaimPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Claims that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Claims
     * const claims = await prisma.claim.findMany()
     * 
     * // Get first 10 Claims
     * const claims = await prisma.claim.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const claimWithIdOnly = await prisma.claim.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ClaimFindManyArgs>(args?: SelectSubset<T, ClaimFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClaimPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Claim.
     * @param {ClaimCreateArgs} args - Arguments to create a Claim.
     * @example
     * // Create one Claim
     * const Claim = await prisma.claim.create({
     *   data: {
     *     // ... data to create a Claim
     *   }
     * })
     * 
     */
    create<T extends ClaimCreateArgs>(args: SelectSubset<T, ClaimCreateArgs<ExtArgs>>): Prisma__ClaimClient<$Result.GetResult<Prisma.$ClaimPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Claims.
     * @param {ClaimCreateManyArgs} args - Arguments to create many Claims.
     * @example
     * // Create many Claims
     * const claim = await prisma.claim.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ClaimCreateManyArgs>(args?: SelectSubset<T, ClaimCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Claim.
     * @param {ClaimDeleteArgs} args - Arguments to delete one Claim.
     * @example
     * // Delete one Claim
     * const Claim = await prisma.claim.delete({
     *   where: {
     *     // ... filter to delete one Claim
     *   }
     * })
     * 
     */
    delete<T extends ClaimDeleteArgs>(args: SelectSubset<T, ClaimDeleteArgs<ExtArgs>>): Prisma__ClaimClient<$Result.GetResult<Prisma.$ClaimPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Claim.
     * @param {ClaimUpdateArgs} args - Arguments to update one Claim.
     * @example
     * // Update one Claim
     * const claim = await prisma.claim.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ClaimUpdateArgs>(args: SelectSubset<T, ClaimUpdateArgs<ExtArgs>>): Prisma__ClaimClient<$Result.GetResult<Prisma.$ClaimPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Claims.
     * @param {ClaimDeleteManyArgs} args - Arguments to filter Claims to delete.
     * @example
     * // Delete a few Claims
     * const { count } = await prisma.claim.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ClaimDeleteManyArgs>(args?: SelectSubset<T, ClaimDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Claims.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Claims
     * const claim = await prisma.claim.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ClaimUpdateManyArgs>(args: SelectSubset<T, ClaimUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Claim.
     * @param {ClaimUpsertArgs} args - Arguments to update or create a Claim.
     * @example
     * // Update or create a Claim
     * const claim = await prisma.claim.upsert({
     *   create: {
     *     // ... data to create a Claim
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Claim we want to update
     *   }
     * })
     */
    upsert<T extends ClaimUpsertArgs>(args: SelectSubset<T, ClaimUpsertArgs<ExtArgs>>): Prisma__ClaimClient<$Result.GetResult<Prisma.$ClaimPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Claims.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimCountArgs} args - Arguments to filter Claims to count.
     * @example
     * // Count the number of Claims
     * const count = await prisma.claim.count({
     *   where: {
     *     // ... the filter for the Claims we want to count
     *   }
     * })
    **/
    count<T extends ClaimCountArgs>(
      args?: Subset<T, ClaimCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ClaimCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Claim.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ClaimAggregateArgs>(args: Subset<T, ClaimAggregateArgs>): Prisma.PrismaPromise<GetClaimAggregateType<T>>

    /**
     * Group by Claim.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ClaimGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ClaimGroupByArgs['orderBy'] }
        : { orderBy?: ClaimGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ClaimGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetClaimGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Claim model
   */
  readonly fields: ClaimFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Claim.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ClaimClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    requirements<T extends Claim$requirementsArgs<ExtArgs> = {}>(args?: Subset<T, Claim$requirementsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClaimRequirementPayload<ExtArgs>, T, "findMany"> | Null>
    vehiclePackages<T extends Claim$vehiclePackagesArgs<ExtArgs> = {}>(args?: Subset<T, Claim$vehiclePackagesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClaimVehiclePackagePayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Claim model
   */ 
  interface ClaimFieldRefs {
    readonly id: FieldRef<"Claim", 'BigInt'>
    readonly user_id: FieldRef<"Claim", 'BigInt'>
    readonly type: FieldRef<"Claim", 'String'>
    readonly status: FieldRef<"Claim", 'String'>
    readonly lender: FieldRef<"Claim", 'String'>
    readonly solicitor: FieldRef<"Claim", 'String'>
    readonly client_last_updated_at: FieldRef<"Claim", 'DateTime'>
    readonly created_at: FieldRef<"Claim", 'DateTime'>
    readonly updated_at: FieldRef<"Claim", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Claim findUnique
   */
  export type ClaimFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Claim
     */
    select?: ClaimSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimInclude<ExtArgs> | null
    /**
     * Filter, which Claim to fetch.
     */
    where: ClaimWhereUniqueInput
  }

  /**
   * Claim findUniqueOrThrow
   */
  export type ClaimFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Claim
     */
    select?: ClaimSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimInclude<ExtArgs> | null
    /**
     * Filter, which Claim to fetch.
     */
    where: ClaimWhereUniqueInput
  }

  /**
   * Claim findFirst
   */
  export type ClaimFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Claim
     */
    select?: ClaimSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimInclude<ExtArgs> | null
    /**
     * Filter, which Claim to fetch.
     */
    where?: ClaimWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Claims to fetch.
     */
    orderBy?: ClaimOrderByWithRelationInput | ClaimOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Claims.
     */
    cursor?: ClaimWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Claims from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Claims.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Claims.
     */
    distinct?: ClaimScalarFieldEnum | ClaimScalarFieldEnum[]
  }

  /**
   * Claim findFirstOrThrow
   */
  export type ClaimFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Claim
     */
    select?: ClaimSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimInclude<ExtArgs> | null
    /**
     * Filter, which Claim to fetch.
     */
    where?: ClaimWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Claims to fetch.
     */
    orderBy?: ClaimOrderByWithRelationInput | ClaimOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Claims.
     */
    cursor?: ClaimWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Claims from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Claims.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Claims.
     */
    distinct?: ClaimScalarFieldEnum | ClaimScalarFieldEnum[]
  }

  /**
   * Claim findMany
   */
  export type ClaimFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Claim
     */
    select?: ClaimSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimInclude<ExtArgs> | null
    /**
     * Filter, which Claims to fetch.
     */
    where?: ClaimWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Claims to fetch.
     */
    orderBy?: ClaimOrderByWithRelationInput | ClaimOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Claims.
     */
    cursor?: ClaimWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Claims from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Claims.
     */
    skip?: number
    distinct?: ClaimScalarFieldEnum | ClaimScalarFieldEnum[]
  }

  /**
   * Claim create
   */
  export type ClaimCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Claim
     */
    select?: ClaimSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimInclude<ExtArgs> | null
    /**
     * The data needed to create a Claim.
     */
    data: XOR<ClaimCreateInput, ClaimUncheckedCreateInput>
  }

  /**
   * Claim createMany
   */
  export type ClaimCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Claims.
     */
    data: ClaimCreateManyInput | ClaimCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Claim update
   */
  export type ClaimUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Claim
     */
    select?: ClaimSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimInclude<ExtArgs> | null
    /**
     * The data needed to update a Claim.
     */
    data: XOR<ClaimUpdateInput, ClaimUncheckedUpdateInput>
    /**
     * Choose, which Claim to update.
     */
    where: ClaimWhereUniqueInput
  }

  /**
   * Claim updateMany
   */
  export type ClaimUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Claims.
     */
    data: XOR<ClaimUpdateManyMutationInput, ClaimUncheckedUpdateManyInput>
    /**
     * Filter which Claims to update
     */
    where?: ClaimWhereInput
  }

  /**
   * Claim upsert
   */
  export type ClaimUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Claim
     */
    select?: ClaimSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimInclude<ExtArgs> | null
    /**
     * The filter to search for the Claim to update in case it exists.
     */
    where: ClaimWhereUniqueInput
    /**
     * In case the Claim found by the `where` argument doesn't exist, create a new Claim with this data.
     */
    create: XOR<ClaimCreateInput, ClaimUncheckedCreateInput>
    /**
     * In case the Claim was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ClaimUpdateInput, ClaimUncheckedUpdateInput>
  }

  /**
   * Claim delete
   */
  export type ClaimDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Claim
     */
    select?: ClaimSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimInclude<ExtArgs> | null
    /**
     * Filter which Claim to delete.
     */
    where: ClaimWhereUniqueInput
  }

  /**
   * Claim deleteMany
   */
  export type ClaimDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Claims to delete
     */
    where?: ClaimWhereInput
  }

  /**
   * Claim.requirements
   */
  export type Claim$requirementsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimRequirement
     */
    select?: ClaimRequirementSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimRequirementInclude<ExtArgs> | null
    where?: ClaimRequirementWhereInput
    orderBy?: ClaimRequirementOrderByWithRelationInput | ClaimRequirementOrderByWithRelationInput[]
    cursor?: ClaimRequirementWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ClaimRequirementScalarFieldEnum | ClaimRequirementScalarFieldEnum[]
  }

  /**
   * Claim.vehiclePackages
   */
  export type Claim$vehiclePackagesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimVehiclePackage
     */
    select?: ClaimVehiclePackageSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimVehiclePackageInclude<ExtArgs> | null
    where?: ClaimVehiclePackageWhereInput
    orderBy?: ClaimVehiclePackageOrderByWithRelationInput | ClaimVehiclePackageOrderByWithRelationInput[]
    cursor?: ClaimVehiclePackageWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ClaimVehiclePackageScalarFieldEnum | ClaimVehiclePackageScalarFieldEnum[]
  }

  /**
   * Claim without action
   */
  export type ClaimDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Claim
     */
    select?: ClaimSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimInclude<ExtArgs> | null
  }


  /**
   * Model UserAddress
   */

  export type AggregateUserAddress = {
    _count: UserAddressCountAggregateOutputType | null
    _avg: UserAddressAvgAggregateOutputType | null
    _sum: UserAddressSumAggregateOutputType | null
    _min: UserAddressMinAggregateOutputType | null
    _max: UserAddressMaxAggregateOutputType | null
  }

  export type UserAddressAvgAggregateOutputType = {
    user_id: number | null
  }

  export type UserAddressSumAggregateOutputType = {
    user_id: number | null
  }

  export type UserAddressMinAggregateOutputType = {
    id: string | null
    user_id: number | null
    type: string | null
    is_linked_address: boolean | null
    full_address: string | null
    address_line_1: string | null
    address_line_2: string | null
    house_number: string | null
    street: string | null
    building_name: string | null
    county: string | null
    district: string | null
    post_code: string | null
    post_town: string | null
    country: string | null
    checkboard_address_id: string | null
    is_parsed_address: boolean | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type UserAddressMaxAggregateOutputType = {
    id: string | null
    user_id: number | null
    type: string | null
    is_linked_address: boolean | null
    full_address: string | null
    address_line_1: string | null
    address_line_2: string | null
    house_number: string | null
    street: string | null
    building_name: string | null
    county: string | null
    district: string | null
    post_code: string | null
    post_town: string | null
    country: string | null
    checkboard_address_id: string | null
    is_parsed_address: boolean | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type UserAddressCountAggregateOutputType = {
    id: number
    user_id: number
    type: number
    is_linked_address: number
    full_address: number
    address_line_1: number
    address_line_2: number
    house_number: number
    street: number
    building_name: number
    county: number
    district: number
    post_code: number
    post_town: number
    country: number
    checkboard_address_id: number
    checkboard_raw_address: number
    is_parsed_address: number
    openai_matching_result: number
    openai_matching_api_details: number
    created_at: number
    updated_at: number
    _all: number
  }


  export type UserAddressAvgAggregateInputType = {
    user_id?: true
  }

  export type UserAddressSumAggregateInputType = {
    user_id?: true
  }

  export type UserAddressMinAggregateInputType = {
    id?: true
    user_id?: true
    type?: true
    is_linked_address?: true
    full_address?: true
    address_line_1?: true
    address_line_2?: true
    house_number?: true
    street?: true
    building_name?: true
    county?: true
    district?: true
    post_code?: true
    post_town?: true
    country?: true
    checkboard_address_id?: true
    is_parsed_address?: true
    created_at?: true
    updated_at?: true
  }

  export type UserAddressMaxAggregateInputType = {
    id?: true
    user_id?: true
    type?: true
    is_linked_address?: true
    full_address?: true
    address_line_1?: true
    address_line_2?: true
    house_number?: true
    street?: true
    building_name?: true
    county?: true
    district?: true
    post_code?: true
    post_town?: true
    country?: true
    checkboard_address_id?: true
    is_parsed_address?: true
    created_at?: true
    updated_at?: true
  }

  export type UserAddressCountAggregateInputType = {
    id?: true
    user_id?: true
    type?: true
    is_linked_address?: true
    full_address?: true
    address_line_1?: true
    address_line_2?: true
    house_number?: true
    street?: true
    building_name?: true
    county?: true
    district?: true
    post_code?: true
    post_town?: true
    country?: true
    checkboard_address_id?: true
    checkboard_raw_address?: true
    is_parsed_address?: true
    openai_matching_result?: true
    openai_matching_api_details?: true
    created_at?: true
    updated_at?: true
    _all?: true
  }

  export type UserAddressAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserAddress to aggregate.
     */
    where?: UserAddressWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserAddresses to fetch.
     */
    orderBy?: UserAddressOrderByWithRelationInput | UserAddressOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserAddressWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserAddresses from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserAddresses.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UserAddresses
    **/
    _count?: true | UserAddressCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserAddressAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserAddressSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserAddressMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserAddressMaxAggregateInputType
  }

  export type GetUserAddressAggregateType<T extends UserAddressAggregateArgs> = {
        [P in keyof T & keyof AggregateUserAddress]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUserAddress[P]>
      : GetScalarType<T[P], AggregateUserAddress[P]>
  }




  export type UserAddressGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserAddressWhereInput
    orderBy?: UserAddressOrderByWithAggregationInput | UserAddressOrderByWithAggregationInput[]
    by: UserAddressScalarFieldEnum[] | UserAddressScalarFieldEnum
    having?: UserAddressScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserAddressCountAggregateInputType | true
    _avg?: UserAddressAvgAggregateInputType
    _sum?: UserAddressSumAggregateInputType
    _min?: UserAddressMinAggregateInputType
    _max?: UserAddressMaxAggregateInputType
  }

  export type UserAddressGroupByOutputType = {
    id: string
    user_id: number
    type: string | null
    is_linked_address: boolean
    full_address: string | null
    address_line_1: string | null
    address_line_2: string | null
    house_number: string | null
    street: string | null
    building_name: string | null
    county: string | null
    district: string | null
    post_code: string | null
    post_town: string | null
    country: string | null
    checkboard_address_id: string | null
    checkboard_raw_address: JsonValue | null
    is_parsed_address: boolean
    openai_matching_result: JsonValue | null
    openai_matching_api_details: JsonValue | null
    created_at: Date | null
    updated_at: Date | null
    _count: UserAddressCountAggregateOutputType | null
    _avg: UserAddressAvgAggregateOutputType | null
    _sum: UserAddressSumAggregateOutputType | null
    _min: UserAddressMinAggregateOutputType | null
    _max: UserAddressMaxAggregateOutputType | null
  }

  type GetUserAddressGroupByPayload<T extends UserAddressGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserAddressGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserAddressGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserAddressGroupByOutputType[P]>
            : GetScalarType<T[P], UserAddressGroupByOutputType[P]>
        }
      >
    >


  export type UserAddressSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    type?: boolean
    is_linked_address?: boolean
    full_address?: boolean
    address_line_1?: boolean
    address_line_2?: boolean
    house_number?: boolean
    street?: boolean
    building_name?: boolean
    county?: boolean
    district?: boolean
    post_code?: boolean
    post_town?: boolean
    country?: boolean
    checkboard_address_id?: boolean
    checkboard_raw_address?: boolean
    is_parsed_address?: boolean
    openai_matching_result?: boolean
    openai_matching_api_details?: boolean
    created_at?: boolean
    updated_at?: boolean
    users?: boolean | UserAddress$usersArgs<ExtArgs>
    _count?: boolean | UserAddressCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["userAddress"]>


  export type UserAddressSelectScalar = {
    id?: boolean
    user_id?: boolean
    type?: boolean
    is_linked_address?: boolean
    full_address?: boolean
    address_line_1?: boolean
    address_line_2?: boolean
    house_number?: boolean
    street?: boolean
    building_name?: boolean
    county?: boolean
    district?: boolean
    post_code?: boolean
    post_town?: boolean
    country?: boolean
    checkboard_address_id?: boolean
    checkboard_raw_address?: boolean
    is_parsed_address?: boolean
    openai_matching_result?: boolean
    openai_matching_api_details?: boolean
    created_at?: boolean
    updated_at?: boolean
  }

  export type UserAddressInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    users?: boolean | UserAddress$usersArgs<ExtArgs>
    _count?: boolean | UserAddressCountOutputTypeDefaultArgs<ExtArgs>
  }

  export type $UserAddressPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UserAddress"
    objects: {
      users: Prisma.$UserPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      user_id: number
      type: string | null
      is_linked_address: boolean
      full_address: string | null
      address_line_1: string | null
      address_line_2: string | null
      house_number: string | null
      street: string | null
      building_name: string | null
      county: string | null
      district: string | null
      post_code: string | null
      post_town: string | null
      country: string | null
      checkboard_address_id: string | null
      checkboard_raw_address: Prisma.JsonValue | null
      is_parsed_address: boolean
      openai_matching_result: Prisma.JsonValue | null
      openai_matching_api_details: Prisma.JsonValue | null
      created_at: Date | null
      updated_at: Date | null
    }, ExtArgs["result"]["userAddress"]>
    composites: {}
  }

  type UserAddressGetPayload<S extends boolean | null | undefined | UserAddressDefaultArgs> = $Result.GetResult<Prisma.$UserAddressPayload, S>

  type UserAddressCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<UserAddressFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: UserAddressCountAggregateInputType | true
    }

  export interface UserAddressDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UserAddress'], meta: { name: 'UserAddress' } }
    /**
     * Find zero or one UserAddress that matches the filter.
     * @param {UserAddressFindUniqueArgs} args - Arguments to find a UserAddress
     * @example
     * // Get one UserAddress
     * const userAddress = await prisma.userAddress.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserAddressFindUniqueArgs>(args: SelectSubset<T, UserAddressFindUniqueArgs<ExtArgs>>): Prisma__UserAddressClient<$Result.GetResult<Prisma.$UserAddressPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one UserAddress that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {UserAddressFindUniqueOrThrowArgs} args - Arguments to find a UserAddress
     * @example
     * // Get one UserAddress
     * const userAddress = await prisma.userAddress.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserAddressFindUniqueOrThrowArgs>(args: SelectSubset<T, UserAddressFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserAddressClient<$Result.GetResult<Prisma.$UserAddressPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first UserAddress that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAddressFindFirstArgs} args - Arguments to find a UserAddress
     * @example
     * // Get one UserAddress
     * const userAddress = await prisma.userAddress.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserAddressFindFirstArgs>(args?: SelectSubset<T, UserAddressFindFirstArgs<ExtArgs>>): Prisma__UserAddressClient<$Result.GetResult<Prisma.$UserAddressPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first UserAddress that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAddressFindFirstOrThrowArgs} args - Arguments to find a UserAddress
     * @example
     * // Get one UserAddress
     * const userAddress = await prisma.userAddress.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserAddressFindFirstOrThrowArgs>(args?: SelectSubset<T, UserAddressFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserAddressClient<$Result.GetResult<Prisma.$UserAddressPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more UserAddresses that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAddressFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UserAddresses
     * const userAddresses = await prisma.userAddress.findMany()
     * 
     * // Get first 10 UserAddresses
     * const userAddresses = await prisma.userAddress.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userAddressWithIdOnly = await prisma.userAddress.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserAddressFindManyArgs>(args?: SelectSubset<T, UserAddressFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserAddressPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a UserAddress.
     * @param {UserAddressCreateArgs} args - Arguments to create a UserAddress.
     * @example
     * // Create one UserAddress
     * const UserAddress = await prisma.userAddress.create({
     *   data: {
     *     // ... data to create a UserAddress
     *   }
     * })
     * 
     */
    create<T extends UserAddressCreateArgs>(args: SelectSubset<T, UserAddressCreateArgs<ExtArgs>>): Prisma__UserAddressClient<$Result.GetResult<Prisma.$UserAddressPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many UserAddresses.
     * @param {UserAddressCreateManyArgs} args - Arguments to create many UserAddresses.
     * @example
     * // Create many UserAddresses
     * const userAddress = await prisma.userAddress.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserAddressCreateManyArgs>(args?: SelectSubset<T, UserAddressCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a UserAddress.
     * @param {UserAddressDeleteArgs} args - Arguments to delete one UserAddress.
     * @example
     * // Delete one UserAddress
     * const UserAddress = await prisma.userAddress.delete({
     *   where: {
     *     // ... filter to delete one UserAddress
     *   }
     * })
     * 
     */
    delete<T extends UserAddressDeleteArgs>(args: SelectSubset<T, UserAddressDeleteArgs<ExtArgs>>): Prisma__UserAddressClient<$Result.GetResult<Prisma.$UserAddressPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one UserAddress.
     * @param {UserAddressUpdateArgs} args - Arguments to update one UserAddress.
     * @example
     * // Update one UserAddress
     * const userAddress = await prisma.userAddress.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserAddressUpdateArgs>(args: SelectSubset<T, UserAddressUpdateArgs<ExtArgs>>): Prisma__UserAddressClient<$Result.GetResult<Prisma.$UserAddressPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more UserAddresses.
     * @param {UserAddressDeleteManyArgs} args - Arguments to filter UserAddresses to delete.
     * @example
     * // Delete a few UserAddresses
     * const { count } = await prisma.userAddress.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserAddressDeleteManyArgs>(args?: SelectSubset<T, UserAddressDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserAddresses.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAddressUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UserAddresses
     * const userAddress = await prisma.userAddress.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserAddressUpdateManyArgs>(args: SelectSubset<T, UserAddressUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one UserAddress.
     * @param {UserAddressUpsertArgs} args - Arguments to update or create a UserAddress.
     * @example
     * // Update or create a UserAddress
     * const userAddress = await prisma.userAddress.upsert({
     *   create: {
     *     // ... data to create a UserAddress
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UserAddress we want to update
     *   }
     * })
     */
    upsert<T extends UserAddressUpsertArgs>(args: SelectSubset<T, UserAddressUpsertArgs<ExtArgs>>): Prisma__UserAddressClient<$Result.GetResult<Prisma.$UserAddressPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of UserAddresses.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAddressCountArgs} args - Arguments to filter UserAddresses to count.
     * @example
     * // Count the number of UserAddresses
     * const count = await prisma.userAddress.count({
     *   where: {
     *     // ... the filter for the UserAddresses we want to count
     *   }
     * })
    **/
    count<T extends UserAddressCountArgs>(
      args?: Subset<T, UserAddressCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserAddressCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a UserAddress.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAddressAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAddressAggregateArgs>(args: Subset<T, UserAddressAggregateArgs>): Prisma.PrismaPromise<GetUserAddressAggregateType<T>>

    /**
     * Group by UserAddress.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAddressGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserAddressGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserAddressGroupByArgs['orderBy'] }
        : { orderBy?: UserAddressGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserAddressGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserAddressGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the UserAddress model
   */
  readonly fields: UserAddressFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UserAddress.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserAddressClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    users<T extends UserAddress$usersArgs<ExtArgs> = {}>(args?: Subset<T, UserAddress$usersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UserAddress model
   */ 
  interface UserAddressFieldRefs {
    readonly id: FieldRef<"UserAddress", 'String'>
    readonly user_id: FieldRef<"UserAddress", 'Int'>
    readonly type: FieldRef<"UserAddress", 'String'>
    readonly is_linked_address: FieldRef<"UserAddress", 'Boolean'>
    readonly full_address: FieldRef<"UserAddress", 'String'>
    readonly address_line_1: FieldRef<"UserAddress", 'String'>
    readonly address_line_2: FieldRef<"UserAddress", 'String'>
    readonly house_number: FieldRef<"UserAddress", 'String'>
    readonly street: FieldRef<"UserAddress", 'String'>
    readonly building_name: FieldRef<"UserAddress", 'String'>
    readonly county: FieldRef<"UserAddress", 'String'>
    readonly district: FieldRef<"UserAddress", 'String'>
    readonly post_code: FieldRef<"UserAddress", 'String'>
    readonly post_town: FieldRef<"UserAddress", 'String'>
    readonly country: FieldRef<"UserAddress", 'String'>
    readonly checkboard_address_id: FieldRef<"UserAddress", 'String'>
    readonly checkboard_raw_address: FieldRef<"UserAddress", 'Json'>
    readonly is_parsed_address: FieldRef<"UserAddress", 'Boolean'>
    readonly openai_matching_result: FieldRef<"UserAddress", 'Json'>
    readonly openai_matching_api_details: FieldRef<"UserAddress", 'Json'>
    readonly created_at: FieldRef<"UserAddress", 'DateTime'>
    readonly updated_at: FieldRef<"UserAddress", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * UserAddress findUnique
   */
  export type UserAddressFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAddress
     */
    select?: UserAddressSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAddressInclude<ExtArgs> | null
    /**
     * Filter, which UserAddress to fetch.
     */
    where: UserAddressWhereUniqueInput
  }

  /**
   * UserAddress findUniqueOrThrow
   */
  export type UserAddressFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAddress
     */
    select?: UserAddressSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAddressInclude<ExtArgs> | null
    /**
     * Filter, which UserAddress to fetch.
     */
    where: UserAddressWhereUniqueInput
  }

  /**
   * UserAddress findFirst
   */
  export type UserAddressFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAddress
     */
    select?: UserAddressSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAddressInclude<ExtArgs> | null
    /**
     * Filter, which UserAddress to fetch.
     */
    where?: UserAddressWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserAddresses to fetch.
     */
    orderBy?: UserAddressOrderByWithRelationInput | UserAddressOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserAddresses.
     */
    cursor?: UserAddressWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserAddresses from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserAddresses.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserAddresses.
     */
    distinct?: UserAddressScalarFieldEnum | UserAddressScalarFieldEnum[]
  }

  /**
   * UserAddress findFirstOrThrow
   */
  export type UserAddressFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAddress
     */
    select?: UserAddressSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAddressInclude<ExtArgs> | null
    /**
     * Filter, which UserAddress to fetch.
     */
    where?: UserAddressWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserAddresses to fetch.
     */
    orderBy?: UserAddressOrderByWithRelationInput | UserAddressOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserAddresses.
     */
    cursor?: UserAddressWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserAddresses from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserAddresses.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserAddresses.
     */
    distinct?: UserAddressScalarFieldEnum | UserAddressScalarFieldEnum[]
  }

  /**
   * UserAddress findMany
   */
  export type UserAddressFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAddress
     */
    select?: UserAddressSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAddressInclude<ExtArgs> | null
    /**
     * Filter, which UserAddresses to fetch.
     */
    where?: UserAddressWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserAddresses to fetch.
     */
    orderBy?: UserAddressOrderByWithRelationInput | UserAddressOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UserAddresses.
     */
    cursor?: UserAddressWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserAddresses from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserAddresses.
     */
    skip?: number
    distinct?: UserAddressScalarFieldEnum | UserAddressScalarFieldEnum[]
  }

  /**
   * UserAddress create
   */
  export type UserAddressCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAddress
     */
    select?: UserAddressSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAddressInclude<ExtArgs> | null
    /**
     * The data needed to create a UserAddress.
     */
    data: XOR<UserAddressCreateInput, UserAddressUncheckedCreateInput>
  }

  /**
   * UserAddress createMany
   */
  export type UserAddressCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UserAddresses.
     */
    data: UserAddressCreateManyInput | UserAddressCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserAddress update
   */
  export type UserAddressUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAddress
     */
    select?: UserAddressSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAddressInclude<ExtArgs> | null
    /**
     * The data needed to update a UserAddress.
     */
    data: XOR<UserAddressUpdateInput, UserAddressUncheckedUpdateInput>
    /**
     * Choose, which UserAddress to update.
     */
    where: UserAddressWhereUniqueInput
  }

  /**
   * UserAddress updateMany
   */
  export type UserAddressUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UserAddresses.
     */
    data: XOR<UserAddressUpdateManyMutationInput, UserAddressUncheckedUpdateManyInput>
    /**
     * Filter which UserAddresses to update
     */
    where?: UserAddressWhereInput
  }

  /**
   * UserAddress upsert
   */
  export type UserAddressUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAddress
     */
    select?: UserAddressSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAddressInclude<ExtArgs> | null
    /**
     * The filter to search for the UserAddress to update in case it exists.
     */
    where: UserAddressWhereUniqueInput
    /**
     * In case the UserAddress found by the `where` argument doesn't exist, create a new UserAddress with this data.
     */
    create: XOR<UserAddressCreateInput, UserAddressUncheckedCreateInput>
    /**
     * In case the UserAddress was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserAddressUpdateInput, UserAddressUncheckedUpdateInput>
  }

  /**
   * UserAddress delete
   */
  export type UserAddressDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAddress
     */
    select?: UserAddressSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAddressInclude<ExtArgs> | null
    /**
     * Filter which UserAddress to delete.
     */
    where: UserAddressWhereUniqueInput
  }

  /**
   * UserAddress deleteMany
   */
  export type UserAddressDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserAddresses to delete
     */
    where?: UserAddressWhereInput
  }

  /**
   * UserAddress.users
   */
  export type UserAddress$usersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    cursor?: UserWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * UserAddress without action
   */
  export type UserAddressDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAddress
     */
    select?: UserAddressSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAddressInclude<ExtArgs> | null
  }


  /**
   * Model ClaimRequirement
   */

  export type AggregateClaimRequirement = {
    _count: ClaimRequirementCountAggregateOutputType | null
    _avg: ClaimRequirementAvgAggregateOutputType | null
    _sum: ClaimRequirementSumAggregateOutputType | null
    _min: ClaimRequirementMinAggregateOutputType | null
    _max: ClaimRequirementMaxAggregateOutputType | null
  }

  export type ClaimRequirementAvgAggregateOutputType = {
    claim_id: number | null
  }

  export type ClaimRequirementSumAggregateOutputType = {
    claim_id: bigint | null
  }

  export type ClaimRequirementMinAggregateOutputType = {
    id: string | null
    claim_id: bigint | null
    type: string | null
    status: string | null
    claim_requirement_reason: string | null
    claim_requirement_rejection_reason: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type ClaimRequirementMaxAggregateOutputType = {
    id: string | null
    claim_id: bigint | null
    type: string | null
    status: string | null
    claim_requirement_reason: string | null
    claim_requirement_rejection_reason: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type ClaimRequirementCountAggregateOutputType = {
    id: number
    claim_id: number
    type: number
    status: number
    claim_requirement_reason: number
    claim_requirement_rejection_reason: number
    created_at: number
    updated_at: number
    _all: number
  }


  export type ClaimRequirementAvgAggregateInputType = {
    claim_id?: true
  }

  export type ClaimRequirementSumAggregateInputType = {
    claim_id?: true
  }

  export type ClaimRequirementMinAggregateInputType = {
    id?: true
    claim_id?: true
    type?: true
    status?: true
    claim_requirement_reason?: true
    claim_requirement_rejection_reason?: true
    created_at?: true
    updated_at?: true
  }

  export type ClaimRequirementMaxAggregateInputType = {
    id?: true
    claim_id?: true
    type?: true
    status?: true
    claim_requirement_reason?: true
    claim_requirement_rejection_reason?: true
    created_at?: true
    updated_at?: true
  }

  export type ClaimRequirementCountAggregateInputType = {
    id?: true
    claim_id?: true
    type?: true
    status?: true
    claim_requirement_reason?: true
    claim_requirement_rejection_reason?: true
    created_at?: true
    updated_at?: true
    _all?: true
  }

  export type ClaimRequirementAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClaimRequirement to aggregate.
     */
    where?: ClaimRequirementWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClaimRequirements to fetch.
     */
    orderBy?: ClaimRequirementOrderByWithRelationInput | ClaimRequirementOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ClaimRequirementWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClaimRequirements from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClaimRequirements.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ClaimRequirements
    **/
    _count?: true | ClaimRequirementCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ClaimRequirementAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ClaimRequirementSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ClaimRequirementMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ClaimRequirementMaxAggregateInputType
  }

  export type GetClaimRequirementAggregateType<T extends ClaimRequirementAggregateArgs> = {
        [P in keyof T & keyof AggregateClaimRequirement]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateClaimRequirement[P]>
      : GetScalarType<T[P], AggregateClaimRequirement[P]>
  }




  export type ClaimRequirementGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClaimRequirementWhereInput
    orderBy?: ClaimRequirementOrderByWithAggregationInput | ClaimRequirementOrderByWithAggregationInput[]
    by: ClaimRequirementScalarFieldEnum[] | ClaimRequirementScalarFieldEnum
    having?: ClaimRequirementScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ClaimRequirementCountAggregateInputType | true
    _avg?: ClaimRequirementAvgAggregateInputType
    _sum?: ClaimRequirementSumAggregateInputType
    _min?: ClaimRequirementMinAggregateInputType
    _max?: ClaimRequirementMaxAggregateInputType
  }

  export type ClaimRequirementGroupByOutputType = {
    id: string
    claim_id: bigint
    type: string | null
    status: string | null
    claim_requirement_reason: string | null
    claim_requirement_rejection_reason: string | null
    created_at: Date | null
    updated_at: Date | null
    _count: ClaimRequirementCountAggregateOutputType | null
    _avg: ClaimRequirementAvgAggregateOutputType | null
    _sum: ClaimRequirementSumAggregateOutputType | null
    _min: ClaimRequirementMinAggregateOutputType | null
    _max: ClaimRequirementMaxAggregateOutputType | null
  }

  type GetClaimRequirementGroupByPayload<T extends ClaimRequirementGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ClaimRequirementGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ClaimRequirementGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ClaimRequirementGroupByOutputType[P]>
            : GetScalarType<T[P], ClaimRequirementGroupByOutputType[P]>
        }
      >
    >


  export type ClaimRequirementSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    claim_id?: boolean
    type?: boolean
    status?: boolean
    claim_requirement_reason?: boolean
    claim_requirement_rejection_reason?: boolean
    created_at?: boolean
    updated_at?: boolean
    claim?: boolean | ClaimDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["claimRequirement"]>


  export type ClaimRequirementSelectScalar = {
    id?: boolean
    claim_id?: boolean
    type?: boolean
    status?: boolean
    claim_requirement_reason?: boolean
    claim_requirement_rejection_reason?: boolean
    created_at?: boolean
    updated_at?: boolean
  }

  export type ClaimRequirementInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    claim?: boolean | ClaimDefaultArgs<ExtArgs>
  }

  export type $ClaimRequirementPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ClaimRequirement"
    objects: {
      claim: Prisma.$ClaimPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      claim_id: bigint
      type: string | null
      status: string | null
      claim_requirement_reason: string | null
      claim_requirement_rejection_reason: string | null
      created_at: Date | null
      updated_at: Date | null
    }, ExtArgs["result"]["claimRequirement"]>
    composites: {}
  }

  type ClaimRequirementGetPayload<S extends boolean | null | undefined | ClaimRequirementDefaultArgs> = $Result.GetResult<Prisma.$ClaimRequirementPayload, S>

  type ClaimRequirementCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ClaimRequirementFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ClaimRequirementCountAggregateInputType | true
    }

  export interface ClaimRequirementDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ClaimRequirement'], meta: { name: 'ClaimRequirement' } }
    /**
     * Find zero or one ClaimRequirement that matches the filter.
     * @param {ClaimRequirementFindUniqueArgs} args - Arguments to find a ClaimRequirement
     * @example
     * // Get one ClaimRequirement
     * const claimRequirement = await prisma.claimRequirement.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ClaimRequirementFindUniqueArgs>(args: SelectSubset<T, ClaimRequirementFindUniqueArgs<ExtArgs>>): Prisma__ClaimRequirementClient<$Result.GetResult<Prisma.$ClaimRequirementPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one ClaimRequirement that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ClaimRequirementFindUniqueOrThrowArgs} args - Arguments to find a ClaimRequirement
     * @example
     * // Get one ClaimRequirement
     * const claimRequirement = await prisma.claimRequirement.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ClaimRequirementFindUniqueOrThrowArgs>(args: SelectSubset<T, ClaimRequirementFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ClaimRequirementClient<$Result.GetResult<Prisma.$ClaimRequirementPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first ClaimRequirement that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimRequirementFindFirstArgs} args - Arguments to find a ClaimRequirement
     * @example
     * // Get one ClaimRequirement
     * const claimRequirement = await prisma.claimRequirement.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ClaimRequirementFindFirstArgs>(args?: SelectSubset<T, ClaimRequirementFindFirstArgs<ExtArgs>>): Prisma__ClaimRequirementClient<$Result.GetResult<Prisma.$ClaimRequirementPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first ClaimRequirement that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimRequirementFindFirstOrThrowArgs} args - Arguments to find a ClaimRequirement
     * @example
     * // Get one ClaimRequirement
     * const claimRequirement = await prisma.claimRequirement.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ClaimRequirementFindFirstOrThrowArgs>(args?: SelectSubset<T, ClaimRequirementFindFirstOrThrowArgs<ExtArgs>>): Prisma__ClaimRequirementClient<$Result.GetResult<Prisma.$ClaimRequirementPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more ClaimRequirements that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimRequirementFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ClaimRequirements
     * const claimRequirements = await prisma.claimRequirement.findMany()
     * 
     * // Get first 10 ClaimRequirements
     * const claimRequirements = await prisma.claimRequirement.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const claimRequirementWithIdOnly = await prisma.claimRequirement.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ClaimRequirementFindManyArgs>(args?: SelectSubset<T, ClaimRequirementFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClaimRequirementPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a ClaimRequirement.
     * @param {ClaimRequirementCreateArgs} args - Arguments to create a ClaimRequirement.
     * @example
     * // Create one ClaimRequirement
     * const ClaimRequirement = await prisma.claimRequirement.create({
     *   data: {
     *     // ... data to create a ClaimRequirement
     *   }
     * })
     * 
     */
    create<T extends ClaimRequirementCreateArgs>(args: SelectSubset<T, ClaimRequirementCreateArgs<ExtArgs>>): Prisma__ClaimRequirementClient<$Result.GetResult<Prisma.$ClaimRequirementPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many ClaimRequirements.
     * @param {ClaimRequirementCreateManyArgs} args - Arguments to create many ClaimRequirements.
     * @example
     * // Create many ClaimRequirements
     * const claimRequirement = await prisma.claimRequirement.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ClaimRequirementCreateManyArgs>(args?: SelectSubset<T, ClaimRequirementCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a ClaimRequirement.
     * @param {ClaimRequirementDeleteArgs} args - Arguments to delete one ClaimRequirement.
     * @example
     * // Delete one ClaimRequirement
     * const ClaimRequirement = await prisma.claimRequirement.delete({
     *   where: {
     *     // ... filter to delete one ClaimRequirement
     *   }
     * })
     * 
     */
    delete<T extends ClaimRequirementDeleteArgs>(args: SelectSubset<T, ClaimRequirementDeleteArgs<ExtArgs>>): Prisma__ClaimRequirementClient<$Result.GetResult<Prisma.$ClaimRequirementPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one ClaimRequirement.
     * @param {ClaimRequirementUpdateArgs} args - Arguments to update one ClaimRequirement.
     * @example
     * // Update one ClaimRequirement
     * const claimRequirement = await prisma.claimRequirement.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ClaimRequirementUpdateArgs>(args: SelectSubset<T, ClaimRequirementUpdateArgs<ExtArgs>>): Prisma__ClaimRequirementClient<$Result.GetResult<Prisma.$ClaimRequirementPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more ClaimRequirements.
     * @param {ClaimRequirementDeleteManyArgs} args - Arguments to filter ClaimRequirements to delete.
     * @example
     * // Delete a few ClaimRequirements
     * const { count } = await prisma.claimRequirement.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ClaimRequirementDeleteManyArgs>(args?: SelectSubset<T, ClaimRequirementDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ClaimRequirements.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimRequirementUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ClaimRequirements
     * const claimRequirement = await prisma.claimRequirement.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ClaimRequirementUpdateManyArgs>(args: SelectSubset<T, ClaimRequirementUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ClaimRequirement.
     * @param {ClaimRequirementUpsertArgs} args - Arguments to update or create a ClaimRequirement.
     * @example
     * // Update or create a ClaimRequirement
     * const claimRequirement = await prisma.claimRequirement.upsert({
     *   create: {
     *     // ... data to create a ClaimRequirement
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ClaimRequirement we want to update
     *   }
     * })
     */
    upsert<T extends ClaimRequirementUpsertArgs>(args: SelectSubset<T, ClaimRequirementUpsertArgs<ExtArgs>>): Prisma__ClaimRequirementClient<$Result.GetResult<Prisma.$ClaimRequirementPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of ClaimRequirements.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimRequirementCountArgs} args - Arguments to filter ClaimRequirements to count.
     * @example
     * // Count the number of ClaimRequirements
     * const count = await prisma.claimRequirement.count({
     *   where: {
     *     // ... the filter for the ClaimRequirements we want to count
     *   }
     * })
    **/
    count<T extends ClaimRequirementCountArgs>(
      args?: Subset<T, ClaimRequirementCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ClaimRequirementCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ClaimRequirement.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimRequirementAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ClaimRequirementAggregateArgs>(args: Subset<T, ClaimRequirementAggregateArgs>): Prisma.PrismaPromise<GetClaimRequirementAggregateType<T>>

    /**
     * Group by ClaimRequirement.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimRequirementGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ClaimRequirementGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ClaimRequirementGroupByArgs['orderBy'] }
        : { orderBy?: ClaimRequirementGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ClaimRequirementGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetClaimRequirementGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ClaimRequirement model
   */
  readonly fields: ClaimRequirementFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ClaimRequirement.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ClaimRequirementClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    claim<T extends ClaimDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ClaimDefaultArgs<ExtArgs>>): Prisma__ClaimClient<$Result.GetResult<Prisma.$ClaimPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ClaimRequirement model
   */ 
  interface ClaimRequirementFieldRefs {
    readonly id: FieldRef<"ClaimRequirement", 'String'>
    readonly claim_id: FieldRef<"ClaimRequirement", 'BigInt'>
    readonly type: FieldRef<"ClaimRequirement", 'String'>
    readonly status: FieldRef<"ClaimRequirement", 'String'>
    readonly claim_requirement_reason: FieldRef<"ClaimRequirement", 'String'>
    readonly claim_requirement_rejection_reason: FieldRef<"ClaimRequirement", 'String'>
    readonly created_at: FieldRef<"ClaimRequirement", 'DateTime'>
    readonly updated_at: FieldRef<"ClaimRequirement", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ClaimRequirement findUnique
   */
  export type ClaimRequirementFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimRequirement
     */
    select?: ClaimRequirementSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimRequirementInclude<ExtArgs> | null
    /**
     * Filter, which ClaimRequirement to fetch.
     */
    where: ClaimRequirementWhereUniqueInput
  }

  /**
   * ClaimRequirement findUniqueOrThrow
   */
  export type ClaimRequirementFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimRequirement
     */
    select?: ClaimRequirementSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimRequirementInclude<ExtArgs> | null
    /**
     * Filter, which ClaimRequirement to fetch.
     */
    where: ClaimRequirementWhereUniqueInput
  }

  /**
   * ClaimRequirement findFirst
   */
  export type ClaimRequirementFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimRequirement
     */
    select?: ClaimRequirementSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimRequirementInclude<ExtArgs> | null
    /**
     * Filter, which ClaimRequirement to fetch.
     */
    where?: ClaimRequirementWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClaimRequirements to fetch.
     */
    orderBy?: ClaimRequirementOrderByWithRelationInput | ClaimRequirementOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClaimRequirements.
     */
    cursor?: ClaimRequirementWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClaimRequirements from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClaimRequirements.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClaimRequirements.
     */
    distinct?: ClaimRequirementScalarFieldEnum | ClaimRequirementScalarFieldEnum[]
  }

  /**
   * ClaimRequirement findFirstOrThrow
   */
  export type ClaimRequirementFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimRequirement
     */
    select?: ClaimRequirementSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimRequirementInclude<ExtArgs> | null
    /**
     * Filter, which ClaimRequirement to fetch.
     */
    where?: ClaimRequirementWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClaimRequirements to fetch.
     */
    orderBy?: ClaimRequirementOrderByWithRelationInput | ClaimRequirementOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClaimRequirements.
     */
    cursor?: ClaimRequirementWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClaimRequirements from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClaimRequirements.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClaimRequirements.
     */
    distinct?: ClaimRequirementScalarFieldEnum | ClaimRequirementScalarFieldEnum[]
  }

  /**
   * ClaimRequirement findMany
   */
  export type ClaimRequirementFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimRequirement
     */
    select?: ClaimRequirementSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimRequirementInclude<ExtArgs> | null
    /**
     * Filter, which ClaimRequirements to fetch.
     */
    where?: ClaimRequirementWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClaimRequirements to fetch.
     */
    orderBy?: ClaimRequirementOrderByWithRelationInput | ClaimRequirementOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ClaimRequirements.
     */
    cursor?: ClaimRequirementWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClaimRequirements from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClaimRequirements.
     */
    skip?: number
    distinct?: ClaimRequirementScalarFieldEnum | ClaimRequirementScalarFieldEnum[]
  }

  /**
   * ClaimRequirement create
   */
  export type ClaimRequirementCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimRequirement
     */
    select?: ClaimRequirementSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimRequirementInclude<ExtArgs> | null
    /**
     * The data needed to create a ClaimRequirement.
     */
    data: XOR<ClaimRequirementCreateInput, ClaimRequirementUncheckedCreateInput>
  }

  /**
   * ClaimRequirement createMany
   */
  export type ClaimRequirementCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ClaimRequirements.
     */
    data: ClaimRequirementCreateManyInput | ClaimRequirementCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ClaimRequirement update
   */
  export type ClaimRequirementUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimRequirement
     */
    select?: ClaimRequirementSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimRequirementInclude<ExtArgs> | null
    /**
     * The data needed to update a ClaimRequirement.
     */
    data: XOR<ClaimRequirementUpdateInput, ClaimRequirementUncheckedUpdateInput>
    /**
     * Choose, which ClaimRequirement to update.
     */
    where: ClaimRequirementWhereUniqueInput
  }

  /**
   * ClaimRequirement updateMany
   */
  export type ClaimRequirementUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ClaimRequirements.
     */
    data: XOR<ClaimRequirementUpdateManyMutationInput, ClaimRequirementUncheckedUpdateManyInput>
    /**
     * Filter which ClaimRequirements to update
     */
    where?: ClaimRequirementWhereInput
  }

  /**
   * ClaimRequirement upsert
   */
  export type ClaimRequirementUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimRequirement
     */
    select?: ClaimRequirementSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimRequirementInclude<ExtArgs> | null
    /**
     * The filter to search for the ClaimRequirement to update in case it exists.
     */
    where: ClaimRequirementWhereUniqueInput
    /**
     * In case the ClaimRequirement found by the `where` argument doesn't exist, create a new ClaimRequirement with this data.
     */
    create: XOR<ClaimRequirementCreateInput, ClaimRequirementUncheckedCreateInput>
    /**
     * In case the ClaimRequirement was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ClaimRequirementUpdateInput, ClaimRequirementUncheckedUpdateInput>
  }

  /**
   * ClaimRequirement delete
   */
  export type ClaimRequirementDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimRequirement
     */
    select?: ClaimRequirementSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimRequirementInclude<ExtArgs> | null
    /**
     * Filter which ClaimRequirement to delete.
     */
    where: ClaimRequirementWhereUniqueInput
  }

  /**
   * ClaimRequirement deleteMany
   */
  export type ClaimRequirementDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClaimRequirements to delete
     */
    where?: ClaimRequirementWhereInput
  }

  /**
   * ClaimRequirement without action
   */
  export type ClaimRequirementDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimRequirement
     */
    select?: ClaimRequirementSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimRequirementInclude<ExtArgs> | null
  }


  /**
   * Model ClaimVehiclePackage
   */

  export type AggregateClaimVehiclePackage = {
    _count: ClaimVehiclePackageCountAggregateOutputType | null
    _avg: ClaimVehiclePackageAvgAggregateOutputType | null
    _sum: ClaimVehiclePackageSumAggregateOutputType | null
    _min: ClaimVehiclePackageMinAggregateOutputType | null
    _max: ClaimVehiclePackageMaxAggregateOutputType | null
  }

  export type ClaimVehiclePackageAvgAggregateOutputType = {
    claim_id: number | null
    monthly_payment: Decimal | null
  }

  export type ClaimVehiclePackageSumAggregateOutputType = {
    claim_id: bigint | null
    monthly_payment: Decimal | null
  }

  export type ClaimVehiclePackageMinAggregateOutputType = {
    id: string | null
    claim_id: bigint | null
    vehicle_registration: string | null
    vehicle_make: string | null
    vehicle_model: string | null
    dealership_name: string | null
    monthly_payment: Decimal | null
    contract_start_date: Date | null
    status: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type ClaimVehiclePackageMaxAggregateOutputType = {
    id: string | null
    claim_id: bigint | null
    vehicle_registration: string | null
    vehicle_make: string | null
    vehicle_model: string | null
    dealership_name: string | null
    monthly_payment: Decimal | null
    contract_start_date: Date | null
    status: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type ClaimVehiclePackageCountAggregateOutputType = {
    id: number
    claim_id: number
    vehicle_registration: number
    vehicle_make: number
    vehicle_model: number
    dealership_name: number
    monthly_payment: number
    contract_start_date: number
    status: number
    created_at: number
    updated_at: number
    _all: number
  }


  export type ClaimVehiclePackageAvgAggregateInputType = {
    claim_id?: true
    monthly_payment?: true
  }

  export type ClaimVehiclePackageSumAggregateInputType = {
    claim_id?: true
    monthly_payment?: true
  }

  export type ClaimVehiclePackageMinAggregateInputType = {
    id?: true
    claim_id?: true
    vehicle_registration?: true
    vehicle_make?: true
    vehicle_model?: true
    dealership_name?: true
    monthly_payment?: true
    contract_start_date?: true
    status?: true
    created_at?: true
    updated_at?: true
  }

  export type ClaimVehiclePackageMaxAggregateInputType = {
    id?: true
    claim_id?: true
    vehicle_registration?: true
    vehicle_make?: true
    vehicle_model?: true
    dealership_name?: true
    monthly_payment?: true
    contract_start_date?: true
    status?: true
    created_at?: true
    updated_at?: true
  }

  export type ClaimVehiclePackageCountAggregateInputType = {
    id?: true
    claim_id?: true
    vehicle_registration?: true
    vehicle_make?: true
    vehicle_model?: true
    dealership_name?: true
    monthly_payment?: true
    contract_start_date?: true
    status?: true
    created_at?: true
    updated_at?: true
    _all?: true
  }

  export type ClaimVehiclePackageAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClaimVehiclePackage to aggregate.
     */
    where?: ClaimVehiclePackageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClaimVehiclePackages to fetch.
     */
    orderBy?: ClaimVehiclePackageOrderByWithRelationInput | ClaimVehiclePackageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ClaimVehiclePackageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClaimVehiclePackages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClaimVehiclePackages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ClaimVehiclePackages
    **/
    _count?: true | ClaimVehiclePackageCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ClaimVehiclePackageAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ClaimVehiclePackageSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ClaimVehiclePackageMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ClaimVehiclePackageMaxAggregateInputType
  }

  export type GetClaimVehiclePackageAggregateType<T extends ClaimVehiclePackageAggregateArgs> = {
        [P in keyof T & keyof AggregateClaimVehiclePackage]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateClaimVehiclePackage[P]>
      : GetScalarType<T[P], AggregateClaimVehiclePackage[P]>
  }




  export type ClaimVehiclePackageGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClaimVehiclePackageWhereInput
    orderBy?: ClaimVehiclePackageOrderByWithAggregationInput | ClaimVehiclePackageOrderByWithAggregationInput[]
    by: ClaimVehiclePackageScalarFieldEnum[] | ClaimVehiclePackageScalarFieldEnum
    having?: ClaimVehiclePackageScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ClaimVehiclePackageCountAggregateInputType | true
    _avg?: ClaimVehiclePackageAvgAggregateInputType
    _sum?: ClaimVehiclePackageSumAggregateInputType
    _min?: ClaimVehiclePackageMinAggregateInputType
    _max?: ClaimVehiclePackageMaxAggregateInputType
  }

  export type ClaimVehiclePackageGroupByOutputType = {
    id: string
    claim_id: bigint
    vehicle_registration: string | null
    vehicle_make: string | null
    vehicle_model: string | null
    dealership_name: string | null
    monthly_payment: Decimal | null
    contract_start_date: Date | null
    status: string | null
    created_at: Date | null
    updated_at: Date | null
    _count: ClaimVehiclePackageCountAggregateOutputType | null
    _avg: ClaimVehiclePackageAvgAggregateOutputType | null
    _sum: ClaimVehiclePackageSumAggregateOutputType | null
    _min: ClaimVehiclePackageMinAggregateOutputType | null
    _max: ClaimVehiclePackageMaxAggregateOutputType | null
  }

  type GetClaimVehiclePackageGroupByPayload<T extends ClaimVehiclePackageGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ClaimVehiclePackageGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ClaimVehiclePackageGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ClaimVehiclePackageGroupByOutputType[P]>
            : GetScalarType<T[P], ClaimVehiclePackageGroupByOutputType[P]>
        }
      >
    >


  export type ClaimVehiclePackageSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    claim_id?: boolean
    vehicle_registration?: boolean
    vehicle_make?: boolean
    vehicle_model?: boolean
    dealership_name?: boolean
    monthly_payment?: boolean
    contract_start_date?: boolean
    status?: boolean
    created_at?: boolean
    updated_at?: boolean
    claim?: boolean | ClaimDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["claimVehiclePackage"]>


  export type ClaimVehiclePackageSelectScalar = {
    id?: boolean
    claim_id?: boolean
    vehicle_registration?: boolean
    vehicle_make?: boolean
    vehicle_model?: boolean
    dealership_name?: boolean
    monthly_payment?: boolean
    contract_start_date?: boolean
    status?: boolean
    created_at?: boolean
    updated_at?: boolean
  }

  export type ClaimVehiclePackageInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    claim?: boolean | ClaimDefaultArgs<ExtArgs>
  }

  export type $ClaimVehiclePackagePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ClaimVehiclePackage"
    objects: {
      claim: Prisma.$ClaimPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      claim_id: bigint
      vehicle_registration: string | null
      vehicle_make: string | null
      vehicle_model: string | null
      dealership_name: string | null
      monthly_payment: Prisma.Decimal | null
      contract_start_date: Date | null
      status: string | null
      created_at: Date | null
      updated_at: Date | null
    }, ExtArgs["result"]["claimVehiclePackage"]>
    composites: {}
  }

  type ClaimVehiclePackageGetPayload<S extends boolean | null | undefined | ClaimVehiclePackageDefaultArgs> = $Result.GetResult<Prisma.$ClaimVehiclePackagePayload, S>

  type ClaimVehiclePackageCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ClaimVehiclePackageFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ClaimVehiclePackageCountAggregateInputType | true
    }

  export interface ClaimVehiclePackageDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ClaimVehiclePackage'], meta: { name: 'ClaimVehiclePackage' } }
    /**
     * Find zero or one ClaimVehiclePackage that matches the filter.
     * @param {ClaimVehiclePackageFindUniqueArgs} args - Arguments to find a ClaimVehiclePackage
     * @example
     * // Get one ClaimVehiclePackage
     * const claimVehiclePackage = await prisma.claimVehiclePackage.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ClaimVehiclePackageFindUniqueArgs>(args: SelectSubset<T, ClaimVehiclePackageFindUniqueArgs<ExtArgs>>): Prisma__ClaimVehiclePackageClient<$Result.GetResult<Prisma.$ClaimVehiclePackagePayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one ClaimVehiclePackage that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ClaimVehiclePackageFindUniqueOrThrowArgs} args - Arguments to find a ClaimVehiclePackage
     * @example
     * // Get one ClaimVehiclePackage
     * const claimVehiclePackage = await prisma.claimVehiclePackage.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ClaimVehiclePackageFindUniqueOrThrowArgs>(args: SelectSubset<T, ClaimVehiclePackageFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ClaimVehiclePackageClient<$Result.GetResult<Prisma.$ClaimVehiclePackagePayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first ClaimVehiclePackage that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimVehiclePackageFindFirstArgs} args - Arguments to find a ClaimVehiclePackage
     * @example
     * // Get one ClaimVehiclePackage
     * const claimVehiclePackage = await prisma.claimVehiclePackage.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ClaimVehiclePackageFindFirstArgs>(args?: SelectSubset<T, ClaimVehiclePackageFindFirstArgs<ExtArgs>>): Prisma__ClaimVehiclePackageClient<$Result.GetResult<Prisma.$ClaimVehiclePackagePayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first ClaimVehiclePackage that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimVehiclePackageFindFirstOrThrowArgs} args - Arguments to find a ClaimVehiclePackage
     * @example
     * // Get one ClaimVehiclePackage
     * const claimVehiclePackage = await prisma.claimVehiclePackage.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ClaimVehiclePackageFindFirstOrThrowArgs>(args?: SelectSubset<T, ClaimVehiclePackageFindFirstOrThrowArgs<ExtArgs>>): Prisma__ClaimVehiclePackageClient<$Result.GetResult<Prisma.$ClaimVehiclePackagePayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more ClaimVehiclePackages that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimVehiclePackageFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ClaimVehiclePackages
     * const claimVehiclePackages = await prisma.claimVehiclePackage.findMany()
     * 
     * // Get first 10 ClaimVehiclePackages
     * const claimVehiclePackages = await prisma.claimVehiclePackage.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const claimVehiclePackageWithIdOnly = await prisma.claimVehiclePackage.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ClaimVehiclePackageFindManyArgs>(args?: SelectSubset<T, ClaimVehiclePackageFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClaimVehiclePackagePayload<ExtArgs>, T, "findMany">>

    /**
     * Create a ClaimVehiclePackage.
     * @param {ClaimVehiclePackageCreateArgs} args - Arguments to create a ClaimVehiclePackage.
     * @example
     * // Create one ClaimVehiclePackage
     * const ClaimVehiclePackage = await prisma.claimVehiclePackage.create({
     *   data: {
     *     // ... data to create a ClaimVehiclePackage
     *   }
     * })
     * 
     */
    create<T extends ClaimVehiclePackageCreateArgs>(args: SelectSubset<T, ClaimVehiclePackageCreateArgs<ExtArgs>>): Prisma__ClaimVehiclePackageClient<$Result.GetResult<Prisma.$ClaimVehiclePackagePayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many ClaimVehiclePackages.
     * @param {ClaimVehiclePackageCreateManyArgs} args - Arguments to create many ClaimVehiclePackages.
     * @example
     * // Create many ClaimVehiclePackages
     * const claimVehiclePackage = await prisma.claimVehiclePackage.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ClaimVehiclePackageCreateManyArgs>(args?: SelectSubset<T, ClaimVehiclePackageCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a ClaimVehiclePackage.
     * @param {ClaimVehiclePackageDeleteArgs} args - Arguments to delete one ClaimVehiclePackage.
     * @example
     * // Delete one ClaimVehiclePackage
     * const ClaimVehiclePackage = await prisma.claimVehiclePackage.delete({
     *   where: {
     *     // ... filter to delete one ClaimVehiclePackage
     *   }
     * })
     * 
     */
    delete<T extends ClaimVehiclePackageDeleteArgs>(args: SelectSubset<T, ClaimVehiclePackageDeleteArgs<ExtArgs>>): Prisma__ClaimVehiclePackageClient<$Result.GetResult<Prisma.$ClaimVehiclePackagePayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one ClaimVehiclePackage.
     * @param {ClaimVehiclePackageUpdateArgs} args - Arguments to update one ClaimVehiclePackage.
     * @example
     * // Update one ClaimVehiclePackage
     * const claimVehiclePackage = await prisma.claimVehiclePackage.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ClaimVehiclePackageUpdateArgs>(args: SelectSubset<T, ClaimVehiclePackageUpdateArgs<ExtArgs>>): Prisma__ClaimVehiclePackageClient<$Result.GetResult<Prisma.$ClaimVehiclePackagePayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more ClaimVehiclePackages.
     * @param {ClaimVehiclePackageDeleteManyArgs} args - Arguments to filter ClaimVehiclePackages to delete.
     * @example
     * // Delete a few ClaimVehiclePackages
     * const { count } = await prisma.claimVehiclePackage.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ClaimVehiclePackageDeleteManyArgs>(args?: SelectSubset<T, ClaimVehiclePackageDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ClaimVehiclePackages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimVehiclePackageUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ClaimVehiclePackages
     * const claimVehiclePackage = await prisma.claimVehiclePackage.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ClaimVehiclePackageUpdateManyArgs>(args: SelectSubset<T, ClaimVehiclePackageUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ClaimVehiclePackage.
     * @param {ClaimVehiclePackageUpsertArgs} args - Arguments to update or create a ClaimVehiclePackage.
     * @example
     * // Update or create a ClaimVehiclePackage
     * const claimVehiclePackage = await prisma.claimVehiclePackage.upsert({
     *   create: {
     *     // ... data to create a ClaimVehiclePackage
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ClaimVehiclePackage we want to update
     *   }
     * })
     */
    upsert<T extends ClaimVehiclePackageUpsertArgs>(args: SelectSubset<T, ClaimVehiclePackageUpsertArgs<ExtArgs>>): Prisma__ClaimVehiclePackageClient<$Result.GetResult<Prisma.$ClaimVehiclePackagePayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of ClaimVehiclePackages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimVehiclePackageCountArgs} args - Arguments to filter ClaimVehiclePackages to count.
     * @example
     * // Count the number of ClaimVehiclePackages
     * const count = await prisma.claimVehiclePackage.count({
     *   where: {
     *     // ... the filter for the ClaimVehiclePackages we want to count
     *   }
     * })
    **/
    count<T extends ClaimVehiclePackageCountArgs>(
      args?: Subset<T, ClaimVehiclePackageCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ClaimVehiclePackageCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ClaimVehiclePackage.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimVehiclePackageAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ClaimVehiclePackageAggregateArgs>(args: Subset<T, ClaimVehiclePackageAggregateArgs>): Prisma.PrismaPromise<GetClaimVehiclePackageAggregateType<T>>

    /**
     * Group by ClaimVehiclePackage.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimVehiclePackageGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ClaimVehiclePackageGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ClaimVehiclePackageGroupByArgs['orderBy'] }
        : { orderBy?: ClaimVehiclePackageGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ClaimVehiclePackageGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetClaimVehiclePackageGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ClaimVehiclePackage model
   */
  readonly fields: ClaimVehiclePackageFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ClaimVehiclePackage.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ClaimVehiclePackageClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    claim<T extends ClaimDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ClaimDefaultArgs<ExtArgs>>): Prisma__ClaimClient<$Result.GetResult<Prisma.$ClaimPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ClaimVehiclePackage model
   */ 
  interface ClaimVehiclePackageFieldRefs {
    readonly id: FieldRef<"ClaimVehiclePackage", 'String'>
    readonly claim_id: FieldRef<"ClaimVehiclePackage", 'BigInt'>
    readonly vehicle_registration: FieldRef<"ClaimVehiclePackage", 'String'>
    readonly vehicle_make: FieldRef<"ClaimVehiclePackage", 'String'>
    readonly vehicle_model: FieldRef<"ClaimVehiclePackage", 'String'>
    readonly dealership_name: FieldRef<"ClaimVehiclePackage", 'String'>
    readonly monthly_payment: FieldRef<"ClaimVehiclePackage", 'Decimal'>
    readonly contract_start_date: FieldRef<"ClaimVehiclePackage", 'DateTime'>
    readonly status: FieldRef<"ClaimVehiclePackage", 'String'>
    readonly created_at: FieldRef<"ClaimVehiclePackage", 'DateTime'>
    readonly updated_at: FieldRef<"ClaimVehiclePackage", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ClaimVehiclePackage findUnique
   */
  export type ClaimVehiclePackageFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimVehiclePackage
     */
    select?: ClaimVehiclePackageSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimVehiclePackageInclude<ExtArgs> | null
    /**
     * Filter, which ClaimVehiclePackage to fetch.
     */
    where: ClaimVehiclePackageWhereUniqueInput
  }

  /**
   * ClaimVehiclePackage findUniqueOrThrow
   */
  export type ClaimVehiclePackageFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimVehiclePackage
     */
    select?: ClaimVehiclePackageSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimVehiclePackageInclude<ExtArgs> | null
    /**
     * Filter, which ClaimVehiclePackage to fetch.
     */
    where: ClaimVehiclePackageWhereUniqueInput
  }

  /**
   * ClaimVehiclePackage findFirst
   */
  export type ClaimVehiclePackageFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimVehiclePackage
     */
    select?: ClaimVehiclePackageSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimVehiclePackageInclude<ExtArgs> | null
    /**
     * Filter, which ClaimVehiclePackage to fetch.
     */
    where?: ClaimVehiclePackageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClaimVehiclePackages to fetch.
     */
    orderBy?: ClaimVehiclePackageOrderByWithRelationInput | ClaimVehiclePackageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClaimVehiclePackages.
     */
    cursor?: ClaimVehiclePackageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClaimVehiclePackages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClaimVehiclePackages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClaimVehiclePackages.
     */
    distinct?: ClaimVehiclePackageScalarFieldEnum | ClaimVehiclePackageScalarFieldEnum[]
  }

  /**
   * ClaimVehiclePackage findFirstOrThrow
   */
  export type ClaimVehiclePackageFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimVehiclePackage
     */
    select?: ClaimVehiclePackageSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimVehiclePackageInclude<ExtArgs> | null
    /**
     * Filter, which ClaimVehiclePackage to fetch.
     */
    where?: ClaimVehiclePackageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClaimVehiclePackages to fetch.
     */
    orderBy?: ClaimVehiclePackageOrderByWithRelationInput | ClaimVehiclePackageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClaimVehiclePackages.
     */
    cursor?: ClaimVehiclePackageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClaimVehiclePackages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClaimVehiclePackages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClaimVehiclePackages.
     */
    distinct?: ClaimVehiclePackageScalarFieldEnum | ClaimVehiclePackageScalarFieldEnum[]
  }

  /**
   * ClaimVehiclePackage findMany
   */
  export type ClaimVehiclePackageFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimVehiclePackage
     */
    select?: ClaimVehiclePackageSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimVehiclePackageInclude<ExtArgs> | null
    /**
     * Filter, which ClaimVehiclePackages to fetch.
     */
    where?: ClaimVehiclePackageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClaimVehiclePackages to fetch.
     */
    orderBy?: ClaimVehiclePackageOrderByWithRelationInput | ClaimVehiclePackageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ClaimVehiclePackages.
     */
    cursor?: ClaimVehiclePackageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClaimVehiclePackages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClaimVehiclePackages.
     */
    skip?: number
    distinct?: ClaimVehiclePackageScalarFieldEnum | ClaimVehiclePackageScalarFieldEnum[]
  }

  /**
   * ClaimVehiclePackage create
   */
  export type ClaimVehiclePackageCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimVehiclePackage
     */
    select?: ClaimVehiclePackageSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimVehiclePackageInclude<ExtArgs> | null
    /**
     * The data needed to create a ClaimVehiclePackage.
     */
    data: XOR<ClaimVehiclePackageCreateInput, ClaimVehiclePackageUncheckedCreateInput>
  }

  /**
   * ClaimVehiclePackage createMany
   */
  export type ClaimVehiclePackageCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ClaimVehiclePackages.
     */
    data: ClaimVehiclePackageCreateManyInput | ClaimVehiclePackageCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ClaimVehiclePackage update
   */
  export type ClaimVehiclePackageUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimVehiclePackage
     */
    select?: ClaimVehiclePackageSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimVehiclePackageInclude<ExtArgs> | null
    /**
     * The data needed to update a ClaimVehiclePackage.
     */
    data: XOR<ClaimVehiclePackageUpdateInput, ClaimVehiclePackageUncheckedUpdateInput>
    /**
     * Choose, which ClaimVehiclePackage to update.
     */
    where: ClaimVehiclePackageWhereUniqueInput
  }

  /**
   * ClaimVehiclePackage updateMany
   */
  export type ClaimVehiclePackageUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ClaimVehiclePackages.
     */
    data: XOR<ClaimVehiclePackageUpdateManyMutationInput, ClaimVehiclePackageUncheckedUpdateManyInput>
    /**
     * Filter which ClaimVehiclePackages to update
     */
    where?: ClaimVehiclePackageWhereInput
  }

  /**
   * ClaimVehiclePackage upsert
   */
  export type ClaimVehiclePackageUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimVehiclePackage
     */
    select?: ClaimVehiclePackageSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimVehiclePackageInclude<ExtArgs> | null
    /**
     * The filter to search for the ClaimVehiclePackage to update in case it exists.
     */
    where: ClaimVehiclePackageWhereUniqueInput
    /**
     * In case the ClaimVehiclePackage found by the `where` argument doesn't exist, create a new ClaimVehiclePackage with this data.
     */
    create: XOR<ClaimVehiclePackageCreateInput, ClaimVehiclePackageUncheckedCreateInput>
    /**
     * In case the ClaimVehiclePackage was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ClaimVehiclePackageUpdateInput, ClaimVehiclePackageUncheckedUpdateInput>
  }

  /**
   * ClaimVehiclePackage delete
   */
  export type ClaimVehiclePackageDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimVehiclePackage
     */
    select?: ClaimVehiclePackageSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimVehiclePackageInclude<ExtArgs> | null
    /**
     * Filter which ClaimVehiclePackage to delete.
     */
    where: ClaimVehiclePackageWhereUniqueInput
  }

  /**
   * ClaimVehiclePackage deleteMany
   */
  export type ClaimVehiclePackageDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClaimVehiclePackages to delete
     */
    where?: ClaimVehiclePackageWhereInput
  }

  /**
   * ClaimVehiclePackage without action
   */
  export type ClaimVehiclePackageDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimVehiclePackage
     */
    select?: ClaimVehiclePackageSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimVehiclePackageInclude<ExtArgs> | null
  }


  /**
   * Model UserLog
   */

  export type AggregateUserLog = {
    _count: UserLogCountAggregateOutputType | null
    _avg: UserLogAvgAggregateOutputType | null
    _sum: UserLogSumAggregateOutputType | null
    _min: UserLogMinAggregateOutputType | null
    _max: UserLogMaxAggregateOutputType | null
  }

  export type UserLogAvgAggregateOutputType = {
    user_id: number | null
  }

  export type UserLogSumAggregateOutputType = {
    user_id: bigint | null
  }

  export type UserLogMinAggregateOutputType = {
    id: string | null
    user_id: bigint | null
    type: string | null
    detail: string | null
    ip_address: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type UserLogMaxAggregateOutputType = {
    id: string | null
    user_id: bigint | null
    type: string | null
    detail: string | null
    ip_address: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type UserLogCountAggregateOutputType = {
    id: number
    user_id: number
    type: number
    detail: number
    ip_address: number
    created_at: number
    updated_at: number
    _all: number
  }


  export type UserLogAvgAggregateInputType = {
    user_id?: true
  }

  export type UserLogSumAggregateInputType = {
    user_id?: true
  }

  export type UserLogMinAggregateInputType = {
    id?: true
    user_id?: true
    type?: true
    detail?: true
    ip_address?: true
    created_at?: true
    updated_at?: true
  }

  export type UserLogMaxAggregateInputType = {
    id?: true
    user_id?: true
    type?: true
    detail?: true
    ip_address?: true
    created_at?: true
    updated_at?: true
  }

  export type UserLogCountAggregateInputType = {
    id?: true
    user_id?: true
    type?: true
    detail?: true
    ip_address?: true
    created_at?: true
    updated_at?: true
    _all?: true
  }

  export type UserLogAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserLog to aggregate.
     */
    where?: UserLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserLogs to fetch.
     */
    orderBy?: UserLogOrderByWithRelationInput | UserLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UserLogs
    **/
    _count?: true | UserLogCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserLogAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserLogSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserLogMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserLogMaxAggregateInputType
  }

  export type GetUserLogAggregateType<T extends UserLogAggregateArgs> = {
        [P in keyof T & keyof AggregateUserLog]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUserLog[P]>
      : GetScalarType<T[P], AggregateUserLog[P]>
  }




  export type UserLogGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserLogWhereInput
    orderBy?: UserLogOrderByWithAggregationInput | UserLogOrderByWithAggregationInput[]
    by: UserLogScalarFieldEnum[] | UserLogScalarFieldEnum
    having?: UserLogScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserLogCountAggregateInputType | true
    _avg?: UserLogAvgAggregateInputType
    _sum?: UserLogSumAggregateInputType
    _min?: UserLogMinAggregateInputType
    _max?: UserLogMaxAggregateInputType
  }

  export type UserLogGroupByOutputType = {
    id: string
    user_id: bigint
    type: string
    detail: string
    ip_address: string | null
    created_at: Date | null
    updated_at: Date | null
    _count: UserLogCountAggregateOutputType | null
    _avg: UserLogAvgAggregateOutputType | null
    _sum: UserLogSumAggregateOutputType | null
    _min: UserLogMinAggregateOutputType | null
    _max: UserLogMaxAggregateOutputType | null
  }

  type GetUserLogGroupByPayload<T extends UserLogGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserLogGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserLogGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserLogGroupByOutputType[P]>
            : GetScalarType<T[P], UserLogGroupByOutputType[P]>
        }
      >
    >


  export type UserLogSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    type?: boolean
    detail?: boolean
    ip_address?: boolean
    created_at?: boolean
    updated_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["userLog"]>


  export type UserLogSelectScalar = {
    id?: boolean
    user_id?: boolean
    type?: boolean
    detail?: boolean
    ip_address?: boolean
    created_at?: boolean
    updated_at?: boolean
  }

  export type UserLogInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $UserLogPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UserLog"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      user_id: bigint
      type: string
      detail: string
      ip_address: string | null
      created_at: Date | null
      updated_at: Date | null
    }, ExtArgs["result"]["userLog"]>
    composites: {}
  }

  type UserLogGetPayload<S extends boolean | null | undefined | UserLogDefaultArgs> = $Result.GetResult<Prisma.$UserLogPayload, S>

  type UserLogCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<UserLogFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: UserLogCountAggregateInputType | true
    }

  export interface UserLogDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UserLog'], meta: { name: 'UserLog' } }
    /**
     * Find zero or one UserLog that matches the filter.
     * @param {UserLogFindUniqueArgs} args - Arguments to find a UserLog
     * @example
     * // Get one UserLog
     * const userLog = await prisma.userLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserLogFindUniqueArgs>(args: SelectSubset<T, UserLogFindUniqueArgs<ExtArgs>>): Prisma__UserLogClient<$Result.GetResult<Prisma.$UserLogPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one UserLog that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {UserLogFindUniqueOrThrowArgs} args - Arguments to find a UserLog
     * @example
     * // Get one UserLog
     * const userLog = await prisma.userLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserLogFindUniqueOrThrowArgs>(args: SelectSubset<T, UserLogFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserLogClient<$Result.GetResult<Prisma.$UserLogPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first UserLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserLogFindFirstArgs} args - Arguments to find a UserLog
     * @example
     * // Get one UserLog
     * const userLog = await prisma.userLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserLogFindFirstArgs>(args?: SelectSubset<T, UserLogFindFirstArgs<ExtArgs>>): Prisma__UserLogClient<$Result.GetResult<Prisma.$UserLogPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first UserLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserLogFindFirstOrThrowArgs} args - Arguments to find a UserLog
     * @example
     * // Get one UserLog
     * const userLog = await prisma.userLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserLogFindFirstOrThrowArgs>(args?: SelectSubset<T, UserLogFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserLogClient<$Result.GetResult<Prisma.$UserLogPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more UserLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UserLogs
     * const userLogs = await prisma.userLog.findMany()
     * 
     * // Get first 10 UserLogs
     * const userLogs = await prisma.userLog.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userLogWithIdOnly = await prisma.userLog.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserLogFindManyArgs>(args?: SelectSubset<T, UserLogFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserLogPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a UserLog.
     * @param {UserLogCreateArgs} args - Arguments to create a UserLog.
     * @example
     * // Create one UserLog
     * const UserLog = await prisma.userLog.create({
     *   data: {
     *     // ... data to create a UserLog
     *   }
     * })
     * 
     */
    create<T extends UserLogCreateArgs>(args: SelectSubset<T, UserLogCreateArgs<ExtArgs>>): Prisma__UserLogClient<$Result.GetResult<Prisma.$UserLogPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many UserLogs.
     * @param {UserLogCreateManyArgs} args - Arguments to create many UserLogs.
     * @example
     * // Create many UserLogs
     * const userLog = await prisma.userLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserLogCreateManyArgs>(args?: SelectSubset<T, UserLogCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a UserLog.
     * @param {UserLogDeleteArgs} args - Arguments to delete one UserLog.
     * @example
     * // Delete one UserLog
     * const UserLog = await prisma.userLog.delete({
     *   where: {
     *     // ... filter to delete one UserLog
     *   }
     * })
     * 
     */
    delete<T extends UserLogDeleteArgs>(args: SelectSubset<T, UserLogDeleteArgs<ExtArgs>>): Prisma__UserLogClient<$Result.GetResult<Prisma.$UserLogPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one UserLog.
     * @param {UserLogUpdateArgs} args - Arguments to update one UserLog.
     * @example
     * // Update one UserLog
     * const userLog = await prisma.userLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserLogUpdateArgs>(args: SelectSubset<T, UserLogUpdateArgs<ExtArgs>>): Prisma__UserLogClient<$Result.GetResult<Prisma.$UserLogPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more UserLogs.
     * @param {UserLogDeleteManyArgs} args - Arguments to filter UserLogs to delete.
     * @example
     * // Delete a few UserLogs
     * const { count } = await prisma.userLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserLogDeleteManyArgs>(args?: SelectSubset<T, UserLogDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UserLogs
     * const userLog = await prisma.userLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserLogUpdateManyArgs>(args: SelectSubset<T, UserLogUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one UserLog.
     * @param {UserLogUpsertArgs} args - Arguments to update or create a UserLog.
     * @example
     * // Update or create a UserLog
     * const userLog = await prisma.userLog.upsert({
     *   create: {
     *     // ... data to create a UserLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UserLog we want to update
     *   }
     * })
     */
    upsert<T extends UserLogUpsertArgs>(args: SelectSubset<T, UserLogUpsertArgs<ExtArgs>>): Prisma__UserLogClient<$Result.GetResult<Prisma.$UserLogPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of UserLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserLogCountArgs} args - Arguments to filter UserLogs to count.
     * @example
     * // Count the number of UserLogs
     * const count = await prisma.userLog.count({
     *   where: {
     *     // ... the filter for the UserLogs we want to count
     *   }
     * })
    **/
    count<T extends UserLogCountArgs>(
      args?: Subset<T, UserLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserLogCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a UserLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserLogAggregateArgs>(args: Subset<T, UserLogAggregateArgs>): Prisma.PrismaPromise<GetUserLogAggregateType<T>>

    /**
     * Group by UserLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserLogGroupByArgs['orderBy'] }
        : { orderBy?: UserLogGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserLogGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserLogGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the UserLog model
   */
  readonly fields: UserLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UserLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserLogClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UserLog model
   */ 
  interface UserLogFieldRefs {
    readonly id: FieldRef<"UserLog", 'String'>
    readonly user_id: FieldRef<"UserLog", 'BigInt'>
    readonly type: FieldRef<"UserLog", 'String'>
    readonly detail: FieldRef<"UserLog", 'String'>
    readonly ip_address: FieldRef<"UserLog", 'String'>
    readonly created_at: FieldRef<"UserLog", 'DateTime'>
    readonly updated_at: FieldRef<"UserLog", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * UserLog findUnique
   */
  export type UserLogFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserLog
     */
    select?: UserLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserLogInclude<ExtArgs> | null
    /**
     * Filter, which UserLog to fetch.
     */
    where: UserLogWhereUniqueInput
  }

  /**
   * UserLog findUniqueOrThrow
   */
  export type UserLogFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserLog
     */
    select?: UserLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserLogInclude<ExtArgs> | null
    /**
     * Filter, which UserLog to fetch.
     */
    where: UserLogWhereUniqueInput
  }

  /**
   * UserLog findFirst
   */
  export type UserLogFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserLog
     */
    select?: UserLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserLogInclude<ExtArgs> | null
    /**
     * Filter, which UserLog to fetch.
     */
    where?: UserLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserLogs to fetch.
     */
    orderBy?: UserLogOrderByWithRelationInput | UserLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserLogs.
     */
    cursor?: UserLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserLogs.
     */
    distinct?: UserLogScalarFieldEnum | UserLogScalarFieldEnum[]
  }

  /**
   * UserLog findFirstOrThrow
   */
  export type UserLogFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserLog
     */
    select?: UserLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserLogInclude<ExtArgs> | null
    /**
     * Filter, which UserLog to fetch.
     */
    where?: UserLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserLogs to fetch.
     */
    orderBy?: UserLogOrderByWithRelationInput | UserLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserLogs.
     */
    cursor?: UserLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserLogs.
     */
    distinct?: UserLogScalarFieldEnum | UserLogScalarFieldEnum[]
  }

  /**
   * UserLog findMany
   */
  export type UserLogFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserLog
     */
    select?: UserLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserLogInclude<ExtArgs> | null
    /**
     * Filter, which UserLogs to fetch.
     */
    where?: UserLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserLogs to fetch.
     */
    orderBy?: UserLogOrderByWithRelationInput | UserLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UserLogs.
     */
    cursor?: UserLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserLogs.
     */
    skip?: number
    distinct?: UserLogScalarFieldEnum | UserLogScalarFieldEnum[]
  }

  /**
   * UserLog create
   */
  export type UserLogCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserLog
     */
    select?: UserLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserLogInclude<ExtArgs> | null
    /**
     * The data needed to create a UserLog.
     */
    data: XOR<UserLogCreateInput, UserLogUncheckedCreateInput>
  }

  /**
   * UserLog createMany
   */
  export type UserLogCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UserLogs.
     */
    data: UserLogCreateManyInput | UserLogCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserLog update
   */
  export type UserLogUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserLog
     */
    select?: UserLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserLogInclude<ExtArgs> | null
    /**
     * The data needed to update a UserLog.
     */
    data: XOR<UserLogUpdateInput, UserLogUncheckedUpdateInput>
    /**
     * Choose, which UserLog to update.
     */
    where: UserLogWhereUniqueInput
  }

  /**
   * UserLog updateMany
   */
  export type UserLogUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UserLogs.
     */
    data: XOR<UserLogUpdateManyMutationInput, UserLogUncheckedUpdateManyInput>
    /**
     * Filter which UserLogs to update
     */
    where?: UserLogWhereInput
  }

  /**
   * UserLog upsert
   */
  export type UserLogUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserLog
     */
    select?: UserLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserLogInclude<ExtArgs> | null
    /**
     * The filter to search for the UserLog to update in case it exists.
     */
    where: UserLogWhereUniqueInput
    /**
     * In case the UserLog found by the `where` argument doesn't exist, create a new UserLog with this data.
     */
    create: XOR<UserLogCreateInput, UserLogUncheckedCreateInput>
    /**
     * In case the UserLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserLogUpdateInput, UserLogUncheckedUpdateInput>
  }

  /**
   * UserLog delete
   */
  export type UserLogDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserLog
     */
    select?: UserLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserLogInclude<ExtArgs> | null
    /**
     * Filter which UserLog to delete.
     */
    where: UserLogWhereUniqueInput
  }

  /**
   * UserLog deleteMany
   */
  export type UserLogDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserLogs to delete
     */
    where?: UserLogWhereInput
  }

  /**
   * UserLog without action
   */
  export type UserLogDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserLog
     */
    select?: UserLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserLogInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    email_address: 'email_address',
    password: 'password',
    is_enabled: 'is_enabled',
    status: 'status',
    first_name: 'first_name',
    last_name: 'last_name',
    phone_number: 'phone_number',
    date_of_birth: 'date_of_birth',
    previous_name: 'previous_name',
    current_user_address_id: 'current_user_address_id',
    current_user_id_document_id: 'current_user_id_document_id',
    current_signature_file_id: 'current_signature_file_id',
    notification_channels: 'notification_channels',
    third_party_claim_partner: 'third_party_claim_partner',
    introducer: 'introducer',
    solicitor: 'solicitor',
    credit_response_selection_completed: 'credit_response_selection_completed',
    justcall_id: 'justcall_id',
    voluum_click_id: 'voluum_click_id',
    pipedrive_id: 'pipedrive_id',
    google_drive_link: 'google_drive_link',
    last_login: 'last_login',
    remember_token: 'remember_token',
    checkboard_address_links_api_request: 'checkboard_address_links_api_request',
    checkboard_address_links_api_response: 'checkboard_address_links_api_response',
    checkboard_user_invite_api_request: 'checkboard_user_invite_api_request',
    checkboard_user_batch_api_request: 'checkboard_user_batch_api_request',
    checkboard_user_verify_otp_api_request: 'checkboard_user_verify_otp_api_request',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const ClaimScalarFieldEnum: {
    id: 'id',
    user_id: 'user_id',
    type: 'type',
    status: 'status',
    lender: 'lender',
    solicitor: 'solicitor',
    client_last_updated_at: 'client_last_updated_at',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  export type ClaimScalarFieldEnum = (typeof ClaimScalarFieldEnum)[keyof typeof ClaimScalarFieldEnum]


  export const UserAddressScalarFieldEnum: {
    id: 'id',
    user_id: 'user_id',
    type: 'type',
    is_linked_address: 'is_linked_address',
    full_address: 'full_address',
    address_line_1: 'address_line_1',
    address_line_2: 'address_line_2',
    house_number: 'house_number',
    street: 'street',
    building_name: 'building_name',
    county: 'county',
    district: 'district',
    post_code: 'post_code',
    post_town: 'post_town',
    country: 'country',
    checkboard_address_id: 'checkboard_address_id',
    checkboard_raw_address: 'checkboard_raw_address',
    is_parsed_address: 'is_parsed_address',
    openai_matching_result: 'openai_matching_result',
    openai_matching_api_details: 'openai_matching_api_details',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  export type UserAddressScalarFieldEnum = (typeof UserAddressScalarFieldEnum)[keyof typeof UserAddressScalarFieldEnum]


  export const ClaimRequirementScalarFieldEnum: {
    id: 'id',
    claim_id: 'claim_id',
    type: 'type',
    status: 'status',
    claim_requirement_reason: 'claim_requirement_reason',
    claim_requirement_rejection_reason: 'claim_requirement_rejection_reason',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  export type ClaimRequirementScalarFieldEnum = (typeof ClaimRequirementScalarFieldEnum)[keyof typeof ClaimRequirementScalarFieldEnum]


  export const ClaimVehiclePackageScalarFieldEnum: {
    id: 'id',
    claim_id: 'claim_id',
    vehicle_registration: 'vehicle_registration',
    vehicle_make: 'vehicle_make',
    vehicle_model: 'vehicle_model',
    dealership_name: 'dealership_name',
    monthly_payment: 'monthly_payment',
    contract_start_date: 'contract_start_date',
    status: 'status',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  export type ClaimVehiclePackageScalarFieldEnum = (typeof ClaimVehiclePackageScalarFieldEnum)[keyof typeof ClaimVehiclePackageScalarFieldEnum]


  export const UserLogScalarFieldEnum: {
    id: 'id',
    user_id: 'user_id',
    type: 'type',
    detail: 'detail',
    ip_address: 'ip_address',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  export type UserLogScalarFieldEnum = (typeof UserLogScalarFieldEnum)[keyof typeof UserLogScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'BigInt'
   */
  export type BigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BigInt'>
    


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: BigIntFilter<"User"> | bigint | number
    email_address?: StringNullableFilter<"User"> | string | null
    password?: StringNullableFilter<"User"> | string | null
    is_enabled?: BoolFilter<"User"> | boolean
    status?: StringNullableFilter<"User"> | string | null
    first_name?: StringNullableFilter<"User"> | string | null
    last_name?: StringNullableFilter<"User"> | string | null
    phone_number?: StringNullableFilter<"User"> | string | null
    date_of_birth?: DateTimeNullableFilter<"User"> | Date | string | null
    previous_name?: StringNullableFilter<"User"> | string | null
    current_user_address_id?: StringNullableFilter<"User"> | string | null
    current_user_id_document_id?: StringNullableFilter<"User"> | string | null
    current_signature_file_id?: StringNullableFilter<"User"> | string | null
    notification_channels?: JsonNullableFilter<"User">
    third_party_claim_partner?: StringNullableFilter<"User"> | string | null
    introducer?: StringFilter<"User"> | string
    solicitor?: StringNullableFilter<"User"> | string | null
    credit_response_selection_completed?: BoolFilter<"User"> | boolean
    justcall_id?: IntNullableFilter<"User"> | number | null
    voluum_click_id?: StringNullableFilter<"User"> | string | null
    pipedrive_id?: StringNullableFilter<"User"> | string | null
    google_drive_link?: StringNullableFilter<"User"> | string | null
    last_login?: DateTimeNullableFilter<"User"> | Date | string | null
    remember_token?: StringNullableFilter<"User"> | string | null
    checkboard_address_links_api_request?: JsonNullableFilter<"User">
    checkboard_address_links_api_response?: JsonNullableFilter<"User">
    checkboard_user_invite_api_request?: JsonNullableFilter<"User">
    checkboard_user_batch_api_request?: JsonNullableFilter<"User">
    checkboard_user_verify_otp_api_request?: JsonNullableFilter<"User">
    created_at?: DateTimeNullableFilter<"User"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"User"> | Date | string | null
    claims?: ClaimListRelationFilter
    address?: XOR<UserAddressNullableRelationFilter, UserAddressWhereInput> | null
    user_logs?: UserLogListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email_address?: SortOrderInput | SortOrder
    password?: SortOrderInput | SortOrder
    is_enabled?: SortOrder
    status?: SortOrderInput | SortOrder
    first_name?: SortOrderInput | SortOrder
    last_name?: SortOrderInput | SortOrder
    phone_number?: SortOrderInput | SortOrder
    date_of_birth?: SortOrderInput | SortOrder
    previous_name?: SortOrderInput | SortOrder
    current_user_address_id?: SortOrderInput | SortOrder
    current_user_id_document_id?: SortOrderInput | SortOrder
    current_signature_file_id?: SortOrderInput | SortOrder
    notification_channels?: SortOrderInput | SortOrder
    third_party_claim_partner?: SortOrderInput | SortOrder
    introducer?: SortOrder
    solicitor?: SortOrderInput | SortOrder
    credit_response_selection_completed?: SortOrder
    justcall_id?: SortOrderInput | SortOrder
    voluum_click_id?: SortOrderInput | SortOrder
    pipedrive_id?: SortOrderInput | SortOrder
    google_drive_link?: SortOrderInput | SortOrder
    last_login?: SortOrderInput | SortOrder
    remember_token?: SortOrderInput | SortOrder
    checkboard_address_links_api_request?: SortOrderInput | SortOrder
    checkboard_address_links_api_response?: SortOrderInput | SortOrder
    checkboard_user_invite_api_request?: SortOrderInput | SortOrder
    checkboard_user_batch_api_request?: SortOrderInput | SortOrder
    checkboard_user_verify_otp_api_request?: SortOrderInput | SortOrder
    created_at?: SortOrderInput | SortOrder
    updated_at?: SortOrderInput | SortOrder
    claims?: ClaimOrderByRelationAggregateInput
    address?: UserAddressOrderByWithRelationInput
    user_logs?: UserLogOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: bigint | number
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    email_address?: StringNullableFilter<"User"> | string | null
    password?: StringNullableFilter<"User"> | string | null
    is_enabled?: BoolFilter<"User"> | boolean
    status?: StringNullableFilter<"User"> | string | null
    first_name?: StringNullableFilter<"User"> | string | null
    last_name?: StringNullableFilter<"User"> | string | null
    phone_number?: StringNullableFilter<"User"> | string | null
    date_of_birth?: DateTimeNullableFilter<"User"> | Date | string | null
    previous_name?: StringNullableFilter<"User"> | string | null
    current_user_address_id?: StringNullableFilter<"User"> | string | null
    current_user_id_document_id?: StringNullableFilter<"User"> | string | null
    current_signature_file_id?: StringNullableFilter<"User"> | string | null
    notification_channels?: JsonNullableFilter<"User">
    third_party_claim_partner?: StringNullableFilter<"User"> | string | null
    introducer?: StringFilter<"User"> | string
    solicitor?: StringNullableFilter<"User"> | string | null
    credit_response_selection_completed?: BoolFilter<"User"> | boolean
    justcall_id?: IntNullableFilter<"User"> | number | null
    voluum_click_id?: StringNullableFilter<"User"> | string | null
    pipedrive_id?: StringNullableFilter<"User"> | string | null
    google_drive_link?: StringNullableFilter<"User"> | string | null
    last_login?: DateTimeNullableFilter<"User"> | Date | string | null
    remember_token?: StringNullableFilter<"User"> | string | null
    checkboard_address_links_api_request?: JsonNullableFilter<"User">
    checkboard_address_links_api_response?: JsonNullableFilter<"User">
    checkboard_user_invite_api_request?: JsonNullableFilter<"User">
    checkboard_user_batch_api_request?: JsonNullableFilter<"User">
    checkboard_user_verify_otp_api_request?: JsonNullableFilter<"User">
    created_at?: DateTimeNullableFilter<"User"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"User"> | Date | string | null
    claims?: ClaimListRelationFilter
    address?: XOR<UserAddressNullableRelationFilter, UserAddressWhereInput> | null
    user_logs?: UserLogListRelationFilter
  }, "id">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email_address?: SortOrderInput | SortOrder
    password?: SortOrderInput | SortOrder
    is_enabled?: SortOrder
    status?: SortOrderInput | SortOrder
    first_name?: SortOrderInput | SortOrder
    last_name?: SortOrderInput | SortOrder
    phone_number?: SortOrderInput | SortOrder
    date_of_birth?: SortOrderInput | SortOrder
    previous_name?: SortOrderInput | SortOrder
    current_user_address_id?: SortOrderInput | SortOrder
    current_user_id_document_id?: SortOrderInput | SortOrder
    current_signature_file_id?: SortOrderInput | SortOrder
    notification_channels?: SortOrderInput | SortOrder
    third_party_claim_partner?: SortOrderInput | SortOrder
    introducer?: SortOrder
    solicitor?: SortOrderInput | SortOrder
    credit_response_selection_completed?: SortOrder
    justcall_id?: SortOrderInput | SortOrder
    voluum_click_id?: SortOrderInput | SortOrder
    pipedrive_id?: SortOrderInput | SortOrder
    google_drive_link?: SortOrderInput | SortOrder
    last_login?: SortOrderInput | SortOrder
    remember_token?: SortOrderInput | SortOrder
    checkboard_address_links_api_request?: SortOrderInput | SortOrder
    checkboard_address_links_api_response?: SortOrderInput | SortOrder
    checkboard_user_invite_api_request?: SortOrderInput | SortOrder
    checkboard_user_batch_api_request?: SortOrderInput | SortOrder
    checkboard_user_verify_otp_api_request?: SortOrderInput | SortOrder
    created_at?: SortOrderInput | SortOrder
    updated_at?: SortOrderInput | SortOrder
    _count?: UserCountOrderByAggregateInput
    _avg?: UserAvgOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
    _sum?: UserSumOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: BigIntWithAggregatesFilter<"User"> | bigint | number
    email_address?: StringNullableWithAggregatesFilter<"User"> | string | null
    password?: StringNullableWithAggregatesFilter<"User"> | string | null
    is_enabled?: BoolWithAggregatesFilter<"User"> | boolean
    status?: StringNullableWithAggregatesFilter<"User"> | string | null
    first_name?: StringNullableWithAggregatesFilter<"User"> | string | null
    last_name?: StringNullableWithAggregatesFilter<"User"> | string | null
    phone_number?: StringNullableWithAggregatesFilter<"User"> | string | null
    date_of_birth?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
    previous_name?: StringNullableWithAggregatesFilter<"User"> | string | null
    current_user_address_id?: StringNullableWithAggregatesFilter<"User"> | string | null
    current_user_id_document_id?: StringNullableWithAggregatesFilter<"User"> | string | null
    current_signature_file_id?: StringNullableWithAggregatesFilter<"User"> | string | null
    notification_channels?: JsonNullableWithAggregatesFilter<"User">
    third_party_claim_partner?: StringNullableWithAggregatesFilter<"User"> | string | null
    introducer?: StringWithAggregatesFilter<"User"> | string
    solicitor?: StringNullableWithAggregatesFilter<"User"> | string | null
    credit_response_selection_completed?: BoolWithAggregatesFilter<"User"> | boolean
    justcall_id?: IntNullableWithAggregatesFilter<"User"> | number | null
    voluum_click_id?: StringNullableWithAggregatesFilter<"User"> | string | null
    pipedrive_id?: StringNullableWithAggregatesFilter<"User"> | string | null
    google_drive_link?: StringNullableWithAggregatesFilter<"User"> | string | null
    last_login?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
    remember_token?: StringNullableWithAggregatesFilter<"User"> | string | null
    checkboard_address_links_api_request?: JsonNullableWithAggregatesFilter<"User">
    checkboard_address_links_api_response?: JsonNullableWithAggregatesFilter<"User">
    checkboard_user_invite_api_request?: JsonNullableWithAggregatesFilter<"User">
    checkboard_user_batch_api_request?: JsonNullableWithAggregatesFilter<"User">
    checkboard_user_verify_otp_api_request?: JsonNullableWithAggregatesFilter<"User">
    created_at?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
    updated_at?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
  }

  export type ClaimWhereInput = {
    AND?: ClaimWhereInput | ClaimWhereInput[]
    OR?: ClaimWhereInput[]
    NOT?: ClaimWhereInput | ClaimWhereInput[]
    id?: BigIntFilter<"Claim"> | bigint | number
    user_id?: BigIntFilter<"Claim"> | bigint | number
    type?: StringNullableFilter<"Claim"> | string | null
    status?: StringNullableFilter<"Claim"> | string | null
    lender?: StringNullableFilter<"Claim"> | string | null
    solicitor?: StringNullableFilter<"Claim"> | string | null
    client_last_updated_at?: DateTimeNullableFilter<"Claim"> | Date | string | null
    created_at?: DateTimeNullableFilter<"Claim"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"Claim"> | Date | string | null
    user?: XOR<UserRelationFilter, UserWhereInput>
    requirements?: ClaimRequirementListRelationFilter
    vehiclePackages?: ClaimVehiclePackageListRelationFilter
  }

  export type ClaimOrderByWithRelationInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrderInput | SortOrder
    status?: SortOrderInput | SortOrder
    lender?: SortOrderInput | SortOrder
    solicitor?: SortOrderInput | SortOrder
    client_last_updated_at?: SortOrderInput | SortOrder
    created_at?: SortOrderInput | SortOrder
    updated_at?: SortOrderInput | SortOrder
    user?: UserOrderByWithRelationInput
    requirements?: ClaimRequirementOrderByRelationAggregateInput
    vehiclePackages?: ClaimVehiclePackageOrderByRelationAggregateInput
  }

  export type ClaimWhereUniqueInput = Prisma.AtLeast<{
    id?: bigint | number
    AND?: ClaimWhereInput | ClaimWhereInput[]
    OR?: ClaimWhereInput[]
    NOT?: ClaimWhereInput | ClaimWhereInput[]
    user_id?: BigIntFilter<"Claim"> | bigint | number
    type?: StringNullableFilter<"Claim"> | string | null
    status?: StringNullableFilter<"Claim"> | string | null
    lender?: StringNullableFilter<"Claim"> | string | null
    solicitor?: StringNullableFilter<"Claim"> | string | null
    client_last_updated_at?: DateTimeNullableFilter<"Claim"> | Date | string | null
    created_at?: DateTimeNullableFilter<"Claim"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"Claim"> | Date | string | null
    user?: XOR<UserRelationFilter, UserWhereInput>
    requirements?: ClaimRequirementListRelationFilter
    vehiclePackages?: ClaimVehiclePackageListRelationFilter
  }, "id">

  export type ClaimOrderByWithAggregationInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrderInput | SortOrder
    status?: SortOrderInput | SortOrder
    lender?: SortOrderInput | SortOrder
    solicitor?: SortOrderInput | SortOrder
    client_last_updated_at?: SortOrderInput | SortOrder
    created_at?: SortOrderInput | SortOrder
    updated_at?: SortOrderInput | SortOrder
    _count?: ClaimCountOrderByAggregateInput
    _avg?: ClaimAvgOrderByAggregateInput
    _max?: ClaimMaxOrderByAggregateInput
    _min?: ClaimMinOrderByAggregateInput
    _sum?: ClaimSumOrderByAggregateInput
  }

  export type ClaimScalarWhereWithAggregatesInput = {
    AND?: ClaimScalarWhereWithAggregatesInput | ClaimScalarWhereWithAggregatesInput[]
    OR?: ClaimScalarWhereWithAggregatesInput[]
    NOT?: ClaimScalarWhereWithAggregatesInput | ClaimScalarWhereWithAggregatesInput[]
    id?: BigIntWithAggregatesFilter<"Claim"> | bigint | number
    user_id?: BigIntWithAggregatesFilter<"Claim"> | bigint | number
    type?: StringNullableWithAggregatesFilter<"Claim"> | string | null
    status?: StringNullableWithAggregatesFilter<"Claim"> | string | null
    lender?: StringNullableWithAggregatesFilter<"Claim"> | string | null
    solicitor?: StringNullableWithAggregatesFilter<"Claim"> | string | null
    client_last_updated_at?: DateTimeNullableWithAggregatesFilter<"Claim"> | Date | string | null
    created_at?: DateTimeNullableWithAggregatesFilter<"Claim"> | Date | string | null
    updated_at?: DateTimeNullableWithAggregatesFilter<"Claim"> | Date | string | null
  }

  export type UserAddressWhereInput = {
    AND?: UserAddressWhereInput | UserAddressWhereInput[]
    OR?: UserAddressWhereInput[]
    NOT?: UserAddressWhereInput | UserAddressWhereInput[]
    id?: StringFilter<"UserAddress"> | string
    user_id?: IntFilter<"UserAddress"> | number
    type?: StringNullableFilter<"UserAddress"> | string | null
    is_linked_address?: BoolFilter<"UserAddress"> | boolean
    full_address?: StringNullableFilter<"UserAddress"> | string | null
    address_line_1?: StringNullableFilter<"UserAddress"> | string | null
    address_line_2?: StringNullableFilter<"UserAddress"> | string | null
    house_number?: StringNullableFilter<"UserAddress"> | string | null
    street?: StringNullableFilter<"UserAddress"> | string | null
    building_name?: StringNullableFilter<"UserAddress"> | string | null
    county?: StringNullableFilter<"UserAddress"> | string | null
    district?: StringNullableFilter<"UserAddress"> | string | null
    post_code?: StringNullableFilter<"UserAddress"> | string | null
    post_town?: StringNullableFilter<"UserAddress"> | string | null
    country?: StringNullableFilter<"UserAddress"> | string | null
    checkboard_address_id?: StringNullableFilter<"UserAddress"> | string | null
    checkboard_raw_address?: JsonNullableFilter<"UserAddress">
    is_parsed_address?: BoolFilter<"UserAddress"> | boolean
    openai_matching_result?: JsonNullableFilter<"UserAddress">
    openai_matching_api_details?: JsonNullableFilter<"UserAddress">
    created_at?: DateTimeNullableFilter<"UserAddress"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"UserAddress"> | Date | string | null
    users?: UserListRelationFilter
  }

  export type UserAddressOrderByWithRelationInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrderInput | SortOrder
    is_linked_address?: SortOrder
    full_address?: SortOrderInput | SortOrder
    address_line_1?: SortOrderInput | SortOrder
    address_line_2?: SortOrderInput | SortOrder
    house_number?: SortOrderInput | SortOrder
    street?: SortOrderInput | SortOrder
    building_name?: SortOrderInput | SortOrder
    county?: SortOrderInput | SortOrder
    district?: SortOrderInput | SortOrder
    post_code?: SortOrderInput | SortOrder
    post_town?: SortOrderInput | SortOrder
    country?: SortOrderInput | SortOrder
    checkboard_address_id?: SortOrderInput | SortOrder
    checkboard_raw_address?: SortOrderInput | SortOrder
    is_parsed_address?: SortOrder
    openai_matching_result?: SortOrderInput | SortOrder
    openai_matching_api_details?: SortOrderInput | SortOrder
    created_at?: SortOrderInput | SortOrder
    updated_at?: SortOrderInput | SortOrder
    users?: UserOrderByRelationAggregateInput
  }

  export type UserAddressWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: UserAddressWhereInput | UserAddressWhereInput[]
    OR?: UserAddressWhereInput[]
    NOT?: UserAddressWhereInput | UserAddressWhereInput[]
    user_id?: IntFilter<"UserAddress"> | number
    type?: StringNullableFilter<"UserAddress"> | string | null
    is_linked_address?: BoolFilter<"UserAddress"> | boolean
    full_address?: StringNullableFilter<"UserAddress"> | string | null
    address_line_1?: StringNullableFilter<"UserAddress"> | string | null
    address_line_2?: StringNullableFilter<"UserAddress"> | string | null
    house_number?: StringNullableFilter<"UserAddress"> | string | null
    street?: StringNullableFilter<"UserAddress"> | string | null
    building_name?: StringNullableFilter<"UserAddress"> | string | null
    county?: StringNullableFilter<"UserAddress"> | string | null
    district?: StringNullableFilter<"UserAddress"> | string | null
    post_code?: StringNullableFilter<"UserAddress"> | string | null
    post_town?: StringNullableFilter<"UserAddress"> | string | null
    country?: StringNullableFilter<"UserAddress"> | string | null
    checkboard_address_id?: StringNullableFilter<"UserAddress"> | string | null
    checkboard_raw_address?: JsonNullableFilter<"UserAddress">
    is_parsed_address?: BoolFilter<"UserAddress"> | boolean
    openai_matching_result?: JsonNullableFilter<"UserAddress">
    openai_matching_api_details?: JsonNullableFilter<"UserAddress">
    created_at?: DateTimeNullableFilter<"UserAddress"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"UserAddress"> | Date | string | null
    users?: UserListRelationFilter
  }, "id">

  export type UserAddressOrderByWithAggregationInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrderInput | SortOrder
    is_linked_address?: SortOrder
    full_address?: SortOrderInput | SortOrder
    address_line_1?: SortOrderInput | SortOrder
    address_line_2?: SortOrderInput | SortOrder
    house_number?: SortOrderInput | SortOrder
    street?: SortOrderInput | SortOrder
    building_name?: SortOrderInput | SortOrder
    county?: SortOrderInput | SortOrder
    district?: SortOrderInput | SortOrder
    post_code?: SortOrderInput | SortOrder
    post_town?: SortOrderInput | SortOrder
    country?: SortOrderInput | SortOrder
    checkboard_address_id?: SortOrderInput | SortOrder
    checkboard_raw_address?: SortOrderInput | SortOrder
    is_parsed_address?: SortOrder
    openai_matching_result?: SortOrderInput | SortOrder
    openai_matching_api_details?: SortOrderInput | SortOrder
    created_at?: SortOrderInput | SortOrder
    updated_at?: SortOrderInput | SortOrder
    _count?: UserAddressCountOrderByAggregateInput
    _avg?: UserAddressAvgOrderByAggregateInput
    _max?: UserAddressMaxOrderByAggregateInput
    _min?: UserAddressMinOrderByAggregateInput
    _sum?: UserAddressSumOrderByAggregateInput
  }

  export type UserAddressScalarWhereWithAggregatesInput = {
    AND?: UserAddressScalarWhereWithAggregatesInput | UserAddressScalarWhereWithAggregatesInput[]
    OR?: UserAddressScalarWhereWithAggregatesInput[]
    NOT?: UserAddressScalarWhereWithAggregatesInput | UserAddressScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"UserAddress"> | string
    user_id?: IntWithAggregatesFilter<"UserAddress"> | number
    type?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    is_linked_address?: BoolWithAggregatesFilter<"UserAddress"> | boolean
    full_address?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    address_line_1?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    address_line_2?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    house_number?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    street?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    building_name?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    county?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    district?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    post_code?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    post_town?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    country?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    checkboard_address_id?: StringNullableWithAggregatesFilter<"UserAddress"> | string | null
    checkboard_raw_address?: JsonNullableWithAggregatesFilter<"UserAddress">
    is_parsed_address?: BoolWithAggregatesFilter<"UserAddress"> | boolean
    openai_matching_result?: JsonNullableWithAggregatesFilter<"UserAddress">
    openai_matching_api_details?: JsonNullableWithAggregatesFilter<"UserAddress">
    created_at?: DateTimeNullableWithAggregatesFilter<"UserAddress"> | Date | string | null
    updated_at?: DateTimeNullableWithAggregatesFilter<"UserAddress"> | Date | string | null
  }

  export type ClaimRequirementWhereInput = {
    AND?: ClaimRequirementWhereInput | ClaimRequirementWhereInput[]
    OR?: ClaimRequirementWhereInput[]
    NOT?: ClaimRequirementWhereInput | ClaimRequirementWhereInput[]
    id?: StringFilter<"ClaimRequirement"> | string
    claim_id?: BigIntFilter<"ClaimRequirement"> | bigint | number
    type?: StringNullableFilter<"ClaimRequirement"> | string | null
    status?: StringNullableFilter<"ClaimRequirement"> | string | null
    claim_requirement_reason?: StringNullableFilter<"ClaimRequirement"> | string | null
    claim_requirement_rejection_reason?: StringNullableFilter<"ClaimRequirement"> | string | null
    created_at?: DateTimeNullableFilter<"ClaimRequirement"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"ClaimRequirement"> | Date | string | null
    claim?: XOR<ClaimRelationFilter, ClaimWhereInput>
  }

  export type ClaimRequirementOrderByWithRelationInput = {
    id?: SortOrder
    claim_id?: SortOrder
    type?: SortOrderInput | SortOrder
    status?: SortOrderInput | SortOrder
    claim_requirement_reason?: SortOrderInput | SortOrder
    claim_requirement_rejection_reason?: SortOrderInput | SortOrder
    created_at?: SortOrderInput | SortOrder
    updated_at?: SortOrderInput | SortOrder
    claim?: ClaimOrderByWithRelationInput
  }

  export type ClaimRequirementWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ClaimRequirementWhereInput | ClaimRequirementWhereInput[]
    OR?: ClaimRequirementWhereInput[]
    NOT?: ClaimRequirementWhereInput | ClaimRequirementWhereInput[]
    claim_id?: BigIntFilter<"ClaimRequirement"> | bigint | number
    type?: StringNullableFilter<"ClaimRequirement"> | string | null
    status?: StringNullableFilter<"ClaimRequirement"> | string | null
    claim_requirement_reason?: StringNullableFilter<"ClaimRequirement"> | string | null
    claim_requirement_rejection_reason?: StringNullableFilter<"ClaimRequirement"> | string | null
    created_at?: DateTimeNullableFilter<"ClaimRequirement"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"ClaimRequirement"> | Date | string | null
    claim?: XOR<ClaimRelationFilter, ClaimWhereInput>
  }, "id">

  export type ClaimRequirementOrderByWithAggregationInput = {
    id?: SortOrder
    claim_id?: SortOrder
    type?: SortOrderInput | SortOrder
    status?: SortOrderInput | SortOrder
    claim_requirement_reason?: SortOrderInput | SortOrder
    claim_requirement_rejection_reason?: SortOrderInput | SortOrder
    created_at?: SortOrderInput | SortOrder
    updated_at?: SortOrderInput | SortOrder
    _count?: ClaimRequirementCountOrderByAggregateInput
    _avg?: ClaimRequirementAvgOrderByAggregateInput
    _max?: ClaimRequirementMaxOrderByAggregateInput
    _min?: ClaimRequirementMinOrderByAggregateInput
    _sum?: ClaimRequirementSumOrderByAggregateInput
  }

  export type ClaimRequirementScalarWhereWithAggregatesInput = {
    AND?: ClaimRequirementScalarWhereWithAggregatesInput | ClaimRequirementScalarWhereWithAggregatesInput[]
    OR?: ClaimRequirementScalarWhereWithAggregatesInput[]
    NOT?: ClaimRequirementScalarWhereWithAggregatesInput | ClaimRequirementScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ClaimRequirement"> | string
    claim_id?: BigIntWithAggregatesFilter<"ClaimRequirement"> | bigint | number
    type?: StringNullableWithAggregatesFilter<"ClaimRequirement"> | string | null
    status?: StringNullableWithAggregatesFilter<"ClaimRequirement"> | string | null
    claim_requirement_reason?: StringNullableWithAggregatesFilter<"ClaimRequirement"> | string | null
    claim_requirement_rejection_reason?: StringNullableWithAggregatesFilter<"ClaimRequirement"> | string | null
    created_at?: DateTimeNullableWithAggregatesFilter<"ClaimRequirement"> | Date | string | null
    updated_at?: DateTimeNullableWithAggregatesFilter<"ClaimRequirement"> | Date | string | null
  }

  export type ClaimVehiclePackageWhereInput = {
    AND?: ClaimVehiclePackageWhereInput | ClaimVehiclePackageWhereInput[]
    OR?: ClaimVehiclePackageWhereInput[]
    NOT?: ClaimVehiclePackageWhereInput | ClaimVehiclePackageWhereInput[]
    id?: StringFilter<"ClaimVehiclePackage"> | string
    claim_id?: BigIntFilter<"ClaimVehiclePackage"> | bigint | number
    vehicle_registration?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    vehicle_make?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    vehicle_model?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    dealership_name?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    monthly_payment?: DecimalNullableFilter<"ClaimVehiclePackage"> | Decimal | DecimalJsLike | number | string | null
    contract_start_date?: DateTimeNullableFilter<"ClaimVehiclePackage"> | Date | string | null
    status?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    created_at?: DateTimeNullableFilter<"ClaimVehiclePackage"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"ClaimVehiclePackage"> | Date | string | null
    claim?: XOR<ClaimRelationFilter, ClaimWhereInput>
  }

  export type ClaimVehiclePackageOrderByWithRelationInput = {
    id?: SortOrder
    claim_id?: SortOrder
    vehicle_registration?: SortOrderInput | SortOrder
    vehicle_make?: SortOrderInput | SortOrder
    vehicle_model?: SortOrderInput | SortOrder
    dealership_name?: SortOrderInput | SortOrder
    monthly_payment?: SortOrderInput | SortOrder
    contract_start_date?: SortOrderInput | SortOrder
    status?: SortOrderInput | SortOrder
    created_at?: SortOrderInput | SortOrder
    updated_at?: SortOrderInput | SortOrder
    claim?: ClaimOrderByWithRelationInput
  }

  export type ClaimVehiclePackageWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ClaimVehiclePackageWhereInput | ClaimVehiclePackageWhereInput[]
    OR?: ClaimVehiclePackageWhereInput[]
    NOT?: ClaimVehiclePackageWhereInput | ClaimVehiclePackageWhereInput[]
    claim_id?: BigIntFilter<"ClaimVehiclePackage"> | bigint | number
    vehicle_registration?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    vehicle_make?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    vehicle_model?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    dealership_name?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    monthly_payment?: DecimalNullableFilter<"ClaimVehiclePackage"> | Decimal | DecimalJsLike | number | string | null
    contract_start_date?: DateTimeNullableFilter<"ClaimVehiclePackage"> | Date | string | null
    status?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    created_at?: DateTimeNullableFilter<"ClaimVehiclePackage"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"ClaimVehiclePackage"> | Date | string | null
    claim?: XOR<ClaimRelationFilter, ClaimWhereInput>
  }, "id">

  export type ClaimVehiclePackageOrderByWithAggregationInput = {
    id?: SortOrder
    claim_id?: SortOrder
    vehicle_registration?: SortOrderInput | SortOrder
    vehicle_make?: SortOrderInput | SortOrder
    vehicle_model?: SortOrderInput | SortOrder
    dealership_name?: SortOrderInput | SortOrder
    monthly_payment?: SortOrderInput | SortOrder
    contract_start_date?: SortOrderInput | SortOrder
    status?: SortOrderInput | SortOrder
    created_at?: SortOrderInput | SortOrder
    updated_at?: SortOrderInput | SortOrder
    _count?: ClaimVehiclePackageCountOrderByAggregateInput
    _avg?: ClaimVehiclePackageAvgOrderByAggregateInput
    _max?: ClaimVehiclePackageMaxOrderByAggregateInput
    _min?: ClaimVehiclePackageMinOrderByAggregateInput
    _sum?: ClaimVehiclePackageSumOrderByAggregateInput
  }

  export type ClaimVehiclePackageScalarWhereWithAggregatesInput = {
    AND?: ClaimVehiclePackageScalarWhereWithAggregatesInput | ClaimVehiclePackageScalarWhereWithAggregatesInput[]
    OR?: ClaimVehiclePackageScalarWhereWithAggregatesInput[]
    NOT?: ClaimVehiclePackageScalarWhereWithAggregatesInput | ClaimVehiclePackageScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ClaimVehiclePackage"> | string
    claim_id?: BigIntWithAggregatesFilter<"ClaimVehiclePackage"> | bigint | number
    vehicle_registration?: StringNullableWithAggregatesFilter<"ClaimVehiclePackage"> | string | null
    vehicle_make?: StringNullableWithAggregatesFilter<"ClaimVehiclePackage"> | string | null
    vehicle_model?: StringNullableWithAggregatesFilter<"ClaimVehiclePackage"> | string | null
    dealership_name?: StringNullableWithAggregatesFilter<"ClaimVehiclePackage"> | string | null
    monthly_payment?: DecimalNullableWithAggregatesFilter<"ClaimVehiclePackage"> | Decimal | DecimalJsLike | number | string | null
    contract_start_date?: DateTimeNullableWithAggregatesFilter<"ClaimVehiclePackage"> | Date | string | null
    status?: StringNullableWithAggregatesFilter<"ClaimVehiclePackage"> | string | null
    created_at?: DateTimeNullableWithAggregatesFilter<"ClaimVehiclePackage"> | Date | string | null
    updated_at?: DateTimeNullableWithAggregatesFilter<"ClaimVehiclePackage"> | Date | string | null
  }

  export type UserLogWhereInput = {
    AND?: UserLogWhereInput | UserLogWhereInput[]
    OR?: UserLogWhereInput[]
    NOT?: UserLogWhereInput | UserLogWhereInput[]
    id?: StringFilter<"UserLog"> | string
    user_id?: BigIntFilter<"UserLog"> | bigint | number
    type?: StringFilter<"UserLog"> | string
    detail?: StringFilter<"UserLog"> | string
    ip_address?: StringNullableFilter<"UserLog"> | string | null
    created_at?: DateTimeNullableFilter<"UserLog"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"UserLog"> | Date | string | null
    user?: XOR<UserRelationFilter, UserWhereInput>
  }

  export type UserLogOrderByWithRelationInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    detail?: SortOrder
    ip_address?: SortOrderInput | SortOrder
    created_at?: SortOrderInput | SortOrder
    updated_at?: SortOrderInput | SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type UserLogWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: UserLogWhereInput | UserLogWhereInput[]
    OR?: UserLogWhereInput[]
    NOT?: UserLogWhereInput | UserLogWhereInput[]
    user_id?: BigIntFilter<"UserLog"> | bigint | number
    type?: StringFilter<"UserLog"> | string
    detail?: StringFilter<"UserLog"> | string
    ip_address?: StringNullableFilter<"UserLog"> | string | null
    created_at?: DateTimeNullableFilter<"UserLog"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"UserLog"> | Date | string | null
    user?: XOR<UserRelationFilter, UserWhereInput>
  }, "id">

  export type UserLogOrderByWithAggregationInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    detail?: SortOrder
    ip_address?: SortOrderInput | SortOrder
    created_at?: SortOrderInput | SortOrder
    updated_at?: SortOrderInput | SortOrder
    _count?: UserLogCountOrderByAggregateInput
    _avg?: UserLogAvgOrderByAggregateInput
    _max?: UserLogMaxOrderByAggregateInput
    _min?: UserLogMinOrderByAggregateInput
    _sum?: UserLogSumOrderByAggregateInput
  }

  export type UserLogScalarWhereWithAggregatesInput = {
    AND?: UserLogScalarWhereWithAggregatesInput | UserLogScalarWhereWithAggregatesInput[]
    OR?: UserLogScalarWhereWithAggregatesInput[]
    NOT?: UserLogScalarWhereWithAggregatesInput | UserLogScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"UserLog"> | string
    user_id?: BigIntWithAggregatesFilter<"UserLog"> | bigint | number
    type?: StringWithAggregatesFilter<"UserLog"> | string
    detail?: StringWithAggregatesFilter<"UserLog"> | string
    ip_address?: StringNullableWithAggregatesFilter<"UserLog"> | string | null
    created_at?: DateTimeNullableWithAggregatesFilter<"UserLog"> | Date | string | null
    updated_at?: DateTimeNullableWithAggregatesFilter<"UserLog"> | Date | string | null
  }

  export type UserCreateInput = {
    id: bigint | number
    email_address?: string | null
    password?: string | null
    is_enabled: boolean
    status?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_number?: string | null
    date_of_birth?: Date | string | null
    previous_name?: string | null
    current_user_id_document_id?: string | null
    current_signature_file_id?: string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: string | null
    introducer?: string
    solicitor?: string | null
    credit_response_selection_completed: boolean
    justcall_id?: number | null
    voluum_click_id?: string | null
    pipedrive_id?: string | null
    google_drive_link?: string | null
    last_login?: Date | string | null
    remember_token?: string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
    claims?: ClaimCreateNestedManyWithoutUserInput
    address?: UserAddressCreateNestedOneWithoutUsersInput
    user_logs?: UserLogCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id: bigint | number
    email_address?: string | null
    password?: string | null
    is_enabled: boolean
    status?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_number?: string | null
    date_of_birth?: Date | string | null
    previous_name?: string | null
    current_user_address_id?: string | null
    current_user_id_document_id?: string | null
    current_signature_file_id?: string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: string | null
    introducer?: string
    solicitor?: string | null
    credit_response_selection_completed: boolean
    justcall_id?: number | null
    voluum_click_id?: string | null
    pipedrive_id?: string | null
    google_drive_link?: string | null
    last_login?: Date | string | null
    remember_token?: string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
    claims?: ClaimUncheckedCreateNestedManyWithoutUserInput
    user_logs?: UserLogUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    email_address?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    is_enabled?: BoolFieldUpdateOperationsInput | boolean
    status?: NullableStringFieldUpdateOperationsInput | string | null
    first_name?: NullableStringFieldUpdateOperationsInput | string | null
    last_name?: NullableStringFieldUpdateOperationsInput | string | null
    phone_number?: NullableStringFieldUpdateOperationsInput | string | null
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    previous_name?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_id_document_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_signature_file_id?: NullableStringFieldUpdateOperationsInput | string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: NullableStringFieldUpdateOperationsInput | string | null
    introducer?: StringFieldUpdateOperationsInput | string
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    credit_response_selection_completed?: BoolFieldUpdateOperationsInput | boolean
    justcall_id?: NullableIntFieldUpdateOperationsInput | number | null
    voluum_click_id?: NullableStringFieldUpdateOperationsInput | string | null
    pipedrive_id?: NullableStringFieldUpdateOperationsInput | string | null
    google_drive_link?: NullableStringFieldUpdateOperationsInput | string | null
    last_login?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    remember_token?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    claims?: ClaimUpdateManyWithoutUserNestedInput
    address?: UserAddressUpdateOneWithoutUsersNestedInput
    user_logs?: UserLogUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    email_address?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    is_enabled?: BoolFieldUpdateOperationsInput | boolean
    status?: NullableStringFieldUpdateOperationsInput | string | null
    first_name?: NullableStringFieldUpdateOperationsInput | string | null
    last_name?: NullableStringFieldUpdateOperationsInput | string | null
    phone_number?: NullableStringFieldUpdateOperationsInput | string | null
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    previous_name?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_address_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_id_document_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_signature_file_id?: NullableStringFieldUpdateOperationsInput | string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: NullableStringFieldUpdateOperationsInput | string | null
    introducer?: StringFieldUpdateOperationsInput | string
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    credit_response_selection_completed?: BoolFieldUpdateOperationsInput | boolean
    justcall_id?: NullableIntFieldUpdateOperationsInput | number | null
    voluum_click_id?: NullableStringFieldUpdateOperationsInput | string | null
    pipedrive_id?: NullableStringFieldUpdateOperationsInput | string | null
    google_drive_link?: NullableStringFieldUpdateOperationsInput | string | null
    last_login?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    remember_token?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    claims?: ClaimUncheckedUpdateManyWithoutUserNestedInput
    user_logs?: UserLogUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id: bigint | number
    email_address?: string | null
    password?: string | null
    is_enabled: boolean
    status?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_number?: string | null
    date_of_birth?: Date | string | null
    previous_name?: string | null
    current_user_address_id?: string | null
    current_user_id_document_id?: string | null
    current_signature_file_id?: string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: string | null
    introducer?: string
    solicitor?: string | null
    credit_response_selection_completed: boolean
    justcall_id?: number | null
    voluum_click_id?: string | null
    pipedrive_id?: string | null
    google_drive_link?: string | null
    last_login?: Date | string | null
    remember_token?: string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type UserUpdateManyMutationInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    email_address?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    is_enabled?: BoolFieldUpdateOperationsInput | boolean
    status?: NullableStringFieldUpdateOperationsInput | string | null
    first_name?: NullableStringFieldUpdateOperationsInput | string | null
    last_name?: NullableStringFieldUpdateOperationsInput | string | null
    phone_number?: NullableStringFieldUpdateOperationsInput | string | null
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    previous_name?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_id_document_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_signature_file_id?: NullableStringFieldUpdateOperationsInput | string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: NullableStringFieldUpdateOperationsInput | string | null
    introducer?: StringFieldUpdateOperationsInput | string
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    credit_response_selection_completed?: BoolFieldUpdateOperationsInput | boolean
    justcall_id?: NullableIntFieldUpdateOperationsInput | number | null
    voluum_click_id?: NullableStringFieldUpdateOperationsInput | string | null
    pipedrive_id?: NullableStringFieldUpdateOperationsInput | string | null
    google_drive_link?: NullableStringFieldUpdateOperationsInput | string | null
    last_login?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    remember_token?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserUncheckedUpdateManyInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    email_address?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    is_enabled?: BoolFieldUpdateOperationsInput | boolean
    status?: NullableStringFieldUpdateOperationsInput | string | null
    first_name?: NullableStringFieldUpdateOperationsInput | string | null
    last_name?: NullableStringFieldUpdateOperationsInput | string | null
    phone_number?: NullableStringFieldUpdateOperationsInput | string | null
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    previous_name?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_address_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_id_document_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_signature_file_id?: NullableStringFieldUpdateOperationsInput | string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: NullableStringFieldUpdateOperationsInput | string | null
    introducer?: StringFieldUpdateOperationsInput | string
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    credit_response_selection_completed?: BoolFieldUpdateOperationsInput | boolean
    justcall_id?: NullableIntFieldUpdateOperationsInput | number | null
    voluum_click_id?: NullableStringFieldUpdateOperationsInput | string | null
    pipedrive_id?: NullableStringFieldUpdateOperationsInput | string | null
    google_drive_link?: NullableStringFieldUpdateOperationsInput | string | null
    last_login?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    remember_token?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimCreateInput = {
    id: bigint | number
    type?: string | null
    status?: string | null
    lender?: string | null
    solicitor?: string | null
    client_last_updated_at?: Date | string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
    user: UserCreateNestedOneWithoutClaimsInput
    requirements?: ClaimRequirementCreateNestedManyWithoutClaimInput
    vehiclePackages?: ClaimVehiclePackageCreateNestedManyWithoutClaimInput
  }

  export type ClaimUncheckedCreateInput = {
    id: bigint | number
    user_id: bigint | number
    type?: string | null
    status?: string | null
    lender?: string | null
    solicitor?: string | null
    client_last_updated_at?: Date | string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
    requirements?: ClaimRequirementUncheckedCreateNestedManyWithoutClaimInput
    vehiclePackages?: ClaimVehiclePackageUncheckedCreateNestedManyWithoutClaimInput
  }

  export type ClaimUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    lender?: NullableStringFieldUpdateOperationsInput | string | null
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    client_last_updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    user?: UserUpdateOneRequiredWithoutClaimsNestedInput
    requirements?: ClaimRequirementUpdateManyWithoutClaimNestedInput
    vehiclePackages?: ClaimVehiclePackageUpdateManyWithoutClaimNestedInput
  }

  export type ClaimUncheckedUpdateInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    user_id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    lender?: NullableStringFieldUpdateOperationsInput | string | null
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    client_last_updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    requirements?: ClaimRequirementUncheckedUpdateManyWithoutClaimNestedInput
    vehiclePackages?: ClaimVehiclePackageUncheckedUpdateManyWithoutClaimNestedInput
  }

  export type ClaimCreateManyInput = {
    id: bigint | number
    user_id: bigint | number
    type?: string | null
    status?: string | null
    lender?: string | null
    solicitor?: string | null
    client_last_updated_at?: Date | string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type ClaimUpdateManyMutationInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    lender?: NullableStringFieldUpdateOperationsInput | string | null
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    client_last_updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimUncheckedUpdateManyInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    user_id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    lender?: NullableStringFieldUpdateOperationsInput | string | null
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    client_last_updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserAddressCreateInput = {
    id: string
    user_id: number
    type?: string | null
    is_linked_address?: boolean
    full_address?: string | null
    address_line_1?: string | null
    address_line_2?: string | null
    house_number?: string | null
    street?: string | null
    building_name?: string | null
    county?: string | null
    district?: string | null
    post_code?: string | null
    post_town?: string | null
    country?: string | null
    checkboard_address_id?: string | null
    checkboard_raw_address?: NullableJsonNullValueInput | InputJsonValue
    is_parsed_address?: boolean
    openai_matching_result?: NullableJsonNullValueInput | InputJsonValue
    openai_matching_api_details?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
    users?: UserCreateNestedManyWithoutAddressInput
  }

  export type UserAddressUncheckedCreateInput = {
    id: string
    user_id: number
    type?: string | null
    is_linked_address?: boolean
    full_address?: string | null
    address_line_1?: string | null
    address_line_2?: string | null
    house_number?: string | null
    street?: string | null
    building_name?: string | null
    county?: string | null
    district?: string | null
    post_code?: string | null
    post_town?: string | null
    country?: string | null
    checkboard_address_id?: string | null
    checkboard_raw_address?: NullableJsonNullValueInput | InputJsonValue
    is_parsed_address?: boolean
    openai_matching_result?: NullableJsonNullValueInput | InputJsonValue
    openai_matching_api_details?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
    users?: UserUncheckedCreateNestedManyWithoutAddressInput
  }

  export type UserAddressUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: IntFieldUpdateOperationsInput | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    is_linked_address?: BoolFieldUpdateOperationsInput | boolean
    full_address?: NullableStringFieldUpdateOperationsInput | string | null
    address_line_1?: NullableStringFieldUpdateOperationsInput | string | null
    address_line_2?: NullableStringFieldUpdateOperationsInput | string | null
    house_number?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    building_name?: NullableStringFieldUpdateOperationsInput | string | null
    county?: NullableStringFieldUpdateOperationsInput | string | null
    district?: NullableStringFieldUpdateOperationsInput | string | null
    post_code?: NullableStringFieldUpdateOperationsInput | string | null
    post_town?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_id?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_raw_address?: NullableJsonNullValueInput | InputJsonValue
    is_parsed_address?: BoolFieldUpdateOperationsInput | boolean
    openai_matching_result?: NullableJsonNullValueInput | InputJsonValue
    openai_matching_api_details?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    users?: UserUpdateManyWithoutAddressNestedInput
  }

  export type UserAddressUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: IntFieldUpdateOperationsInput | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    is_linked_address?: BoolFieldUpdateOperationsInput | boolean
    full_address?: NullableStringFieldUpdateOperationsInput | string | null
    address_line_1?: NullableStringFieldUpdateOperationsInput | string | null
    address_line_2?: NullableStringFieldUpdateOperationsInput | string | null
    house_number?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    building_name?: NullableStringFieldUpdateOperationsInput | string | null
    county?: NullableStringFieldUpdateOperationsInput | string | null
    district?: NullableStringFieldUpdateOperationsInput | string | null
    post_code?: NullableStringFieldUpdateOperationsInput | string | null
    post_town?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_id?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_raw_address?: NullableJsonNullValueInput | InputJsonValue
    is_parsed_address?: BoolFieldUpdateOperationsInput | boolean
    openai_matching_result?: NullableJsonNullValueInput | InputJsonValue
    openai_matching_api_details?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    users?: UserUncheckedUpdateManyWithoutAddressNestedInput
  }

  export type UserAddressCreateManyInput = {
    id: string
    user_id: number
    type?: string | null
    is_linked_address?: boolean
    full_address?: string | null
    address_line_1?: string | null
    address_line_2?: string | null
    house_number?: string | null
    street?: string | null
    building_name?: string | null
    county?: string | null
    district?: string | null
    post_code?: string | null
    post_town?: string | null
    country?: string | null
    checkboard_address_id?: string | null
    checkboard_raw_address?: NullableJsonNullValueInput | InputJsonValue
    is_parsed_address?: boolean
    openai_matching_result?: NullableJsonNullValueInput | InputJsonValue
    openai_matching_api_details?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type UserAddressUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: IntFieldUpdateOperationsInput | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    is_linked_address?: BoolFieldUpdateOperationsInput | boolean
    full_address?: NullableStringFieldUpdateOperationsInput | string | null
    address_line_1?: NullableStringFieldUpdateOperationsInput | string | null
    address_line_2?: NullableStringFieldUpdateOperationsInput | string | null
    house_number?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    building_name?: NullableStringFieldUpdateOperationsInput | string | null
    county?: NullableStringFieldUpdateOperationsInput | string | null
    district?: NullableStringFieldUpdateOperationsInput | string | null
    post_code?: NullableStringFieldUpdateOperationsInput | string | null
    post_town?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_id?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_raw_address?: NullableJsonNullValueInput | InputJsonValue
    is_parsed_address?: BoolFieldUpdateOperationsInput | boolean
    openai_matching_result?: NullableJsonNullValueInput | InputJsonValue
    openai_matching_api_details?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserAddressUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: IntFieldUpdateOperationsInput | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    is_linked_address?: BoolFieldUpdateOperationsInput | boolean
    full_address?: NullableStringFieldUpdateOperationsInput | string | null
    address_line_1?: NullableStringFieldUpdateOperationsInput | string | null
    address_line_2?: NullableStringFieldUpdateOperationsInput | string | null
    house_number?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    building_name?: NullableStringFieldUpdateOperationsInput | string | null
    county?: NullableStringFieldUpdateOperationsInput | string | null
    district?: NullableStringFieldUpdateOperationsInput | string | null
    post_code?: NullableStringFieldUpdateOperationsInput | string | null
    post_town?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_id?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_raw_address?: NullableJsonNullValueInput | InputJsonValue
    is_parsed_address?: BoolFieldUpdateOperationsInput | boolean
    openai_matching_result?: NullableJsonNullValueInput | InputJsonValue
    openai_matching_api_details?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimRequirementCreateInput = {
    id: string
    type?: string | null
    status?: string | null
    claim_requirement_reason?: string | null
    claim_requirement_rejection_reason?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
    claim: ClaimCreateNestedOneWithoutRequirementsInput
  }

  export type ClaimRequirementUncheckedCreateInput = {
    id: string
    claim_id: bigint | number
    type?: string | null
    status?: string | null
    claim_requirement_reason?: string | null
    claim_requirement_rejection_reason?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type ClaimRequirementUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_reason?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_rejection_reason?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    claim?: ClaimUpdateOneRequiredWithoutRequirementsNestedInput
  }

  export type ClaimRequirementUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    claim_id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_reason?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_rejection_reason?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimRequirementCreateManyInput = {
    id: string
    claim_id: bigint | number
    type?: string | null
    status?: string | null
    claim_requirement_reason?: string | null
    claim_requirement_rejection_reason?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type ClaimRequirementUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_reason?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_rejection_reason?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimRequirementUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    claim_id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_reason?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_rejection_reason?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimVehiclePackageCreateInput = {
    id: string
    vehicle_registration?: string | null
    vehicle_make?: string | null
    vehicle_model?: string | null
    dealership_name?: string | null
    monthly_payment?: Decimal | DecimalJsLike | number | string | null
    contract_start_date?: Date | string | null
    status?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
    claim: ClaimCreateNestedOneWithoutVehiclePackagesInput
  }

  export type ClaimVehiclePackageUncheckedCreateInput = {
    id: string
    claim_id: bigint | number
    vehicle_registration?: string | null
    vehicle_make?: string | null
    vehicle_model?: string | null
    dealership_name?: string | null
    monthly_payment?: Decimal | DecimalJsLike | number | string | null
    contract_start_date?: Date | string | null
    status?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type ClaimVehiclePackageUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    vehicle_registration?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_make?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_model?: NullableStringFieldUpdateOperationsInput | string | null
    dealership_name?: NullableStringFieldUpdateOperationsInput | string | null
    monthly_payment?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    contract_start_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    claim?: ClaimUpdateOneRequiredWithoutVehiclePackagesNestedInput
  }

  export type ClaimVehiclePackageUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    claim_id?: BigIntFieldUpdateOperationsInput | bigint | number
    vehicle_registration?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_make?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_model?: NullableStringFieldUpdateOperationsInput | string | null
    dealership_name?: NullableStringFieldUpdateOperationsInput | string | null
    monthly_payment?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    contract_start_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimVehiclePackageCreateManyInput = {
    id: string
    claim_id: bigint | number
    vehicle_registration?: string | null
    vehicle_make?: string | null
    vehicle_model?: string | null
    dealership_name?: string | null
    monthly_payment?: Decimal | DecimalJsLike | number | string | null
    contract_start_date?: Date | string | null
    status?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type ClaimVehiclePackageUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    vehicle_registration?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_make?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_model?: NullableStringFieldUpdateOperationsInput | string | null
    dealership_name?: NullableStringFieldUpdateOperationsInput | string | null
    monthly_payment?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    contract_start_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimVehiclePackageUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    claim_id?: BigIntFieldUpdateOperationsInput | bigint | number
    vehicle_registration?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_make?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_model?: NullableStringFieldUpdateOperationsInput | string | null
    dealership_name?: NullableStringFieldUpdateOperationsInput | string | null
    monthly_payment?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    contract_start_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserLogCreateInput = {
    id: string
    type: string
    detail: string
    ip_address?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
    user: UserCreateNestedOneWithoutUser_logsInput
  }

  export type UserLogUncheckedCreateInput = {
    id: string
    user_id: bigint | number
    type: string
    detail: string
    ip_address?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type UserLogUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    detail?: StringFieldUpdateOperationsInput | string
    ip_address?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    user?: UserUpdateOneRequiredWithoutUser_logsNestedInput
  }

  export type UserLogUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: StringFieldUpdateOperationsInput | string
    detail?: StringFieldUpdateOperationsInput | string
    ip_address?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserLogCreateManyInput = {
    id: string
    user_id: bigint | number
    type: string
    detail: string
    ip_address?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type UserLogUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    detail?: StringFieldUpdateOperationsInput | string
    ip_address?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserLogUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: StringFieldUpdateOperationsInput | string
    detail?: StringFieldUpdateOperationsInput | string
    ip_address?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type BigIntFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[]
    notIn?: bigint[] | number[]
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntFilter<$PrismaModel> | bigint | number
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }
  export type JsonNullableFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue
    lte?: InputJsonValue
    gt?: InputJsonValue
    gte?: InputJsonValue
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type ClaimListRelationFilter = {
    every?: ClaimWhereInput
    some?: ClaimWhereInput
    none?: ClaimWhereInput
  }

  export type UserAddressNullableRelationFilter = {
    is?: UserAddressWhereInput | null
    isNot?: UserAddressWhereInput | null
  }

  export type UserLogListRelationFilter = {
    every?: UserLogWhereInput
    some?: UserLogWhereInput
    none?: UserLogWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type ClaimOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserLogOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email_address?: SortOrder
    password?: SortOrder
    is_enabled?: SortOrder
    status?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    phone_number?: SortOrder
    date_of_birth?: SortOrder
    previous_name?: SortOrder
    current_user_address_id?: SortOrder
    current_user_id_document_id?: SortOrder
    current_signature_file_id?: SortOrder
    notification_channels?: SortOrder
    third_party_claim_partner?: SortOrder
    introducer?: SortOrder
    solicitor?: SortOrder
    credit_response_selection_completed?: SortOrder
    justcall_id?: SortOrder
    voluum_click_id?: SortOrder
    pipedrive_id?: SortOrder
    google_drive_link?: SortOrder
    last_login?: SortOrder
    remember_token?: SortOrder
    checkboard_address_links_api_request?: SortOrder
    checkboard_address_links_api_response?: SortOrder
    checkboard_user_invite_api_request?: SortOrder
    checkboard_user_batch_api_request?: SortOrder
    checkboard_user_verify_otp_api_request?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type UserAvgOrderByAggregateInput = {
    id?: SortOrder
    justcall_id?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email_address?: SortOrder
    password?: SortOrder
    is_enabled?: SortOrder
    status?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    phone_number?: SortOrder
    date_of_birth?: SortOrder
    previous_name?: SortOrder
    current_user_address_id?: SortOrder
    current_user_id_document_id?: SortOrder
    current_signature_file_id?: SortOrder
    third_party_claim_partner?: SortOrder
    introducer?: SortOrder
    solicitor?: SortOrder
    credit_response_selection_completed?: SortOrder
    justcall_id?: SortOrder
    voluum_click_id?: SortOrder
    pipedrive_id?: SortOrder
    google_drive_link?: SortOrder
    last_login?: SortOrder
    remember_token?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email_address?: SortOrder
    password?: SortOrder
    is_enabled?: SortOrder
    status?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    phone_number?: SortOrder
    date_of_birth?: SortOrder
    previous_name?: SortOrder
    current_user_address_id?: SortOrder
    current_user_id_document_id?: SortOrder
    current_signature_file_id?: SortOrder
    third_party_claim_partner?: SortOrder
    introducer?: SortOrder
    solicitor?: SortOrder
    credit_response_selection_completed?: SortOrder
    justcall_id?: SortOrder
    voluum_click_id?: SortOrder
    pipedrive_id?: SortOrder
    google_drive_link?: SortOrder
    last_login?: SortOrder
    remember_token?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type UserSumOrderByAggregateInput = {
    id?: SortOrder
    justcall_id?: SortOrder
  }

  export type BigIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[]
    notIn?: bigint[] | number[]
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedBigIntFilter<$PrismaModel>
    _min?: NestedBigIntFilter<$PrismaModel>
    _max?: NestedBigIntFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue
    lte?: InputJsonValue
    gt?: InputJsonValue
    gte?: InputJsonValue
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type UserRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type ClaimRequirementListRelationFilter = {
    every?: ClaimRequirementWhereInput
    some?: ClaimRequirementWhereInput
    none?: ClaimRequirementWhereInput
  }

  export type ClaimVehiclePackageListRelationFilter = {
    every?: ClaimVehiclePackageWhereInput
    some?: ClaimVehiclePackageWhereInput
    none?: ClaimVehiclePackageWhereInput
  }

  export type ClaimRequirementOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ClaimVehiclePackageOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ClaimCountOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    status?: SortOrder
    lender?: SortOrder
    solicitor?: SortOrder
    client_last_updated_at?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type ClaimAvgOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
  }

  export type ClaimMaxOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    status?: SortOrder
    lender?: SortOrder
    solicitor?: SortOrder
    client_last_updated_at?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type ClaimMinOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    status?: SortOrder
    lender?: SortOrder
    solicitor?: SortOrder
    client_last_updated_at?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type ClaimSumOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type UserListRelationFilter = {
    every?: UserWhereInput
    some?: UserWhereInput
    none?: UserWhereInput
  }

  export type UserOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserAddressCountOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    is_linked_address?: SortOrder
    full_address?: SortOrder
    address_line_1?: SortOrder
    address_line_2?: SortOrder
    house_number?: SortOrder
    street?: SortOrder
    building_name?: SortOrder
    county?: SortOrder
    district?: SortOrder
    post_code?: SortOrder
    post_town?: SortOrder
    country?: SortOrder
    checkboard_address_id?: SortOrder
    checkboard_raw_address?: SortOrder
    is_parsed_address?: SortOrder
    openai_matching_result?: SortOrder
    openai_matching_api_details?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type UserAddressAvgOrderByAggregateInput = {
    user_id?: SortOrder
  }

  export type UserAddressMaxOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    is_linked_address?: SortOrder
    full_address?: SortOrder
    address_line_1?: SortOrder
    address_line_2?: SortOrder
    house_number?: SortOrder
    street?: SortOrder
    building_name?: SortOrder
    county?: SortOrder
    district?: SortOrder
    post_code?: SortOrder
    post_town?: SortOrder
    country?: SortOrder
    checkboard_address_id?: SortOrder
    is_parsed_address?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type UserAddressMinOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    is_linked_address?: SortOrder
    full_address?: SortOrder
    address_line_1?: SortOrder
    address_line_2?: SortOrder
    house_number?: SortOrder
    street?: SortOrder
    building_name?: SortOrder
    county?: SortOrder
    district?: SortOrder
    post_code?: SortOrder
    post_town?: SortOrder
    country?: SortOrder
    checkboard_address_id?: SortOrder
    is_parsed_address?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type UserAddressSumOrderByAggregateInput = {
    user_id?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type ClaimRelationFilter = {
    is?: ClaimWhereInput
    isNot?: ClaimWhereInput
  }

  export type ClaimRequirementCountOrderByAggregateInput = {
    id?: SortOrder
    claim_id?: SortOrder
    type?: SortOrder
    status?: SortOrder
    claim_requirement_reason?: SortOrder
    claim_requirement_rejection_reason?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type ClaimRequirementAvgOrderByAggregateInput = {
    claim_id?: SortOrder
  }

  export type ClaimRequirementMaxOrderByAggregateInput = {
    id?: SortOrder
    claim_id?: SortOrder
    type?: SortOrder
    status?: SortOrder
    claim_requirement_reason?: SortOrder
    claim_requirement_rejection_reason?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type ClaimRequirementMinOrderByAggregateInput = {
    id?: SortOrder
    claim_id?: SortOrder
    type?: SortOrder
    status?: SortOrder
    claim_requirement_reason?: SortOrder
    claim_requirement_rejection_reason?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type ClaimRequirementSumOrderByAggregateInput = {
    claim_id?: SortOrder
  }

  export type DecimalNullableFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
  }

  export type ClaimVehiclePackageCountOrderByAggregateInput = {
    id?: SortOrder
    claim_id?: SortOrder
    vehicle_registration?: SortOrder
    vehicle_make?: SortOrder
    vehicle_model?: SortOrder
    dealership_name?: SortOrder
    monthly_payment?: SortOrder
    contract_start_date?: SortOrder
    status?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type ClaimVehiclePackageAvgOrderByAggregateInput = {
    claim_id?: SortOrder
    monthly_payment?: SortOrder
  }

  export type ClaimVehiclePackageMaxOrderByAggregateInput = {
    id?: SortOrder
    claim_id?: SortOrder
    vehicle_registration?: SortOrder
    vehicle_make?: SortOrder
    vehicle_model?: SortOrder
    dealership_name?: SortOrder
    monthly_payment?: SortOrder
    contract_start_date?: SortOrder
    status?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type ClaimVehiclePackageMinOrderByAggregateInput = {
    id?: SortOrder
    claim_id?: SortOrder
    vehicle_registration?: SortOrder
    vehicle_make?: SortOrder
    vehicle_model?: SortOrder
    dealership_name?: SortOrder
    monthly_payment?: SortOrder
    contract_start_date?: SortOrder
    status?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type ClaimVehiclePackageSumOrderByAggregateInput = {
    claim_id?: SortOrder
    monthly_payment?: SortOrder
  }

  export type DecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedDecimalNullableFilter<$PrismaModel>
    _sum?: NestedDecimalNullableFilter<$PrismaModel>
    _min?: NestedDecimalNullableFilter<$PrismaModel>
    _max?: NestedDecimalNullableFilter<$PrismaModel>
  }

  export type UserLogCountOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    detail?: SortOrder
    ip_address?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type UserLogAvgOrderByAggregateInput = {
    user_id?: SortOrder
  }

  export type UserLogMaxOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    detail?: SortOrder
    ip_address?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type UserLogMinOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    detail?: SortOrder
    ip_address?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type UserLogSumOrderByAggregateInput = {
    user_id?: SortOrder
  }

  export type ClaimCreateNestedManyWithoutUserInput = {
    create?: XOR<ClaimCreateWithoutUserInput, ClaimUncheckedCreateWithoutUserInput> | ClaimCreateWithoutUserInput[] | ClaimUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ClaimCreateOrConnectWithoutUserInput | ClaimCreateOrConnectWithoutUserInput[]
    createMany?: ClaimCreateManyUserInputEnvelope
    connect?: ClaimWhereUniqueInput | ClaimWhereUniqueInput[]
  }

  export type UserAddressCreateNestedOneWithoutUsersInput = {
    create?: XOR<UserAddressCreateWithoutUsersInput, UserAddressUncheckedCreateWithoutUsersInput>
    connectOrCreate?: UserAddressCreateOrConnectWithoutUsersInput
    connect?: UserAddressWhereUniqueInput
  }

  export type UserLogCreateNestedManyWithoutUserInput = {
    create?: XOR<UserLogCreateWithoutUserInput, UserLogUncheckedCreateWithoutUserInput> | UserLogCreateWithoutUserInput[] | UserLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserLogCreateOrConnectWithoutUserInput | UserLogCreateOrConnectWithoutUserInput[]
    createMany?: UserLogCreateManyUserInputEnvelope
    connect?: UserLogWhereUniqueInput | UserLogWhereUniqueInput[]
  }

  export type ClaimUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<ClaimCreateWithoutUserInput, ClaimUncheckedCreateWithoutUserInput> | ClaimCreateWithoutUserInput[] | ClaimUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ClaimCreateOrConnectWithoutUserInput | ClaimCreateOrConnectWithoutUserInput[]
    createMany?: ClaimCreateManyUserInputEnvelope
    connect?: ClaimWhereUniqueInput | ClaimWhereUniqueInput[]
  }

  export type UserLogUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<UserLogCreateWithoutUserInput, UserLogUncheckedCreateWithoutUserInput> | UserLogCreateWithoutUserInput[] | UserLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserLogCreateOrConnectWithoutUserInput | UserLogCreateOrConnectWithoutUserInput[]
    createMany?: UserLogCreateManyUserInputEnvelope
    connect?: UserLogWhereUniqueInput | UserLogWhereUniqueInput[]
  }

  export type BigIntFieldUpdateOperationsInput = {
    set?: bigint | number
    increment?: bigint | number
    decrement?: bigint | number
    multiply?: bigint | number
    divide?: bigint | number
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type ClaimUpdateManyWithoutUserNestedInput = {
    create?: XOR<ClaimCreateWithoutUserInput, ClaimUncheckedCreateWithoutUserInput> | ClaimCreateWithoutUserInput[] | ClaimUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ClaimCreateOrConnectWithoutUserInput | ClaimCreateOrConnectWithoutUserInput[]
    upsert?: ClaimUpsertWithWhereUniqueWithoutUserInput | ClaimUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ClaimCreateManyUserInputEnvelope
    set?: ClaimWhereUniqueInput | ClaimWhereUniqueInput[]
    disconnect?: ClaimWhereUniqueInput | ClaimWhereUniqueInput[]
    delete?: ClaimWhereUniqueInput | ClaimWhereUniqueInput[]
    connect?: ClaimWhereUniqueInput | ClaimWhereUniqueInput[]
    update?: ClaimUpdateWithWhereUniqueWithoutUserInput | ClaimUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ClaimUpdateManyWithWhereWithoutUserInput | ClaimUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ClaimScalarWhereInput | ClaimScalarWhereInput[]
  }

  export type UserAddressUpdateOneWithoutUsersNestedInput = {
    create?: XOR<UserAddressCreateWithoutUsersInput, UserAddressUncheckedCreateWithoutUsersInput>
    connectOrCreate?: UserAddressCreateOrConnectWithoutUsersInput
    upsert?: UserAddressUpsertWithoutUsersInput
    disconnect?: UserAddressWhereInput | boolean
    delete?: UserAddressWhereInput | boolean
    connect?: UserAddressWhereUniqueInput
    update?: XOR<XOR<UserAddressUpdateToOneWithWhereWithoutUsersInput, UserAddressUpdateWithoutUsersInput>, UserAddressUncheckedUpdateWithoutUsersInput>
  }

  export type UserLogUpdateManyWithoutUserNestedInput = {
    create?: XOR<UserLogCreateWithoutUserInput, UserLogUncheckedCreateWithoutUserInput> | UserLogCreateWithoutUserInput[] | UserLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserLogCreateOrConnectWithoutUserInput | UserLogCreateOrConnectWithoutUserInput[]
    upsert?: UserLogUpsertWithWhereUniqueWithoutUserInput | UserLogUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: UserLogCreateManyUserInputEnvelope
    set?: UserLogWhereUniqueInput | UserLogWhereUniqueInput[]
    disconnect?: UserLogWhereUniqueInput | UserLogWhereUniqueInput[]
    delete?: UserLogWhereUniqueInput | UserLogWhereUniqueInput[]
    connect?: UserLogWhereUniqueInput | UserLogWhereUniqueInput[]
    update?: UserLogUpdateWithWhereUniqueWithoutUserInput | UserLogUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: UserLogUpdateManyWithWhereWithoutUserInput | UserLogUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: UserLogScalarWhereInput | UserLogScalarWhereInput[]
  }

  export type ClaimUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<ClaimCreateWithoutUserInput, ClaimUncheckedCreateWithoutUserInput> | ClaimCreateWithoutUserInput[] | ClaimUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ClaimCreateOrConnectWithoutUserInput | ClaimCreateOrConnectWithoutUserInput[]
    upsert?: ClaimUpsertWithWhereUniqueWithoutUserInput | ClaimUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ClaimCreateManyUserInputEnvelope
    set?: ClaimWhereUniqueInput | ClaimWhereUniqueInput[]
    disconnect?: ClaimWhereUniqueInput | ClaimWhereUniqueInput[]
    delete?: ClaimWhereUniqueInput | ClaimWhereUniqueInput[]
    connect?: ClaimWhereUniqueInput | ClaimWhereUniqueInput[]
    update?: ClaimUpdateWithWhereUniqueWithoutUserInput | ClaimUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ClaimUpdateManyWithWhereWithoutUserInput | ClaimUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ClaimScalarWhereInput | ClaimScalarWhereInput[]
  }

  export type UserLogUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<UserLogCreateWithoutUserInput, UserLogUncheckedCreateWithoutUserInput> | UserLogCreateWithoutUserInput[] | UserLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserLogCreateOrConnectWithoutUserInput | UserLogCreateOrConnectWithoutUserInput[]
    upsert?: UserLogUpsertWithWhereUniqueWithoutUserInput | UserLogUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: UserLogCreateManyUserInputEnvelope
    set?: UserLogWhereUniqueInput | UserLogWhereUniqueInput[]
    disconnect?: UserLogWhereUniqueInput | UserLogWhereUniqueInput[]
    delete?: UserLogWhereUniqueInput | UserLogWhereUniqueInput[]
    connect?: UserLogWhereUniqueInput | UserLogWhereUniqueInput[]
    update?: UserLogUpdateWithWhereUniqueWithoutUserInput | UserLogUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: UserLogUpdateManyWithWhereWithoutUserInput | UserLogUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: UserLogScalarWhereInput | UserLogScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutClaimsInput = {
    create?: XOR<UserCreateWithoutClaimsInput, UserUncheckedCreateWithoutClaimsInput>
    connectOrCreate?: UserCreateOrConnectWithoutClaimsInput
    connect?: UserWhereUniqueInput
  }

  export type ClaimRequirementCreateNestedManyWithoutClaimInput = {
    create?: XOR<ClaimRequirementCreateWithoutClaimInput, ClaimRequirementUncheckedCreateWithoutClaimInput> | ClaimRequirementCreateWithoutClaimInput[] | ClaimRequirementUncheckedCreateWithoutClaimInput[]
    connectOrCreate?: ClaimRequirementCreateOrConnectWithoutClaimInput | ClaimRequirementCreateOrConnectWithoutClaimInput[]
    createMany?: ClaimRequirementCreateManyClaimInputEnvelope
    connect?: ClaimRequirementWhereUniqueInput | ClaimRequirementWhereUniqueInput[]
  }

  export type ClaimVehiclePackageCreateNestedManyWithoutClaimInput = {
    create?: XOR<ClaimVehiclePackageCreateWithoutClaimInput, ClaimVehiclePackageUncheckedCreateWithoutClaimInput> | ClaimVehiclePackageCreateWithoutClaimInput[] | ClaimVehiclePackageUncheckedCreateWithoutClaimInput[]
    connectOrCreate?: ClaimVehiclePackageCreateOrConnectWithoutClaimInput | ClaimVehiclePackageCreateOrConnectWithoutClaimInput[]
    createMany?: ClaimVehiclePackageCreateManyClaimInputEnvelope
    connect?: ClaimVehiclePackageWhereUniqueInput | ClaimVehiclePackageWhereUniqueInput[]
  }

  export type ClaimRequirementUncheckedCreateNestedManyWithoutClaimInput = {
    create?: XOR<ClaimRequirementCreateWithoutClaimInput, ClaimRequirementUncheckedCreateWithoutClaimInput> | ClaimRequirementCreateWithoutClaimInput[] | ClaimRequirementUncheckedCreateWithoutClaimInput[]
    connectOrCreate?: ClaimRequirementCreateOrConnectWithoutClaimInput | ClaimRequirementCreateOrConnectWithoutClaimInput[]
    createMany?: ClaimRequirementCreateManyClaimInputEnvelope
    connect?: ClaimRequirementWhereUniqueInput | ClaimRequirementWhereUniqueInput[]
  }

  export type ClaimVehiclePackageUncheckedCreateNestedManyWithoutClaimInput = {
    create?: XOR<ClaimVehiclePackageCreateWithoutClaimInput, ClaimVehiclePackageUncheckedCreateWithoutClaimInput> | ClaimVehiclePackageCreateWithoutClaimInput[] | ClaimVehiclePackageUncheckedCreateWithoutClaimInput[]
    connectOrCreate?: ClaimVehiclePackageCreateOrConnectWithoutClaimInput | ClaimVehiclePackageCreateOrConnectWithoutClaimInput[]
    createMany?: ClaimVehiclePackageCreateManyClaimInputEnvelope
    connect?: ClaimVehiclePackageWhereUniqueInput | ClaimVehiclePackageWhereUniqueInput[]
  }

  export type UserUpdateOneRequiredWithoutClaimsNestedInput = {
    create?: XOR<UserCreateWithoutClaimsInput, UserUncheckedCreateWithoutClaimsInput>
    connectOrCreate?: UserCreateOrConnectWithoutClaimsInput
    upsert?: UserUpsertWithoutClaimsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutClaimsInput, UserUpdateWithoutClaimsInput>, UserUncheckedUpdateWithoutClaimsInput>
  }

  export type ClaimRequirementUpdateManyWithoutClaimNestedInput = {
    create?: XOR<ClaimRequirementCreateWithoutClaimInput, ClaimRequirementUncheckedCreateWithoutClaimInput> | ClaimRequirementCreateWithoutClaimInput[] | ClaimRequirementUncheckedCreateWithoutClaimInput[]
    connectOrCreate?: ClaimRequirementCreateOrConnectWithoutClaimInput | ClaimRequirementCreateOrConnectWithoutClaimInput[]
    upsert?: ClaimRequirementUpsertWithWhereUniqueWithoutClaimInput | ClaimRequirementUpsertWithWhereUniqueWithoutClaimInput[]
    createMany?: ClaimRequirementCreateManyClaimInputEnvelope
    set?: ClaimRequirementWhereUniqueInput | ClaimRequirementWhereUniqueInput[]
    disconnect?: ClaimRequirementWhereUniqueInput | ClaimRequirementWhereUniqueInput[]
    delete?: ClaimRequirementWhereUniqueInput | ClaimRequirementWhereUniqueInput[]
    connect?: ClaimRequirementWhereUniqueInput | ClaimRequirementWhereUniqueInput[]
    update?: ClaimRequirementUpdateWithWhereUniqueWithoutClaimInput | ClaimRequirementUpdateWithWhereUniqueWithoutClaimInput[]
    updateMany?: ClaimRequirementUpdateManyWithWhereWithoutClaimInput | ClaimRequirementUpdateManyWithWhereWithoutClaimInput[]
    deleteMany?: ClaimRequirementScalarWhereInput | ClaimRequirementScalarWhereInput[]
  }

  export type ClaimVehiclePackageUpdateManyWithoutClaimNestedInput = {
    create?: XOR<ClaimVehiclePackageCreateWithoutClaimInput, ClaimVehiclePackageUncheckedCreateWithoutClaimInput> | ClaimVehiclePackageCreateWithoutClaimInput[] | ClaimVehiclePackageUncheckedCreateWithoutClaimInput[]
    connectOrCreate?: ClaimVehiclePackageCreateOrConnectWithoutClaimInput | ClaimVehiclePackageCreateOrConnectWithoutClaimInput[]
    upsert?: ClaimVehiclePackageUpsertWithWhereUniqueWithoutClaimInput | ClaimVehiclePackageUpsertWithWhereUniqueWithoutClaimInput[]
    createMany?: ClaimVehiclePackageCreateManyClaimInputEnvelope
    set?: ClaimVehiclePackageWhereUniqueInput | ClaimVehiclePackageWhereUniqueInput[]
    disconnect?: ClaimVehiclePackageWhereUniqueInput | ClaimVehiclePackageWhereUniqueInput[]
    delete?: ClaimVehiclePackageWhereUniqueInput | ClaimVehiclePackageWhereUniqueInput[]
    connect?: ClaimVehiclePackageWhereUniqueInput | ClaimVehiclePackageWhereUniqueInput[]
    update?: ClaimVehiclePackageUpdateWithWhereUniqueWithoutClaimInput | ClaimVehiclePackageUpdateWithWhereUniqueWithoutClaimInput[]
    updateMany?: ClaimVehiclePackageUpdateManyWithWhereWithoutClaimInput | ClaimVehiclePackageUpdateManyWithWhereWithoutClaimInput[]
    deleteMany?: ClaimVehiclePackageScalarWhereInput | ClaimVehiclePackageScalarWhereInput[]
  }

  export type ClaimRequirementUncheckedUpdateManyWithoutClaimNestedInput = {
    create?: XOR<ClaimRequirementCreateWithoutClaimInput, ClaimRequirementUncheckedCreateWithoutClaimInput> | ClaimRequirementCreateWithoutClaimInput[] | ClaimRequirementUncheckedCreateWithoutClaimInput[]
    connectOrCreate?: ClaimRequirementCreateOrConnectWithoutClaimInput | ClaimRequirementCreateOrConnectWithoutClaimInput[]
    upsert?: ClaimRequirementUpsertWithWhereUniqueWithoutClaimInput | ClaimRequirementUpsertWithWhereUniqueWithoutClaimInput[]
    createMany?: ClaimRequirementCreateManyClaimInputEnvelope
    set?: ClaimRequirementWhereUniqueInput | ClaimRequirementWhereUniqueInput[]
    disconnect?: ClaimRequirementWhereUniqueInput | ClaimRequirementWhereUniqueInput[]
    delete?: ClaimRequirementWhereUniqueInput | ClaimRequirementWhereUniqueInput[]
    connect?: ClaimRequirementWhereUniqueInput | ClaimRequirementWhereUniqueInput[]
    update?: ClaimRequirementUpdateWithWhereUniqueWithoutClaimInput | ClaimRequirementUpdateWithWhereUniqueWithoutClaimInput[]
    updateMany?: ClaimRequirementUpdateManyWithWhereWithoutClaimInput | ClaimRequirementUpdateManyWithWhereWithoutClaimInput[]
    deleteMany?: ClaimRequirementScalarWhereInput | ClaimRequirementScalarWhereInput[]
  }

  export type ClaimVehiclePackageUncheckedUpdateManyWithoutClaimNestedInput = {
    create?: XOR<ClaimVehiclePackageCreateWithoutClaimInput, ClaimVehiclePackageUncheckedCreateWithoutClaimInput> | ClaimVehiclePackageCreateWithoutClaimInput[] | ClaimVehiclePackageUncheckedCreateWithoutClaimInput[]
    connectOrCreate?: ClaimVehiclePackageCreateOrConnectWithoutClaimInput | ClaimVehiclePackageCreateOrConnectWithoutClaimInput[]
    upsert?: ClaimVehiclePackageUpsertWithWhereUniqueWithoutClaimInput | ClaimVehiclePackageUpsertWithWhereUniqueWithoutClaimInput[]
    createMany?: ClaimVehiclePackageCreateManyClaimInputEnvelope
    set?: ClaimVehiclePackageWhereUniqueInput | ClaimVehiclePackageWhereUniqueInput[]
    disconnect?: ClaimVehiclePackageWhereUniqueInput | ClaimVehiclePackageWhereUniqueInput[]
    delete?: ClaimVehiclePackageWhereUniqueInput | ClaimVehiclePackageWhereUniqueInput[]
    connect?: ClaimVehiclePackageWhereUniqueInput | ClaimVehiclePackageWhereUniqueInput[]
    update?: ClaimVehiclePackageUpdateWithWhereUniqueWithoutClaimInput | ClaimVehiclePackageUpdateWithWhereUniqueWithoutClaimInput[]
    updateMany?: ClaimVehiclePackageUpdateManyWithWhereWithoutClaimInput | ClaimVehiclePackageUpdateManyWithWhereWithoutClaimInput[]
    deleteMany?: ClaimVehiclePackageScalarWhereInput | ClaimVehiclePackageScalarWhereInput[]
  }

  export type UserCreateNestedManyWithoutAddressInput = {
    create?: XOR<UserCreateWithoutAddressInput, UserUncheckedCreateWithoutAddressInput> | UserCreateWithoutAddressInput[] | UserUncheckedCreateWithoutAddressInput[]
    connectOrCreate?: UserCreateOrConnectWithoutAddressInput | UserCreateOrConnectWithoutAddressInput[]
    createMany?: UserCreateManyAddressInputEnvelope
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type UserUncheckedCreateNestedManyWithoutAddressInput = {
    create?: XOR<UserCreateWithoutAddressInput, UserUncheckedCreateWithoutAddressInput> | UserCreateWithoutAddressInput[] | UserUncheckedCreateWithoutAddressInput[]
    connectOrCreate?: UserCreateOrConnectWithoutAddressInput | UserCreateOrConnectWithoutAddressInput[]
    createMany?: UserCreateManyAddressInputEnvelope
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type UserUpdateManyWithoutAddressNestedInput = {
    create?: XOR<UserCreateWithoutAddressInput, UserUncheckedCreateWithoutAddressInput> | UserCreateWithoutAddressInput[] | UserUncheckedCreateWithoutAddressInput[]
    connectOrCreate?: UserCreateOrConnectWithoutAddressInput | UserCreateOrConnectWithoutAddressInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutAddressInput | UserUpsertWithWhereUniqueWithoutAddressInput[]
    createMany?: UserCreateManyAddressInputEnvelope
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutAddressInput | UserUpdateWithWhereUniqueWithoutAddressInput[]
    updateMany?: UserUpdateManyWithWhereWithoutAddressInput | UserUpdateManyWithWhereWithoutAddressInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type UserUncheckedUpdateManyWithoutAddressNestedInput = {
    create?: XOR<UserCreateWithoutAddressInput, UserUncheckedCreateWithoutAddressInput> | UserCreateWithoutAddressInput[] | UserUncheckedCreateWithoutAddressInput[]
    connectOrCreate?: UserCreateOrConnectWithoutAddressInput | UserCreateOrConnectWithoutAddressInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutAddressInput | UserUpsertWithWhereUniqueWithoutAddressInput[]
    createMany?: UserCreateManyAddressInputEnvelope
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutAddressInput | UserUpdateWithWhereUniqueWithoutAddressInput[]
    updateMany?: UserUpdateManyWithWhereWithoutAddressInput | UserUpdateManyWithWhereWithoutAddressInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type ClaimCreateNestedOneWithoutRequirementsInput = {
    create?: XOR<ClaimCreateWithoutRequirementsInput, ClaimUncheckedCreateWithoutRequirementsInput>
    connectOrCreate?: ClaimCreateOrConnectWithoutRequirementsInput
    connect?: ClaimWhereUniqueInput
  }

  export type ClaimUpdateOneRequiredWithoutRequirementsNestedInput = {
    create?: XOR<ClaimCreateWithoutRequirementsInput, ClaimUncheckedCreateWithoutRequirementsInput>
    connectOrCreate?: ClaimCreateOrConnectWithoutRequirementsInput
    upsert?: ClaimUpsertWithoutRequirementsInput
    connect?: ClaimWhereUniqueInput
    update?: XOR<XOR<ClaimUpdateToOneWithWhereWithoutRequirementsInput, ClaimUpdateWithoutRequirementsInput>, ClaimUncheckedUpdateWithoutRequirementsInput>
  }

  export type ClaimCreateNestedOneWithoutVehiclePackagesInput = {
    create?: XOR<ClaimCreateWithoutVehiclePackagesInput, ClaimUncheckedCreateWithoutVehiclePackagesInput>
    connectOrCreate?: ClaimCreateOrConnectWithoutVehiclePackagesInput
    connect?: ClaimWhereUniqueInput
  }

  export type NullableDecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string | null
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type ClaimUpdateOneRequiredWithoutVehiclePackagesNestedInput = {
    create?: XOR<ClaimCreateWithoutVehiclePackagesInput, ClaimUncheckedCreateWithoutVehiclePackagesInput>
    connectOrCreate?: ClaimCreateOrConnectWithoutVehiclePackagesInput
    upsert?: ClaimUpsertWithoutVehiclePackagesInput
    connect?: ClaimWhereUniqueInput
    update?: XOR<XOR<ClaimUpdateToOneWithWhereWithoutVehiclePackagesInput, ClaimUpdateWithoutVehiclePackagesInput>, ClaimUncheckedUpdateWithoutVehiclePackagesInput>
  }

  export type UserCreateNestedOneWithoutUser_logsInput = {
    create?: XOR<UserCreateWithoutUser_logsInput, UserUncheckedCreateWithoutUser_logsInput>
    connectOrCreate?: UserCreateOrConnectWithoutUser_logsInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutUser_logsNestedInput = {
    create?: XOR<UserCreateWithoutUser_logsInput, UserUncheckedCreateWithoutUser_logsInput>
    connectOrCreate?: UserCreateOrConnectWithoutUser_logsInput
    upsert?: UserUpsertWithoutUser_logsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutUser_logsInput, UserUpdateWithoutUser_logsInput>, UserUncheckedUpdateWithoutUser_logsInput>
  }

  export type NestedBigIntFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[]
    notIn?: bigint[] | number[]
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntFilter<$PrismaModel> | bigint | number
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedBigIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[]
    notIn?: bigint[] | number[]
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedBigIntFilter<$PrismaModel>
    _min?: NestedBigIntFilter<$PrismaModel>
    _max?: NestedBigIntFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue
    lte?: InputJsonValue
    gt?: InputJsonValue
    gte?: InputJsonValue
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedDecimalNullableFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
  }

  export type NestedDecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedDecimalNullableFilter<$PrismaModel>
    _sum?: NestedDecimalNullableFilter<$PrismaModel>
    _min?: NestedDecimalNullableFilter<$PrismaModel>
    _max?: NestedDecimalNullableFilter<$PrismaModel>
  }

  export type ClaimCreateWithoutUserInput = {
    id: bigint | number
    type?: string | null
    status?: string | null
    lender?: string | null
    solicitor?: string | null
    client_last_updated_at?: Date | string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
    requirements?: ClaimRequirementCreateNestedManyWithoutClaimInput
    vehiclePackages?: ClaimVehiclePackageCreateNestedManyWithoutClaimInput
  }

  export type ClaimUncheckedCreateWithoutUserInput = {
    id: bigint | number
    type?: string | null
    status?: string | null
    lender?: string | null
    solicitor?: string | null
    client_last_updated_at?: Date | string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
    requirements?: ClaimRequirementUncheckedCreateNestedManyWithoutClaimInput
    vehiclePackages?: ClaimVehiclePackageUncheckedCreateNestedManyWithoutClaimInput
  }

  export type ClaimCreateOrConnectWithoutUserInput = {
    where: ClaimWhereUniqueInput
    create: XOR<ClaimCreateWithoutUserInput, ClaimUncheckedCreateWithoutUserInput>
  }

  export type ClaimCreateManyUserInputEnvelope = {
    data: ClaimCreateManyUserInput | ClaimCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type UserAddressCreateWithoutUsersInput = {
    id: string
    user_id: number
    type?: string | null
    is_linked_address?: boolean
    full_address?: string | null
    address_line_1?: string | null
    address_line_2?: string | null
    house_number?: string | null
    street?: string | null
    building_name?: string | null
    county?: string | null
    district?: string | null
    post_code?: string | null
    post_town?: string | null
    country?: string | null
    checkboard_address_id?: string | null
    checkboard_raw_address?: NullableJsonNullValueInput | InputJsonValue
    is_parsed_address?: boolean
    openai_matching_result?: NullableJsonNullValueInput | InputJsonValue
    openai_matching_api_details?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type UserAddressUncheckedCreateWithoutUsersInput = {
    id: string
    user_id: number
    type?: string | null
    is_linked_address?: boolean
    full_address?: string | null
    address_line_1?: string | null
    address_line_2?: string | null
    house_number?: string | null
    street?: string | null
    building_name?: string | null
    county?: string | null
    district?: string | null
    post_code?: string | null
    post_town?: string | null
    country?: string | null
    checkboard_address_id?: string | null
    checkboard_raw_address?: NullableJsonNullValueInput | InputJsonValue
    is_parsed_address?: boolean
    openai_matching_result?: NullableJsonNullValueInput | InputJsonValue
    openai_matching_api_details?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type UserAddressCreateOrConnectWithoutUsersInput = {
    where: UserAddressWhereUniqueInput
    create: XOR<UserAddressCreateWithoutUsersInput, UserAddressUncheckedCreateWithoutUsersInput>
  }

  export type UserLogCreateWithoutUserInput = {
    id: string
    type: string
    detail: string
    ip_address?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type UserLogUncheckedCreateWithoutUserInput = {
    id: string
    type: string
    detail: string
    ip_address?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type UserLogCreateOrConnectWithoutUserInput = {
    where: UserLogWhereUniqueInput
    create: XOR<UserLogCreateWithoutUserInput, UserLogUncheckedCreateWithoutUserInput>
  }

  export type UserLogCreateManyUserInputEnvelope = {
    data: UserLogCreateManyUserInput | UserLogCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type ClaimUpsertWithWhereUniqueWithoutUserInput = {
    where: ClaimWhereUniqueInput
    update: XOR<ClaimUpdateWithoutUserInput, ClaimUncheckedUpdateWithoutUserInput>
    create: XOR<ClaimCreateWithoutUserInput, ClaimUncheckedCreateWithoutUserInput>
  }

  export type ClaimUpdateWithWhereUniqueWithoutUserInput = {
    where: ClaimWhereUniqueInput
    data: XOR<ClaimUpdateWithoutUserInput, ClaimUncheckedUpdateWithoutUserInput>
  }

  export type ClaimUpdateManyWithWhereWithoutUserInput = {
    where: ClaimScalarWhereInput
    data: XOR<ClaimUpdateManyMutationInput, ClaimUncheckedUpdateManyWithoutUserInput>
  }

  export type ClaimScalarWhereInput = {
    AND?: ClaimScalarWhereInput | ClaimScalarWhereInput[]
    OR?: ClaimScalarWhereInput[]
    NOT?: ClaimScalarWhereInput | ClaimScalarWhereInput[]
    id?: BigIntFilter<"Claim"> | bigint | number
    user_id?: BigIntFilter<"Claim"> | bigint | number
    type?: StringNullableFilter<"Claim"> | string | null
    status?: StringNullableFilter<"Claim"> | string | null
    lender?: StringNullableFilter<"Claim"> | string | null
    solicitor?: StringNullableFilter<"Claim"> | string | null
    client_last_updated_at?: DateTimeNullableFilter<"Claim"> | Date | string | null
    created_at?: DateTimeNullableFilter<"Claim"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"Claim"> | Date | string | null
  }

  export type UserAddressUpsertWithoutUsersInput = {
    update: XOR<UserAddressUpdateWithoutUsersInput, UserAddressUncheckedUpdateWithoutUsersInput>
    create: XOR<UserAddressCreateWithoutUsersInput, UserAddressUncheckedCreateWithoutUsersInput>
    where?: UserAddressWhereInput
  }

  export type UserAddressUpdateToOneWithWhereWithoutUsersInput = {
    where?: UserAddressWhereInput
    data: XOR<UserAddressUpdateWithoutUsersInput, UserAddressUncheckedUpdateWithoutUsersInput>
  }

  export type UserAddressUpdateWithoutUsersInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: IntFieldUpdateOperationsInput | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    is_linked_address?: BoolFieldUpdateOperationsInput | boolean
    full_address?: NullableStringFieldUpdateOperationsInput | string | null
    address_line_1?: NullableStringFieldUpdateOperationsInput | string | null
    address_line_2?: NullableStringFieldUpdateOperationsInput | string | null
    house_number?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    building_name?: NullableStringFieldUpdateOperationsInput | string | null
    county?: NullableStringFieldUpdateOperationsInput | string | null
    district?: NullableStringFieldUpdateOperationsInput | string | null
    post_code?: NullableStringFieldUpdateOperationsInput | string | null
    post_town?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_id?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_raw_address?: NullableJsonNullValueInput | InputJsonValue
    is_parsed_address?: BoolFieldUpdateOperationsInput | boolean
    openai_matching_result?: NullableJsonNullValueInput | InputJsonValue
    openai_matching_api_details?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserAddressUncheckedUpdateWithoutUsersInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: IntFieldUpdateOperationsInput | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    is_linked_address?: BoolFieldUpdateOperationsInput | boolean
    full_address?: NullableStringFieldUpdateOperationsInput | string | null
    address_line_1?: NullableStringFieldUpdateOperationsInput | string | null
    address_line_2?: NullableStringFieldUpdateOperationsInput | string | null
    house_number?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    building_name?: NullableStringFieldUpdateOperationsInput | string | null
    county?: NullableStringFieldUpdateOperationsInput | string | null
    district?: NullableStringFieldUpdateOperationsInput | string | null
    post_code?: NullableStringFieldUpdateOperationsInput | string | null
    post_town?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_id?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_raw_address?: NullableJsonNullValueInput | InputJsonValue
    is_parsed_address?: BoolFieldUpdateOperationsInput | boolean
    openai_matching_result?: NullableJsonNullValueInput | InputJsonValue
    openai_matching_api_details?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserLogUpsertWithWhereUniqueWithoutUserInput = {
    where: UserLogWhereUniqueInput
    update: XOR<UserLogUpdateWithoutUserInput, UserLogUncheckedUpdateWithoutUserInput>
    create: XOR<UserLogCreateWithoutUserInput, UserLogUncheckedCreateWithoutUserInput>
  }

  export type UserLogUpdateWithWhereUniqueWithoutUserInput = {
    where: UserLogWhereUniqueInput
    data: XOR<UserLogUpdateWithoutUserInput, UserLogUncheckedUpdateWithoutUserInput>
  }

  export type UserLogUpdateManyWithWhereWithoutUserInput = {
    where: UserLogScalarWhereInput
    data: XOR<UserLogUpdateManyMutationInput, UserLogUncheckedUpdateManyWithoutUserInput>
  }

  export type UserLogScalarWhereInput = {
    AND?: UserLogScalarWhereInput | UserLogScalarWhereInput[]
    OR?: UserLogScalarWhereInput[]
    NOT?: UserLogScalarWhereInput | UserLogScalarWhereInput[]
    id?: StringFilter<"UserLog"> | string
    user_id?: BigIntFilter<"UserLog"> | bigint | number
    type?: StringFilter<"UserLog"> | string
    detail?: StringFilter<"UserLog"> | string
    ip_address?: StringNullableFilter<"UserLog"> | string | null
    created_at?: DateTimeNullableFilter<"UserLog"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"UserLog"> | Date | string | null
  }

  export type UserCreateWithoutClaimsInput = {
    id: bigint | number
    email_address?: string | null
    password?: string | null
    is_enabled: boolean
    status?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_number?: string | null
    date_of_birth?: Date | string | null
    previous_name?: string | null
    current_user_id_document_id?: string | null
    current_signature_file_id?: string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: string | null
    introducer?: string
    solicitor?: string | null
    credit_response_selection_completed: boolean
    justcall_id?: number | null
    voluum_click_id?: string | null
    pipedrive_id?: string | null
    google_drive_link?: string | null
    last_login?: Date | string | null
    remember_token?: string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
    address?: UserAddressCreateNestedOneWithoutUsersInput
    user_logs?: UserLogCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutClaimsInput = {
    id: bigint | number
    email_address?: string | null
    password?: string | null
    is_enabled: boolean
    status?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_number?: string | null
    date_of_birth?: Date | string | null
    previous_name?: string | null
    current_user_address_id?: string | null
    current_user_id_document_id?: string | null
    current_signature_file_id?: string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: string | null
    introducer?: string
    solicitor?: string | null
    credit_response_selection_completed: boolean
    justcall_id?: number | null
    voluum_click_id?: string | null
    pipedrive_id?: string | null
    google_drive_link?: string | null
    last_login?: Date | string | null
    remember_token?: string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
    user_logs?: UserLogUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutClaimsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutClaimsInput, UserUncheckedCreateWithoutClaimsInput>
  }

  export type ClaimRequirementCreateWithoutClaimInput = {
    id: string
    type?: string | null
    status?: string | null
    claim_requirement_reason?: string | null
    claim_requirement_rejection_reason?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type ClaimRequirementUncheckedCreateWithoutClaimInput = {
    id: string
    type?: string | null
    status?: string | null
    claim_requirement_reason?: string | null
    claim_requirement_rejection_reason?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type ClaimRequirementCreateOrConnectWithoutClaimInput = {
    where: ClaimRequirementWhereUniqueInput
    create: XOR<ClaimRequirementCreateWithoutClaimInput, ClaimRequirementUncheckedCreateWithoutClaimInput>
  }

  export type ClaimRequirementCreateManyClaimInputEnvelope = {
    data: ClaimRequirementCreateManyClaimInput | ClaimRequirementCreateManyClaimInput[]
    skipDuplicates?: boolean
  }

  export type ClaimVehiclePackageCreateWithoutClaimInput = {
    id: string
    vehicle_registration?: string | null
    vehicle_make?: string | null
    vehicle_model?: string | null
    dealership_name?: string | null
    monthly_payment?: Decimal | DecimalJsLike | number | string | null
    contract_start_date?: Date | string | null
    status?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type ClaimVehiclePackageUncheckedCreateWithoutClaimInput = {
    id: string
    vehicle_registration?: string | null
    vehicle_make?: string | null
    vehicle_model?: string | null
    dealership_name?: string | null
    monthly_payment?: Decimal | DecimalJsLike | number | string | null
    contract_start_date?: Date | string | null
    status?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type ClaimVehiclePackageCreateOrConnectWithoutClaimInput = {
    where: ClaimVehiclePackageWhereUniqueInput
    create: XOR<ClaimVehiclePackageCreateWithoutClaimInput, ClaimVehiclePackageUncheckedCreateWithoutClaimInput>
  }

  export type ClaimVehiclePackageCreateManyClaimInputEnvelope = {
    data: ClaimVehiclePackageCreateManyClaimInput | ClaimVehiclePackageCreateManyClaimInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutClaimsInput = {
    update: XOR<UserUpdateWithoutClaimsInput, UserUncheckedUpdateWithoutClaimsInput>
    create: XOR<UserCreateWithoutClaimsInput, UserUncheckedCreateWithoutClaimsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutClaimsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutClaimsInput, UserUncheckedUpdateWithoutClaimsInput>
  }

  export type UserUpdateWithoutClaimsInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    email_address?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    is_enabled?: BoolFieldUpdateOperationsInput | boolean
    status?: NullableStringFieldUpdateOperationsInput | string | null
    first_name?: NullableStringFieldUpdateOperationsInput | string | null
    last_name?: NullableStringFieldUpdateOperationsInput | string | null
    phone_number?: NullableStringFieldUpdateOperationsInput | string | null
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    previous_name?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_id_document_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_signature_file_id?: NullableStringFieldUpdateOperationsInput | string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: NullableStringFieldUpdateOperationsInput | string | null
    introducer?: StringFieldUpdateOperationsInput | string
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    credit_response_selection_completed?: BoolFieldUpdateOperationsInput | boolean
    justcall_id?: NullableIntFieldUpdateOperationsInput | number | null
    voluum_click_id?: NullableStringFieldUpdateOperationsInput | string | null
    pipedrive_id?: NullableStringFieldUpdateOperationsInput | string | null
    google_drive_link?: NullableStringFieldUpdateOperationsInput | string | null
    last_login?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    remember_token?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    address?: UserAddressUpdateOneWithoutUsersNestedInput
    user_logs?: UserLogUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutClaimsInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    email_address?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    is_enabled?: BoolFieldUpdateOperationsInput | boolean
    status?: NullableStringFieldUpdateOperationsInput | string | null
    first_name?: NullableStringFieldUpdateOperationsInput | string | null
    last_name?: NullableStringFieldUpdateOperationsInput | string | null
    phone_number?: NullableStringFieldUpdateOperationsInput | string | null
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    previous_name?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_address_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_id_document_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_signature_file_id?: NullableStringFieldUpdateOperationsInput | string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: NullableStringFieldUpdateOperationsInput | string | null
    introducer?: StringFieldUpdateOperationsInput | string
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    credit_response_selection_completed?: BoolFieldUpdateOperationsInput | boolean
    justcall_id?: NullableIntFieldUpdateOperationsInput | number | null
    voluum_click_id?: NullableStringFieldUpdateOperationsInput | string | null
    pipedrive_id?: NullableStringFieldUpdateOperationsInput | string | null
    google_drive_link?: NullableStringFieldUpdateOperationsInput | string | null
    last_login?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    remember_token?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    user_logs?: UserLogUncheckedUpdateManyWithoutUserNestedInput
  }

  export type ClaimRequirementUpsertWithWhereUniqueWithoutClaimInput = {
    where: ClaimRequirementWhereUniqueInput
    update: XOR<ClaimRequirementUpdateWithoutClaimInput, ClaimRequirementUncheckedUpdateWithoutClaimInput>
    create: XOR<ClaimRequirementCreateWithoutClaimInput, ClaimRequirementUncheckedCreateWithoutClaimInput>
  }

  export type ClaimRequirementUpdateWithWhereUniqueWithoutClaimInput = {
    where: ClaimRequirementWhereUniqueInput
    data: XOR<ClaimRequirementUpdateWithoutClaimInput, ClaimRequirementUncheckedUpdateWithoutClaimInput>
  }

  export type ClaimRequirementUpdateManyWithWhereWithoutClaimInput = {
    where: ClaimRequirementScalarWhereInput
    data: XOR<ClaimRequirementUpdateManyMutationInput, ClaimRequirementUncheckedUpdateManyWithoutClaimInput>
  }

  export type ClaimRequirementScalarWhereInput = {
    AND?: ClaimRequirementScalarWhereInput | ClaimRequirementScalarWhereInput[]
    OR?: ClaimRequirementScalarWhereInput[]
    NOT?: ClaimRequirementScalarWhereInput | ClaimRequirementScalarWhereInput[]
    id?: StringFilter<"ClaimRequirement"> | string
    claim_id?: BigIntFilter<"ClaimRequirement"> | bigint | number
    type?: StringNullableFilter<"ClaimRequirement"> | string | null
    status?: StringNullableFilter<"ClaimRequirement"> | string | null
    claim_requirement_reason?: StringNullableFilter<"ClaimRequirement"> | string | null
    claim_requirement_rejection_reason?: StringNullableFilter<"ClaimRequirement"> | string | null
    created_at?: DateTimeNullableFilter<"ClaimRequirement"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"ClaimRequirement"> | Date | string | null
  }

  export type ClaimVehiclePackageUpsertWithWhereUniqueWithoutClaimInput = {
    where: ClaimVehiclePackageWhereUniqueInput
    update: XOR<ClaimVehiclePackageUpdateWithoutClaimInput, ClaimVehiclePackageUncheckedUpdateWithoutClaimInput>
    create: XOR<ClaimVehiclePackageCreateWithoutClaimInput, ClaimVehiclePackageUncheckedCreateWithoutClaimInput>
  }

  export type ClaimVehiclePackageUpdateWithWhereUniqueWithoutClaimInput = {
    where: ClaimVehiclePackageWhereUniqueInput
    data: XOR<ClaimVehiclePackageUpdateWithoutClaimInput, ClaimVehiclePackageUncheckedUpdateWithoutClaimInput>
  }

  export type ClaimVehiclePackageUpdateManyWithWhereWithoutClaimInput = {
    where: ClaimVehiclePackageScalarWhereInput
    data: XOR<ClaimVehiclePackageUpdateManyMutationInput, ClaimVehiclePackageUncheckedUpdateManyWithoutClaimInput>
  }

  export type ClaimVehiclePackageScalarWhereInput = {
    AND?: ClaimVehiclePackageScalarWhereInput | ClaimVehiclePackageScalarWhereInput[]
    OR?: ClaimVehiclePackageScalarWhereInput[]
    NOT?: ClaimVehiclePackageScalarWhereInput | ClaimVehiclePackageScalarWhereInput[]
    id?: StringFilter<"ClaimVehiclePackage"> | string
    claim_id?: BigIntFilter<"ClaimVehiclePackage"> | bigint | number
    vehicle_registration?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    vehicle_make?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    vehicle_model?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    dealership_name?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    monthly_payment?: DecimalNullableFilter<"ClaimVehiclePackage"> | Decimal | DecimalJsLike | number | string | null
    contract_start_date?: DateTimeNullableFilter<"ClaimVehiclePackage"> | Date | string | null
    status?: StringNullableFilter<"ClaimVehiclePackage"> | string | null
    created_at?: DateTimeNullableFilter<"ClaimVehiclePackage"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"ClaimVehiclePackage"> | Date | string | null
  }

  export type UserCreateWithoutAddressInput = {
    id: bigint | number
    email_address?: string | null
    password?: string | null
    is_enabled: boolean
    status?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_number?: string | null
    date_of_birth?: Date | string | null
    previous_name?: string | null
    current_user_id_document_id?: string | null
    current_signature_file_id?: string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: string | null
    introducer?: string
    solicitor?: string | null
    credit_response_selection_completed: boolean
    justcall_id?: number | null
    voluum_click_id?: string | null
    pipedrive_id?: string | null
    google_drive_link?: string | null
    last_login?: Date | string | null
    remember_token?: string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
    claims?: ClaimCreateNestedManyWithoutUserInput
    user_logs?: UserLogCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutAddressInput = {
    id: bigint | number
    email_address?: string | null
    password?: string | null
    is_enabled: boolean
    status?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_number?: string | null
    date_of_birth?: Date | string | null
    previous_name?: string | null
    current_user_id_document_id?: string | null
    current_signature_file_id?: string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: string | null
    introducer?: string
    solicitor?: string | null
    credit_response_selection_completed: boolean
    justcall_id?: number | null
    voluum_click_id?: string | null
    pipedrive_id?: string | null
    google_drive_link?: string | null
    last_login?: Date | string | null
    remember_token?: string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
    claims?: ClaimUncheckedCreateNestedManyWithoutUserInput
    user_logs?: UserLogUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutAddressInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAddressInput, UserUncheckedCreateWithoutAddressInput>
  }

  export type UserCreateManyAddressInputEnvelope = {
    data: UserCreateManyAddressInput | UserCreateManyAddressInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithWhereUniqueWithoutAddressInput = {
    where: UserWhereUniqueInput
    update: XOR<UserUpdateWithoutAddressInput, UserUncheckedUpdateWithoutAddressInput>
    create: XOR<UserCreateWithoutAddressInput, UserUncheckedCreateWithoutAddressInput>
  }

  export type UserUpdateWithWhereUniqueWithoutAddressInput = {
    where: UserWhereUniqueInput
    data: XOR<UserUpdateWithoutAddressInput, UserUncheckedUpdateWithoutAddressInput>
  }

  export type UserUpdateManyWithWhereWithoutAddressInput = {
    where: UserScalarWhereInput
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyWithoutAddressInput>
  }

  export type UserScalarWhereInput = {
    AND?: UserScalarWhereInput | UserScalarWhereInput[]
    OR?: UserScalarWhereInput[]
    NOT?: UserScalarWhereInput | UserScalarWhereInput[]
    id?: BigIntFilter<"User"> | bigint | number
    email_address?: StringNullableFilter<"User"> | string | null
    password?: StringNullableFilter<"User"> | string | null
    is_enabled?: BoolFilter<"User"> | boolean
    status?: StringNullableFilter<"User"> | string | null
    first_name?: StringNullableFilter<"User"> | string | null
    last_name?: StringNullableFilter<"User"> | string | null
    phone_number?: StringNullableFilter<"User"> | string | null
    date_of_birth?: DateTimeNullableFilter<"User"> | Date | string | null
    previous_name?: StringNullableFilter<"User"> | string | null
    current_user_address_id?: StringNullableFilter<"User"> | string | null
    current_user_id_document_id?: StringNullableFilter<"User"> | string | null
    current_signature_file_id?: StringNullableFilter<"User"> | string | null
    notification_channels?: JsonNullableFilter<"User">
    third_party_claim_partner?: StringNullableFilter<"User"> | string | null
    introducer?: StringFilter<"User"> | string
    solicitor?: StringNullableFilter<"User"> | string | null
    credit_response_selection_completed?: BoolFilter<"User"> | boolean
    justcall_id?: IntNullableFilter<"User"> | number | null
    voluum_click_id?: StringNullableFilter<"User"> | string | null
    pipedrive_id?: StringNullableFilter<"User"> | string | null
    google_drive_link?: StringNullableFilter<"User"> | string | null
    last_login?: DateTimeNullableFilter<"User"> | Date | string | null
    remember_token?: StringNullableFilter<"User"> | string | null
    checkboard_address_links_api_request?: JsonNullableFilter<"User">
    checkboard_address_links_api_response?: JsonNullableFilter<"User">
    checkboard_user_invite_api_request?: JsonNullableFilter<"User">
    checkboard_user_batch_api_request?: JsonNullableFilter<"User">
    checkboard_user_verify_otp_api_request?: JsonNullableFilter<"User">
    created_at?: DateTimeNullableFilter<"User"> | Date | string | null
    updated_at?: DateTimeNullableFilter<"User"> | Date | string | null
  }

  export type ClaimCreateWithoutRequirementsInput = {
    id: bigint | number
    type?: string | null
    status?: string | null
    lender?: string | null
    solicitor?: string | null
    client_last_updated_at?: Date | string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
    user: UserCreateNestedOneWithoutClaimsInput
    vehiclePackages?: ClaimVehiclePackageCreateNestedManyWithoutClaimInput
  }

  export type ClaimUncheckedCreateWithoutRequirementsInput = {
    id: bigint | number
    user_id: bigint | number
    type?: string | null
    status?: string | null
    lender?: string | null
    solicitor?: string | null
    client_last_updated_at?: Date | string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
    vehiclePackages?: ClaimVehiclePackageUncheckedCreateNestedManyWithoutClaimInput
  }

  export type ClaimCreateOrConnectWithoutRequirementsInput = {
    where: ClaimWhereUniqueInput
    create: XOR<ClaimCreateWithoutRequirementsInput, ClaimUncheckedCreateWithoutRequirementsInput>
  }

  export type ClaimUpsertWithoutRequirementsInput = {
    update: XOR<ClaimUpdateWithoutRequirementsInput, ClaimUncheckedUpdateWithoutRequirementsInput>
    create: XOR<ClaimCreateWithoutRequirementsInput, ClaimUncheckedCreateWithoutRequirementsInput>
    where?: ClaimWhereInput
  }

  export type ClaimUpdateToOneWithWhereWithoutRequirementsInput = {
    where?: ClaimWhereInput
    data: XOR<ClaimUpdateWithoutRequirementsInput, ClaimUncheckedUpdateWithoutRequirementsInput>
  }

  export type ClaimUpdateWithoutRequirementsInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    lender?: NullableStringFieldUpdateOperationsInput | string | null
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    client_last_updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    user?: UserUpdateOneRequiredWithoutClaimsNestedInput
    vehiclePackages?: ClaimVehiclePackageUpdateManyWithoutClaimNestedInput
  }

  export type ClaimUncheckedUpdateWithoutRequirementsInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    user_id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    lender?: NullableStringFieldUpdateOperationsInput | string | null
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    client_last_updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    vehiclePackages?: ClaimVehiclePackageUncheckedUpdateManyWithoutClaimNestedInput
  }

  export type ClaimCreateWithoutVehiclePackagesInput = {
    id: bigint | number
    type?: string | null
    status?: string | null
    lender?: string | null
    solicitor?: string | null
    client_last_updated_at?: Date | string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
    user: UserCreateNestedOneWithoutClaimsInput
    requirements?: ClaimRequirementCreateNestedManyWithoutClaimInput
  }

  export type ClaimUncheckedCreateWithoutVehiclePackagesInput = {
    id: bigint | number
    user_id: bigint | number
    type?: string | null
    status?: string | null
    lender?: string | null
    solicitor?: string | null
    client_last_updated_at?: Date | string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
    requirements?: ClaimRequirementUncheckedCreateNestedManyWithoutClaimInput
  }

  export type ClaimCreateOrConnectWithoutVehiclePackagesInput = {
    where: ClaimWhereUniqueInput
    create: XOR<ClaimCreateWithoutVehiclePackagesInput, ClaimUncheckedCreateWithoutVehiclePackagesInput>
  }

  export type ClaimUpsertWithoutVehiclePackagesInput = {
    update: XOR<ClaimUpdateWithoutVehiclePackagesInput, ClaimUncheckedUpdateWithoutVehiclePackagesInput>
    create: XOR<ClaimCreateWithoutVehiclePackagesInput, ClaimUncheckedCreateWithoutVehiclePackagesInput>
    where?: ClaimWhereInput
  }

  export type ClaimUpdateToOneWithWhereWithoutVehiclePackagesInput = {
    where?: ClaimWhereInput
    data: XOR<ClaimUpdateWithoutVehiclePackagesInput, ClaimUncheckedUpdateWithoutVehiclePackagesInput>
  }

  export type ClaimUpdateWithoutVehiclePackagesInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    lender?: NullableStringFieldUpdateOperationsInput | string | null
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    client_last_updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    user?: UserUpdateOneRequiredWithoutClaimsNestedInput
    requirements?: ClaimRequirementUpdateManyWithoutClaimNestedInput
  }

  export type ClaimUncheckedUpdateWithoutVehiclePackagesInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    user_id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    lender?: NullableStringFieldUpdateOperationsInput | string | null
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    client_last_updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    requirements?: ClaimRequirementUncheckedUpdateManyWithoutClaimNestedInput
  }

  export type UserCreateWithoutUser_logsInput = {
    id: bigint | number
    email_address?: string | null
    password?: string | null
    is_enabled: boolean
    status?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_number?: string | null
    date_of_birth?: Date | string | null
    previous_name?: string | null
    current_user_id_document_id?: string | null
    current_signature_file_id?: string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: string | null
    introducer?: string
    solicitor?: string | null
    credit_response_selection_completed: boolean
    justcall_id?: number | null
    voluum_click_id?: string | null
    pipedrive_id?: string | null
    google_drive_link?: string | null
    last_login?: Date | string | null
    remember_token?: string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
    claims?: ClaimCreateNestedManyWithoutUserInput
    address?: UserAddressCreateNestedOneWithoutUsersInput
  }

  export type UserUncheckedCreateWithoutUser_logsInput = {
    id: bigint | number
    email_address?: string | null
    password?: string | null
    is_enabled: boolean
    status?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_number?: string | null
    date_of_birth?: Date | string | null
    previous_name?: string | null
    current_user_address_id?: string | null
    current_user_id_document_id?: string | null
    current_signature_file_id?: string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: string | null
    introducer?: string
    solicitor?: string | null
    credit_response_selection_completed: boolean
    justcall_id?: number | null
    voluum_click_id?: string | null
    pipedrive_id?: string | null
    google_drive_link?: string | null
    last_login?: Date | string | null
    remember_token?: string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
    claims?: ClaimUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutUser_logsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutUser_logsInput, UserUncheckedCreateWithoutUser_logsInput>
  }

  export type UserUpsertWithoutUser_logsInput = {
    update: XOR<UserUpdateWithoutUser_logsInput, UserUncheckedUpdateWithoutUser_logsInput>
    create: XOR<UserCreateWithoutUser_logsInput, UserUncheckedCreateWithoutUser_logsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutUser_logsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutUser_logsInput, UserUncheckedUpdateWithoutUser_logsInput>
  }

  export type UserUpdateWithoutUser_logsInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    email_address?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    is_enabled?: BoolFieldUpdateOperationsInput | boolean
    status?: NullableStringFieldUpdateOperationsInput | string | null
    first_name?: NullableStringFieldUpdateOperationsInput | string | null
    last_name?: NullableStringFieldUpdateOperationsInput | string | null
    phone_number?: NullableStringFieldUpdateOperationsInput | string | null
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    previous_name?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_id_document_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_signature_file_id?: NullableStringFieldUpdateOperationsInput | string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: NullableStringFieldUpdateOperationsInput | string | null
    introducer?: StringFieldUpdateOperationsInput | string
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    credit_response_selection_completed?: BoolFieldUpdateOperationsInput | boolean
    justcall_id?: NullableIntFieldUpdateOperationsInput | number | null
    voluum_click_id?: NullableStringFieldUpdateOperationsInput | string | null
    pipedrive_id?: NullableStringFieldUpdateOperationsInput | string | null
    google_drive_link?: NullableStringFieldUpdateOperationsInput | string | null
    last_login?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    remember_token?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    claims?: ClaimUpdateManyWithoutUserNestedInput
    address?: UserAddressUpdateOneWithoutUsersNestedInput
  }

  export type UserUncheckedUpdateWithoutUser_logsInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    email_address?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    is_enabled?: BoolFieldUpdateOperationsInput | boolean
    status?: NullableStringFieldUpdateOperationsInput | string | null
    first_name?: NullableStringFieldUpdateOperationsInput | string | null
    last_name?: NullableStringFieldUpdateOperationsInput | string | null
    phone_number?: NullableStringFieldUpdateOperationsInput | string | null
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    previous_name?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_address_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_id_document_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_signature_file_id?: NullableStringFieldUpdateOperationsInput | string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: NullableStringFieldUpdateOperationsInput | string | null
    introducer?: StringFieldUpdateOperationsInput | string
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    credit_response_selection_completed?: BoolFieldUpdateOperationsInput | boolean
    justcall_id?: NullableIntFieldUpdateOperationsInput | number | null
    voluum_click_id?: NullableStringFieldUpdateOperationsInput | string | null
    pipedrive_id?: NullableStringFieldUpdateOperationsInput | string | null
    google_drive_link?: NullableStringFieldUpdateOperationsInput | string | null
    last_login?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    remember_token?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    claims?: ClaimUncheckedUpdateManyWithoutUserNestedInput
  }

  export type ClaimCreateManyUserInput = {
    id: bigint | number
    type?: string | null
    status?: string | null
    lender?: string | null
    solicitor?: string | null
    client_last_updated_at?: Date | string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type UserLogCreateManyUserInput = {
    id: string
    type: string
    detail: string
    ip_address?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type ClaimUpdateWithoutUserInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    lender?: NullableStringFieldUpdateOperationsInput | string | null
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    client_last_updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    requirements?: ClaimRequirementUpdateManyWithoutClaimNestedInput
    vehiclePackages?: ClaimVehiclePackageUpdateManyWithoutClaimNestedInput
  }

  export type ClaimUncheckedUpdateWithoutUserInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    lender?: NullableStringFieldUpdateOperationsInput | string | null
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    client_last_updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    requirements?: ClaimRequirementUncheckedUpdateManyWithoutClaimNestedInput
    vehiclePackages?: ClaimVehiclePackageUncheckedUpdateManyWithoutClaimNestedInput
  }

  export type ClaimUncheckedUpdateManyWithoutUserInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    lender?: NullableStringFieldUpdateOperationsInput | string | null
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    client_last_updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserLogUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    detail?: StringFieldUpdateOperationsInput | string
    ip_address?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserLogUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    detail?: StringFieldUpdateOperationsInput | string
    ip_address?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserLogUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    detail?: StringFieldUpdateOperationsInput | string
    ip_address?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimRequirementCreateManyClaimInput = {
    id: string
    type?: string | null
    status?: string | null
    claim_requirement_reason?: string | null
    claim_requirement_rejection_reason?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type ClaimVehiclePackageCreateManyClaimInput = {
    id: string
    vehicle_registration?: string | null
    vehicle_make?: string | null
    vehicle_model?: string | null
    dealership_name?: string | null
    monthly_payment?: Decimal | DecimalJsLike | number | string | null
    contract_start_date?: Date | string | null
    status?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type ClaimRequirementUpdateWithoutClaimInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_reason?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_rejection_reason?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimRequirementUncheckedUpdateWithoutClaimInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_reason?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_rejection_reason?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimRequirementUncheckedUpdateManyWithoutClaimInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: NullableStringFieldUpdateOperationsInput | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_reason?: NullableStringFieldUpdateOperationsInput | string | null
    claim_requirement_rejection_reason?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimVehiclePackageUpdateWithoutClaimInput = {
    id?: StringFieldUpdateOperationsInput | string
    vehicle_registration?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_make?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_model?: NullableStringFieldUpdateOperationsInput | string | null
    dealership_name?: NullableStringFieldUpdateOperationsInput | string | null
    monthly_payment?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    contract_start_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimVehiclePackageUncheckedUpdateWithoutClaimInput = {
    id?: StringFieldUpdateOperationsInput | string
    vehicle_registration?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_make?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_model?: NullableStringFieldUpdateOperationsInput | string | null
    dealership_name?: NullableStringFieldUpdateOperationsInput | string | null
    monthly_payment?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    contract_start_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type ClaimVehiclePackageUncheckedUpdateManyWithoutClaimInput = {
    id?: StringFieldUpdateOperationsInput | string
    vehicle_registration?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_make?: NullableStringFieldUpdateOperationsInput | string | null
    vehicle_model?: NullableStringFieldUpdateOperationsInput | string | null
    dealership_name?: NullableStringFieldUpdateOperationsInput | string | null
    monthly_payment?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    contract_start_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    status?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserCreateManyAddressInput = {
    id: bigint | number
    email_address?: string | null
    password?: string | null
    is_enabled: boolean
    status?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_number?: string | null
    date_of_birth?: Date | string | null
    previous_name?: string | null
    current_user_id_document_id?: string | null
    current_signature_file_id?: string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: string | null
    introducer?: string
    solicitor?: string | null
    credit_response_selection_completed: boolean
    justcall_id?: number | null
    voluum_click_id?: string | null
    pipedrive_id?: string | null
    google_drive_link?: string | null
    last_login?: Date | string | null
    remember_token?: string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string | null
    updated_at?: Date | string | null
  }

  export type UserUpdateWithoutAddressInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    email_address?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    is_enabled?: BoolFieldUpdateOperationsInput | boolean
    status?: NullableStringFieldUpdateOperationsInput | string | null
    first_name?: NullableStringFieldUpdateOperationsInput | string | null
    last_name?: NullableStringFieldUpdateOperationsInput | string | null
    phone_number?: NullableStringFieldUpdateOperationsInput | string | null
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    previous_name?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_id_document_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_signature_file_id?: NullableStringFieldUpdateOperationsInput | string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: NullableStringFieldUpdateOperationsInput | string | null
    introducer?: StringFieldUpdateOperationsInput | string
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    credit_response_selection_completed?: BoolFieldUpdateOperationsInput | boolean
    justcall_id?: NullableIntFieldUpdateOperationsInput | number | null
    voluum_click_id?: NullableStringFieldUpdateOperationsInput | string | null
    pipedrive_id?: NullableStringFieldUpdateOperationsInput | string | null
    google_drive_link?: NullableStringFieldUpdateOperationsInput | string | null
    last_login?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    remember_token?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    claims?: ClaimUpdateManyWithoutUserNestedInput
    user_logs?: UserLogUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutAddressInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    email_address?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    is_enabled?: BoolFieldUpdateOperationsInput | boolean
    status?: NullableStringFieldUpdateOperationsInput | string | null
    first_name?: NullableStringFieldUpdateOperationsInput | string | null
    last_name?: NullableStringFieldUpdateOperationsInput | string | null
    phone_number?: NullableStringFieldUpdateOperationsInput | string | null
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    previous_name?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_id_document_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_signature_file_id?: NullableStringFieldUpdateOperationsInput | string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: NullableStringFieldUpdateOperationsInput | string | null
    introducer?: StringFieldUpdateOperationsInput | string
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    credit_response_selection_completed?: BoolFieldUpdateOperationsInput | boolean
    justcall_id?: NullableIntFieldUpdateOperationsInput | number | null
    voluum_click_id?: NullableStringFieldUpdateOperationsInput | string | null
    pipedrive_id?: NullableStringFieldUpdateOperationsInput | string | null
    google_drive_link?: NullableStringFieldUpdateOperationsInput | string | null
    last_login?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    remember_token?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    claims?: ClaimUncheckedUpdateManyWithoutUserNestedInput
    user_logs?: UserLogUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateManyWithoutAddressInput = {
    id?: BigIntFieldUpdateOperationsInput | bigint | number
    email_address?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    is_enabled?: BoolFieldUpdateOperationsInput | boolean
    status?: NullableStringFieldUpdateOperationsInput | string | null
    first_name?: NullableStringFieldUpdateOperationsInput | string | null
    last_name?: NullableStringFieldUpdateOperationsInput | string | null
    phone_number?: NullableStringFieldUpdateOperationsInput | string | null
    date_of_birth?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    previous_name?: NullableStringFieldUpdateOperationsInput | string | null
    current_user_id_document_id?: NullableStringFieldUpdateOperationsInput | string | null
    current_signature_file_id?: NullableStringFieldUpdateOperationsInput | string | null
    notification_channels?: NullableJsonNullValueInput | InputJsonValue
    third_party_claim_partner?: NullableStringFieldUpdateOperationsInput | string | null
    introducer?: StringFieldUpdateOperationsInput | string
    solicitor?: NullableStringFieldUpdateOperationsInput | string | null
    credit_response_selection_completed?: BoolFieldUpdateOperationsInput | boolean
    justcall_id?: NullableIntFieldUpdateOperationsInput | number | null
    voluum_click_id?: NullableStringFieldUpdateOperationsInput | string | null
    pipedrive_id?: NullableStringFieldUpdateOperationsInput | string | null
    google_drive_link?: NullableStringFieldUpdateOperationsInput | string | null
    last_login?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    remember_token?: NullableStringFieldUpdateOperationsInput | string | null
    checkboard_address_links_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_address_links_api_response?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_invite_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_batch_api_request?: NullableJsonNullValueInput | InputJsonValue
    checkboard_user_verify_otp_api_request?: NullableJsonNullValueInput | InputJsonValue
    created_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    updated_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use UserCountOutputTypeDefaultArgs instead
     */
    export type UserCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ClaimCountOutputTypeDefaultArgs instead
     */
    export type ClaimCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ClaimCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use UserAddressCountOutputTypeDefaultArgs instead
     */
    export type UserAddressCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserAddressCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use UserDefaultArgs instead
     */
    export type UserArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ClaimDefaultArgs instead
     */
    export type ClaimArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ClaimDefaultArgs<ExtArgs>
    /**
     * @deprecated Use UserAddressDefaultArgs instead
     */
    export type UserAddressArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserAddressDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ClaimRequirementDefaultArgs instead
     */
    export type ClaimRequirementArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ClaimRequirementDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ClaimVehiclePackageDefaultArgs instead
     */
    export type ClaimVehiclePackageArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ClaimVehiclePackageDefaultArgs<ExtArgs>
    /**
     * @deprecated Use UserLogDefaultArgs instead
     */
    export type UserLogArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserLogDefaultArgs<ExtArgs>

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}