# SAIA Charge Calculation Fix

## Issue
The SAIA shipment charges are not being calculated correctly. The discount is not being properly accounted for in the total charges.

## Example from SAIA Report

```
Shipment Information 
Description	Code	Package Type	Hazardous	Pieces	Weight	Rate	Amt
REDUCED WEIGHT PER INSPECTION	70				-80 LBS	238.93	$-191.14
LIQUID SUPPLEMENT	70	PT		1	2400 LBS	238.93	$5734.32
LIQUID SUPPLEMENT	70	PT		1	2400 LBS	238.93	$5734.32
LIQUID SUPPLEMENT	70	PT		1	2400 LBS	238.93	$5734.32
FUEL SURCHARGE	FS					0	$247.99
DISCOUNT					(95.20%)	$16,195.25
TOTAL CHARGES						$1,064.56
```

## Correct Field Mapping

### Firebase Realtime Database Structure

```javascript
{
  "shipping/saia/shipments/{proNumber}": {
    // ... other fields ...
    
    "charges": 1064.56,           // ✅ TOTAL CHARGES (after discount)
    "netCharges": 17011.82,       // Sum of line items before discount
    "fuelSurcharge": 247.99,      // Fuel surcharge amount
    "discount": 16195.25,         // Discount amount (should be added to schema)
    "discountPercent": 95.20,     // Discount percentage (should be added to schema)
    
    // ... other fields ...
  }
}
```

## Calculation Breakdown

1. **Line Items Total**: $5,734.32 + $5,734.32 + $5,734.32 - $191.14 = $17,011.82
2. **Fuel Surcharge**: $247.99
3. **Subtotal**: $17,011.82 + $247.99 = $17,259.81
4. **Discount (95.20%)**: -$16,195.25
5. **TOTAL CHARGES**: $1,064.56 ✅

## Google Apps Script Fix

Your Google Apps Script needs to parse the SAIA CSV/report and extract:

```javascript
// When parsing SAIA report
const shipment = {
  // ... other fields ...
  
  // CRITICAL: Use the "TOTAL CHARGES" line from SAIA report
  charges: parseFloat(totalChargesLine),  // This is AFTER discount
  
  // Store the pre-discount amount for reference
  netCharges: parseFloat(lineItemsSum),   // Sum of line items before discount
  
  // Store fuel surcharge separately
  fuelSurcharge: parseFloat(fuelSurchargeLine),
  
  // NEW: Store discount information
  discount: parseFloat(discountAmount),
  discountPercent: parseFloat(discountPercent),
  
  // ... other fields ...
};
```

## KanvaPortal Display Fix

The KanvaPortal dashboard should display:

1. **Primary Display**: Use `charges` field (TOTAL CHARGES after discount)
2. **Detail View**: Show breakdown:
   - Net Charges (before discount)
   - Discount amount and percentage
   - Fuel Surcharge
   - **Total Charges** (final amount)

## Action Items

### 1. Update Google Apps Script
In your Google Apps Script that processes SAIA reports:

```javascript
// Find the TOTAL CHARGES line in the SAIA report
// This is the final amount AFTER discount
const totalChargesMatch = reportText.match(/TOTAL CHARGES\s+\$?([\d,]+\.?\d*)/i);
const totalCharges = totalChargesMatch ? parseFloat(totalChargesMatch[1].replace(/,/g, '')) : 0;

// Find the DISCOUNT line
const discountMatch = reportText.match(/DISCOUNT\s+\(([\d.]+)%\)\s+\$?([\d,]+\.?\d*)/i);
const discountPercent = discountMatch ? parseFloat(discountMatch[1]) : 0;
const discountAmount = discountMatch ? parseFloat(discountMatch[2].replace(/,/g, '')) : 0;

// Calculate net charges (before discount)
const netCharges = totalCharges + discountAmount;

// Store in Firebase
const shipmentData = {
  // ... other fields ...
  charges: totalCharges,        // ✅ Use this for display
  netCharges: netCharges,       // For reference
  discount: discountAmount,     // NEW field
  discountPercent: discountPercent, // NEW field
  fuelSurcharge: fuelSurcharge,
  // ... other fields ...
};
```

### 2. Update TypeScript Types (Optional)
Add discount fields to the TypeScript interface:

```typescript
export interface SAIAShipment {
  // ... existing fields ...
  charges: number;              // TOTAL CHARGES (after discount)
  netCharges: number;           // Before discount
  fuelSurcharge: number;
  discount?: number;            // NEW: Discount amount
  discountPercent?: number;     // NEW: Discount percentage
  // ... other fields ...
}
```

### 3. Update Dashboard Display (Optional)
Show discount information in the customer detail modal:

```typescript
// In SAIACustomerDetail.tsx or SAIAShipmentSearch.tsx
<div>
  <div className="text-sm text-gray-500">Net Charges</div>
  <div className="text-lg font-medium text-gray-900">
    ${shipment.netCharges.toFixed(2)}
  </div>
</div>
{shipment.discount && (
  <div>
    <div className="text-sm text-gray-500">
      Discount ({shipment.discountPercent}%)
    </div>
    <div className="text-lg font-medium text-red-600">
      -${shipment.discount.toFixed(2)}
    </div>
  </div>
)}
<div>
  <div className="text-sm text-gray-500">Total Charges</div>
  <div className="text-xl font-bold text-gray-900">
    ${shipment.charges.toFixed(2)}
  </div>
</div>
```

## Verification

After fixing the Google Apps Script:

1. **Check Firebase**: Verify `charges` field contains the TOTAL CHARGES amount
2. **Check Dashboard**: Verify displayed amounts match SAIA reports
3. **Check Totals**: Verify customer total charges sum correctly

## Summary

**The Fix**: Your Google Apps Script must parse the **"TOTAL CHARGES"** line from the SAIA report (which is AFTER the discount) and store it in the `charges` field. Do NOT sum up the line items - use the final total that SAIA provides.

**Current Issue**: The script is likely summing line items before discount, or not parsing the TOTAL CHARGES line correctly.

**Solution**: Update the Apps Script to correctly extract and use the TOTAL CHARGES value from the SAIA report.
