export interface SAIAShipment {
  proNumber: string;
  customerName: string;
  customerCode: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerZip: string;
  weight: number;
  pieces: number;
  charges: number;
  netCharges: number;
  fuelSurcharge: number;
  discount: number;
  discountPercent: number;
  pickupDate: string;
  deliveryDate: string;
  deliveryTime: string;
  status: string;
  onTime: boolean;
  latePickup: boolean;
  actualDays: number;
  standardDays: number;
  signature: string;
  timeArrive: string;
  timeDepart: string;
  bolNumber: string;
  poNumber: string;
  originTerminal: string;
  destTerminal: string;
  importedAt: string;
}

export interface SAIAShipmentSummary {
  proNumber: string;
  pickupDate: string;
  deliveryDate: string;
  status: string;
  weight: number;
  charges: number;
}

export interface SAIACustomer {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  totalShipments: number;
  totalWeight: number;
  totalCharges: number;
  totalNetCharges: number;
  totalFuelSurcharge: number;
  totalDiscount: number;
  avgDiscount: number;
  avgDiscountPercent: number;
  deliveredShipments: number;
  onTimeShipments: number;
  lateShipments: number;
  inTransitShipments: number;
  onTimePercentage: number;
  avgWeight: number;
  avgCharges: number;
  avgNetCharges: number;
  firstShipmentDate: string;
  lastShipmentDate: string;
  lastUpdated: string;
  recentShipments: SAIAShipmentSummary[];
}

export interface SAIASummaryStats {
  totalCustomers: number;
  totalShipments: number;
  totalWeight: number;
  totalCharges: number;
}
