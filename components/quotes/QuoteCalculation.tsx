'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, Truck, CreditCard, TrendingUp } from 'lucide-react';
import { QuoteLineItem, QuoteCustomer, PricingMode, PaymentMethod } from '@/types/quote';

interface QuoteCalculationProps {
  lineItems: QuoteLineItem[];
  customer?: QuoteCustomer;
  pricingMode: PricingMode;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
}

interface ShippingZone {
  id: string;
  name: string;
  ltlPercent: number;
  states: string[];
}

interface Tier {
  id: string;
  name: string;
  threshold: number;
  discountPercent: number;
}

export default function QuoteCalculation({
  lineItems,
  customer,
  pricingMode,
  paymentMethod,
  onPaymentMethodChange,
}: QuoteCalculationProps) {
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPricingData();
  }, []);

  async function loadPricingData() {
    try {
      // Load shipping zones
      const shippingResponse = await fetch('/quotes/data/shipping.json');
      const shippingData = await shippingResponse.json();
      const zones = Object.entries(shippingData.zones || {}).map(([id, zone]: [string, any]) => ({
        id,
        name: zone.name,
        ltlPercent: zone.ltlPercent,
        states: zone.states || [],
      }));
      setShippingZones(zones);

      // Load tiers
      const tiersResponse = await fetch('/quotes/data/tiers.json');
      const tiersData = await tiersResponse.json();
      const tiersArray = Object.entries(tiersData).map(([id, tier]: [string, any]) => ({
        id,
        name: tier.name,
        threshold: tier.threshold,
        discountPercent: tier.margin || 0,
      }));
      setTiers(tiersArray.sort((a, b) => b.threshold - a.threshold));

      setLoading(false);
    } catch (error) {
      console.error('Error loading pricing data:', error);
      setLoading(false);
    }
  }

  // Calculate subtotal
  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);

  // Calculate total cases
  const totalCases = lineItems.reduce((sum, item) => sum + item.masterCases, 0);

  // Find applicable tier
  const applicableTier = tiers.find(tier => totalCases >= tier.threshold);

  // Calculate tier discount
  const tierDiscount = applicableTier ? (subtotal * applicableTier.discountPercent / 100) : 0;
  const subtotalAfterDiscount = subtotal - tierDiscount;

  // Find shipping zone
  const shippingZone = customer?.state
    ? shippingZones.find(zone => zone.states.includes(customer.state!))
    : null;

  // Calculate shipping
  let shipping = 0;
  if (shippingZone && totalCases >= 12) {
    // LTL freight for 12+ cases
    shipping = subtotalAfterDiscount * (shippingZone.ltlPercent / 100);
  } else if (pricingMode === 'retail' && totalCases >= 2) {
    // Free shipping for retail 2+ cases
    shipping = 0;
  } else if (shippingZone) {
    // Ground shipping for < 12 cases
    shipping = totalCases * 50; // Simplified - should use ground rates
  }

  // Calculate credit card fee
  const creditCardFee = paymentMethod === 'creditCard' ? (subtotalAfterDiscount + shipping) * 0.03 : 0;

  // Calculate total
  const total = subtotalAfterDiscount + shipping + creditCardFee;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 sticky top-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-primary-600" />
        Quote Summary
      </h2>

      <div className="space-y-4">
        {/* Subtotal */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
        </div>

        {/* Tier Discount */}
        {applicableTier && tierDiscount > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-green-600 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-green-800">{applicableTier.name}</span>
                  <span className="font-semibold text-green-800">-${tierDiscount.toFixed(2)}</span>
                </div>
                <p className="text-xs text-green-700">
                  {applicableTier.discountPercent}% discount for {totalCases} cases
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Subtotal After Discount */}
        {tierDiscount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">After Discount:</span>
            <span className="font-semibold text-gray-900">${subtotalAfterDiscount.toFixed(2)}</span>
          </div>
        )}

        {/* Shipping */}
        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Shipping:</span>
            </div>
            <span className="font-semibold text-gray-900">
              {shipping === 0 && pricingMode === 'retail' && totalCases >= 2 ? (
                <span className="text-green-600">FREE</span>
              ) : (
                `$${shipping.toFixed(2)}`
              )}
            </span>
          </div>
          {shippingZone && (
            <p className="text-xs text-gray-500">
              {shippingZone.name} • {totalCases >= 12 ? 'LTL Freight' : 'Ground Shipping'}
            </p>
          )}
          {!customer?.state && (
            <p className="text-xs text-amber-600">Select customer to calculate shipping</p>
          )}
        </div>

        {/* Payment Method */}
        <div className="border-t border-gray-200 pt-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Method:
          </label>
          <div className="space-y-2">
            <button
              onClick={() => onPaymentMethodChange('wire')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border-2 transition-colors ${
                paymentMethod === 'wire'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-sm font-medium">Wire Transfer</span>
              {paymentMethod === 'wire' && (
                <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              )}
            </button>
            <button
              onClick={() => onPaymentMethodChange('check')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border-2 transition-colors ${
                paymentMethod === 'check'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-sm font-medium">Company Check</span>
              {paymentMethod === 'check' && (
                <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              )}
            </button>
            <button
              onClick={() => onPaymentMethodChange('creditCard')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border-2 transition-colors ${
                paymentMethod === 'creditCard'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-sm font-medium">Credit Card</span>
              {paymentMethod === 'creditCard' && (
                <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              )}
            </button>
          </div>
        </div>

        {/* Credit Card Fee */}
        {paymentMethod === 'creditCard' && creditCardFee > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">CC Fee (3%):</span>
            </div>
            <span className="font-semibold text-gray-900">${creditCardFee.toFixed(2)}</span>
          </div>
        )}

        {/* Total */}
        <div className="border-t-2 border-gray-300 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-gray-900">Total:</span>
            <span className="text-2xl font-bold text-primary-600">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Quote Stats */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Total Items:</span>
            <span className="font-semibold text-gray-900">{lineItems.length}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Total Cases:</span>
            <span className="font-semibold text-gray-900">{totalCases}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Pricing Mode:</span>
            <span className="font-semibold text-gray-900 capitalize">{pricingMode}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
