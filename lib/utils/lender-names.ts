/**
 * Lender Name Mapping Utility
 * 
 * Converts database lender names (e.g., "northridge_finance") 
 * to user-friendly display names (e.g., "Northridge Finance")
 */

export const LENDER_NAME_MAP: Record<string, string> = {
  // Major Finance Companies
  'black_horse': 'Black Horse',
  'close_brothers_finance': 'Close Brothers Finance',
  'motonovo': 'Motonovo',
  'vw_finance': 'VW Finance',
  'santander': 'Santander',
  'bmw_finance': 'BMW Finance',
  'barclays': 'Barclays',
  'ford_credit': 'Ford Credit',
  'stellantis_financial_services': 'Stellantis Financial Services',
  'moneybarn': 'Moneybarn',
  'mercedes_finance': 'Mercedes Finance',
  'vauxhall_finance': 'Vauxhall Finance',
  'toyota_finance': 'Toyota Finance',
  'rci': 'RCI Financial Services',
  'oodle_finance': 'Oodle Finance',
  'psa_finance': 'PSA Finance',
  'placeholder': 'Various Lenders',
  'alphera': 'Alphera',
  'blue_motor_finance': 'Blue Motor Finance',
  'advantage_finance': 'Advantage Finance',
  'northridge_finance': 'Northridge Finance',
  'lloyds_bank': 'Lloyds Bank',
  'hyundai': 'Hyundai Finance',
  'first_response': 'First Response Finance',
  'clydesdale_finance': 'Clydesdale Finance',
  'fca_automotive_services': 'FCA Automotive Services',
  'car_finance_247': 'Car Finance 247',
  'secure_trust_bank': 'Secure Trust Bank',
  'startline_motor_finance': 'Startline Motor Finance',
  'honda_financial_services': 'Honda Financial Services',
  'halifax': 'Halifax',
  'creation_finance': 'Creation Finance',
  'audi': 'Audi Finance',
  'moneyway': 'Moneyway',
  'hitachi_capital': 'Hitachi Capital',
  'nissan_finance': 'Nissan Finance',
  'peugeot': 'Peugeot Finance',
  'gmac': 'GMAC',
  'novuna': 'Novuna',
  'first_stop_finance': 'First Stop Finance',
  'welcome_financial_services': 'Welcome Financial Services',
  'renault_finance': 'Renault Finance',
  'admiral': 'Admiral',
  'zopa': 'Zopa',
  'specialist_motor_finance': 'Specialist Motor Finance',
  'citroen': 'Citroën Finance',
  'two_four_seven_money': '247 Money',
  'land_rover': 'Land Rover Finance',
  'kia_financial_services': 'Kia Financial Services',
  'v12_vehicle_finance': 'V12 Vehicle Finance',
  'fiat_finance': 'Fiat Finance',
  'ca_finance': 'CA Finance',
  'family_finance': 'Family Finance',
  'paragon_finance': 'Paragon Finance',
  'zuto_finance': 'Zuto Finance',
  'bank_of_scotland': 'Bank of Scotland',
  'mann_island': 'Mann Island',
  'fga_capital': 'FGA Capital',
  'go_car_credit': 'Go Car Credit',
  'mini': 'MINI Finance',
  'billing_finance': 'Billing Finance',
  'lombard_north_central': 'Lombard North Central',
  'marsh_finance': 'Marsh Finance',
  'suzuki': 'Suzuki Finance',
  'seat': 'SEAT Finance',
  'skoda': 'Škoda Finance',
  'pcf_bank': 'PCF Bank',
  'volvo_car_financial_services': 'Volvo Car Financial Services',
  'jaguar': 'Jaguar Finance',
  'aldermore': 'Aldermore Bank',
  'asset_exchange': 'Asset Exchange',
  'the_car_finance_company_2007': 'The Car Finance Company',
  'conister_bank': 'Conister Bank',
  'lexus_finance': 'Lexus Finance',
  'cls_finance': 'CLS Finance',
  'vehicle_credit': 'Vehicle Credit',
  'auto_money_motor_finance': 'Auto Money Motor Finance',
  'bnp_paribas': 'BNP Paribas',
  'bank_of_ireland': 'Bank of Ireland',
  'autobank': 'Autobank',
  'raphaels_finance': 'Raphaels Finance',
  'british_credit_trust': 'British Credit Trust',
  'hartwell_finance': 'Hartwell Finance',
  'mazda_financial_services': 'Mazda Financial Services',
  'mobilize': 'Mobilize Financial Services',
  'the_funding_corporation': 'The Funding Corporation',
  'abarth': 'Abarth Finance',
  'dacia': 'Dacia Finance',
  'mallard_finance': 'Mallard Finance',
  'motion_finance': 'Motion Finance',
  'accept_car_credit': 'Accept Car Credit',
  'alfa_romeo': 'Alfa Romeo Finance',
  'tandem_motor_finance': 'Tandem Motor Finance',
  'mitsubishi': 'Mitsubishi Finance',
  'autolend': 'Autolend',
  'borderway_finance': 'Borderway Finance',
  'glenside_finance': 'Glenside Finance',
  'international_motors_finance': 'International Motors Finance',
  'london_and_surrey': 'London and Surrey Finance',
  'porsche': 'Porsche Finance',
  'arkle_finance': 'Arkle Finance',
  'midland_mercantile': 'Midland Mercantile',
  'oplo': 'Oplo',
  'shogun': 'Shogun Finance',
  'premium_plan_limited': 'Premium Plan Limited',
  'stoneacre': 'Stoneacre Finance',
  'ignition_credit': 'Ignition Credit',
  'mg_financial_services': 'MG Financial Services',
  'carshop': 'Carshop Finance',
  'hampshire_trust_bank': 'Hampshire Trust Bank',
  'carmoola': 'Carmoola',
  'chrysler': 'Chrysler Finance',
  'euphoria_car_finance': 'Euphoria Car Finance',
  'trax_motor_finance': 'Trax Motor Finance',
  'united_trust_bank': 'United Trust Bank',
  'jbr_capital': 'JBR Capital',
  'bentley': 'Bentley Finance',
  'genesis': 'Genesis Finance',
  'richardson_brothers': 'Richardson Brothers',
  'evington_finance': 'Evington Finance',
  'car_money': 'Car Money',
  'erwin_hymer_group': 'Erwin Hymer Group',
  'chase_bank': 'Chase Bank',
  'ferrari': 'Ferrari Finance',
  'jeep': 'Jeep Finance',
  'maserati': 'Maserati Finance',
  'ducati': 'Ducati Finance',
  'the_car_loan_centre': 'The Car Loan Centre',
  'kawasaki': 'Kawasaki Finance',
  'lotus': 'Lotus Finance',
  'pegasus_car_finance': 'Pegasus Car Finance',
  'lamborghini': 'Lamborghini Finance',
  'mclaren': 'McLaren Finance',
  'global_vans': 'Global Vans',
  'stour_vale': 'Stour Vale Finance',
  'oracle_finance': 'Oracle Finance',
  'mobile_money': 'Mobile Money',
  'polesworth_motor_finance': 'Polesworth Motor Finance',
  'really_easy_credit': 'Really Easy Credit',
  'right_drive': 'Right Drive',
  'varooma': 'Varooma',
  'glm_finance': 'GLM Finance',
  'arnold_clark': 'Arnold Clark Finance'
};

/**
 * Get friendly display name for a lender
 * @param lenderName - The database lender name (e.g., "northridge_finance")
 * @returns Friendly display name (e.g., "Northridge Finance")
 */
export function getFriendlyLenderName(lenderName: string | null | undefined): string {
  if (!lenderName) {
    return 'Unknown Lender';
  }

  // Check for exact match first
  const mappedName = LENDER_NAME_MAP[lenderName.toLowerCase()];
  if (mappedName) {
    return mappedName;
  }

  // Fallback: convert snake_case to Title Case
  return lenderName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get shortened display name for space-constrained UI elements
 * @param lenderName - The database lender name
 * @returns Shortened friendly name (e.g., "Northridge" instead of "Northridge Finance")
 */
export function getShortLenderName(lenderName: string | null | undefined): string {
  const fullName = getFriendlyLenderName(lenderName);
  
  // Remove common suffixes for shorter display
  return fullName
    .replace(/\s+(Finance|Financial Services|Bank|Credit|Capital)$/i, '')
    .trim() || fullName;
}

/**
 * Get all lender mappings for debugging/admin purposes
 */
export function getAllLenderMappings(): Record<string, string> {
  return LENDER_NAME_MAP;
} 