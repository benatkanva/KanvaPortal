/**
 * Centralized Data Relationships
 * Auto-generated from docs/data_schema.md
 * Single source of truth for all collection relationships
 */

import { collection, query, where, getDocs, getDoc, doc, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// ============================================================================
// RELATIONSHIP DEFINITIONS
// ============================================================================

export interface Relationship {
  collection: string;
  localField: string;
  foreignField: string;
  type: '1:1' | '1:many' | 'many:1' | 'many:many';
  description?: string;
}

export const RELATIONSHIPS: Record<string, Record<string, Relationship>> = {
  copper_companies: {
    orders: {
      collection: 'fishbowl_sales_orders',
      localField: 'cf_698467',
      foreignField: 'customerId',
      type: '1:many',
      description: 'Company orders from Fishbowl ERP',
    },
    contacts: {
      collection: 'copper_people',
      localField: 'id',
      foreignField: 'company_id',
      type: '1:many',
      description: 'Company contacts/people',
    },
    opportunities: {
      collection: 'copper_opportunities',
      localField: 'id',
      foreignField: 'company_id',
      type: '1:many',
      description: 'Sales opportunities',
    },
    assignedTo: {
      collection: 'users',
      localField: 'assignee_id',
      foreignField: 'copper_user_id',
      type: 'many:1',
      description: 'Assigned sales rep',
    },
  },
  
  copper_people: {
    company: {
      collection: 'copper_companies',
      localField: 'company_id',
      foreignField: 'id',
      type: 'many:1',
      description: 'Parent company',
    },
    assignedTo: {
      collection: 'users',
      localField: 'assignee_id',
      foreignField: 'copper_user_id',
      type: 'many:1',
      description: 'Assigned sales rep',
    },
  },
  
  fishbowl_sales_orders: {
    customer: {
      collection: 'copper_companies',
      localField: 'customerId',
      foreignField: 'cf_698467',
      type: 'many:1',
      description: 'Customer company',
    },
    lineItems: {
      collection: 'fishbowl_sales_order_items',
      localField: 'id',
      foreignField: 'orderId',
      type: '1:many',
      description: 'Order line items',
    },
    salesRep: {
      collection: 'users',
      localField: 'salesRep',
      foreignField: 'email',
      type: 'many:1',
      description: 'Sales representative',
    },
    commission: {
      collection: 'commission_details',
      localField: 'id',
      foreignField: 'orderId',
      type: '1:1',
      description: 'Commission record',
    },
  },
  
  fishbowl_sales_order_items: {
    order: {
      collection: 'fishbowl_sales_orders',
      localField: 'orderId',
      foreignField: 'id',
      type: 'many:1',
      description: 'Parent order',
    },
  },
  
  users: {
    assignedCompanies: {
      collection: 'copper_companies',
      localField: 'copper_user_id',
      foreignField: 'assignee_id',
      type: '1:many',
      description: 'Assigned companies',
    },
    assignedContacts: {
      collection: 'copper_people',
      localField: 'copper_user_id',
      foreignField: 'assignee_id',
      type: '1:many',
      description: 'Assigned contacts',
    },
    orders: {
      collection: 'fishbowl_sales_orders',
      localField: 'email',
      foreignField: 'salesRep',
      type: '1:many',
      description: 'Sales orders',
    },
    commissions: {
      collection: 'monthly_commissions',
      localField: 'uid',
      foreignField: 'userId',
      type: '1:many',
      description: 'Monthly commission summaries',
    },
  },
  
  monthly_commissions: {
    user: {
      collection: 'users',
      localField: 'userId',
      foreignField: 'uid',
      type: 'many:1',
      description: 'User/sales rep',
    },
  },
  
  commission_details: {
    order: {
      collection: 'fishbowl_sales_orders',
      localField: 'orderId',
      foreignField: 'id',
      type: '1:1',
      description: 'Related order',
    },
    user: {
      collection: 'users',
      localField: 'userId',
      foreignField: 'uid',
      type: 'many:1',
      description: 'User/sales rep',
    },
    customer: {
      collection: 'copper_companies',
      localField: 'customerId',
      foreignField: 'cf_698467',
      type: 'many:1',
      description: 'Customer company',
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get related documents for a given document
 * @param sourceCollection - Source collection name
 * @param sourceDoc - Source document data
 * @param relationshipName - Name of relationship from RELATIONSHIPS
 */
export async function getRelated(
  sourceCollection: string,
  sourceDoc: DocumentData,
  relationshipName: string
): Promise<DocumentData[]> {
  const relationship = RELATIONSHIPS[sourceCollection]?.[relationshipName];
  
  if (!relationship) {
    console.warn(`Relationship '${relationshipName}' not found for collection '${sourceCollection}'`);
    return [];
  }
  
  const localValue = sourceDoc[relationship.localField];
  
  if (!localValue) {
    console.warn(`Local field '${relationship.localField}' not found in source document`);
    return [];
  }
  
  // For 1:1 or many:1, get single document
  if (relationship.type === '1:1' || relationship.type === 'many:1') {
    const docRef = doc(db, relationship.collection, String(localValue));
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? [{ id: docSnap.id, ...docSnap.data() }] : [];
  }
  
  // For 1:many, query by foreign field
  const q = query(
    collection(db, relationship.collection),
    where(relationship.foreignField, '==', localValue)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get a document with all its related data
 * @param collectionName - Collection name
 * @param docId - Document ID
 * @param includeRelationships - Array of relationship names to include
 */
export async function getDocumentWithRelations(
  collectionName: string,
  docId: string,
  includeRelationships: string[] = []
): Promise<DocumentData | null> {
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  const data: Record<string, any> = { id: docSnap.id, ...docSnap.data() };
  
  // Load all requested relationships
  for (const relationshipName of includeRelationships) {
    const related = await getRelated(collectionName, data, relationshipName);
    data[relationshipName] = related;
  }
  
  return data;
}

// ============================================================================
// SPECIFIC HELPER FUNCTIONS (Auto-generated)
// ============================================================================

/**
 * Get company with orders
 */
export async function getCompanyWithOrders(companyId: string) {
  return getDocumentWithRelations('copper_companies', companyId, ['orders']);
}

/**
 * Get company with contacts
 */
export async function getCompanyWithContacts(companyId: string) {
  return getDocumentWithRelations('copper_companies', companyId, ['contacts']);
}

/**
 * Get company with all related data
 */
export async function getCompanyWithAllRelations(companyId: string) {
  return getDocumentWithRelations('copper_companies', companyId, [
    'orders',
    'contacts',
    'opportunities',
    'assignedTo',
  ]);
}

/**
 * Get order with line items
 */
export async function getOrderWithLineItems(orderId: string) {
  return getDocumentWithRelations('fishbowl_sales_orders', orderId, ['lineItems']);
}

/**
 * Get order with customer and line items
 */
export async function getOrderWithCustomerAndItems(orderId: string) {
  return getDocumentWithRelations('fishbowl_sales_orders', orderId, [
    'customer',
    'lineItems',
    'salesRep',
  ]);
}

/**
 * Get user with all assigned data
 */
export async function getUserWithAssignments(userId: string) {
  return getDocumentWithRelations('users', userId, [
    'assignedCompanies',
    'assignedContacts',
    'orders',
    'commissions',
  ]);
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate if a relationship exists
 */
export function hasRelationship(
  sourceCollection: string,
  relationshipName: string
): boolean {
  return RELATIONSHIPS[sourceCollection]?.[relationshipName] !== undefined;
}

/**
 * Get all available relationships for a collection
 */
export function getAvailableRelationships(collectionName: string): string[] {
  return Object.keys(RELATIONSHIPS[collectionName] || {});
}

/**
 * Get relationship details
 */
export function getRelationshipDetails(
  sourceCollection: string,
  relationshipName: string
): Relationship | null {
  return RELATIONSHIPS[sourceCollection]?.[relationshipName] || null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default RELATIONSHIPS;
