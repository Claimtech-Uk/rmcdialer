
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
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

exports.Prisma.ClaimScalarFieldEnum = {
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

exports.Prisma.UserAddressScalarFieldEnum = {
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

exports.Prisma.ClaimRequirementScalarFieldEnum = {
  id: 'id',
  claim_id: 'claim_id',
  type: 'type',
  status: 'status',
  claim_requirement_reason: 'claim_requirement_reason',
  claim_requirement_rejection_reason: 'claim_requirement_rejection_reason',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ClaimVehiclePackageScalarFieldEnum = {
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

exports.Prisma.UserLogScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  type: 'type',
  detail: 'detail',
  ip_address: 'ip_address',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  User: 'User',
  Claim: 'Claim',
  UserAddress: 'UserAddress',
  ClaimRequirement: 'ClaimRequirement',
  ClaimVehiclePackage: 'ClaimVehiclePackage',
  UserLog: 'UserLog'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
