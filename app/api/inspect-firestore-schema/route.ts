import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

interface CollectionSchema {
  name: string;
  documentCount: number;
  fields: Array<{
    name: string;
    type: string;
    occurrences: number;
    sampleValues: any[];
  }>;
  subcollections: string[];
}

async function inspectCollection(collectionName: string, sampleSize: number = 100): Promise<CollectionSchema> {
  try {
    const collectionRef = adminDb.collection(collectionName);
    
    // Get document count
    const countSnapshot = await collectionRef.count().get();
    const documentCount = countSnapshot.data().count;
    
    // Sample documents
    const snapshot = await collectionRef.limit(sampleSize).get();
    
    // Analyze fields
    const fieldMap = new Map<string, { type: Set<string>; count: number; samples: any[] }>();
    const subcollectionsSet = new Set<string>();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Check for subcollections
      const subcollections = await doc.ref.listCollections();
      subcollections.forEach(sub => subcollectionsSet.add(sub.id));
      
      // Analyze fields
      Object.entries(data).forEach(([key, value]) => {
        if (!fieldMap.has(key)) {
          fieldMap.set(key, { type: new Set(), count: 0, samples: [] });
        }
        
        const field = fieldMap.get(key)!;
        field.count++;
        
        // Determine type
        const valueType = Array.isArray(value) 
          ? 'array'
          : value === null 
          ? 'null'
          : typeof value === 'object' && value.constructor.name === 'Timestamp'
          ? 'timestamp'
          : typeof value === 'object'
          ? 'object'
          : typeof value;
        
        field.type.add(valueType);
        
        // Store sample (max 3 per field)
        if (field.samples.length < 3 && value !== null && value !== undefined) {
          if (valueType === 'timestamp') {
            field.samples.push(value.toDate().toISOString());
          } else if (valueType === 'object' || valueType === 'array') {
            field.samples.push(JSON.stringify(value).substring(0, 100));
          } else {
            field.samples.push(value);
          }
        }
      });
    }
    
    // Convert to array
    const fields = Array.from(fieldMap.entries()).map(([name, data]) => ({
      name,
      type: Array.from(data.type).join(' | '),
      occurrences: data.count,
      sampleValues: data.samples,
    })).sort((a, b) => b.occurrences - a.occurrences);
    
    return {
      name: collectionName,
      documentCount,
      fields,
      subcollections: Array.from(subcollectionsSet),
    };
  } catch (error: any) {
    console.error(`Error inspecting ${collectionName}:`, error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { collections, sampleSize = 100 } = await request.json();
    
    if (!collections || !Array.isArray(collections)) {
      return NextResponse.json(
        { error: 'collections array is required' },
        { status: 400 }
      );
    }
    
    console.log(`Inspecting ${collections.length} collections...`);
    
    const schemas: CollectionSchema[] = [];
    
    for (const collectionName of collections) {
      console.log(`  Inspecting ${collectionName}...`);
      try {
        const schema = await inspectCollection(collectionName, sampleSize);
        schemas.push(schema);
      } catch (error) {
        console.error(`  Failed to inspect ${collectionName}:`, error);
        schemas.push({
          name: collectionName,
          documentCount: 0,
          fields: [],
          subcollections: [],
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      schemas,
    });
  } catch (error: any) {
    console.error('Error in inspect-firestore-schema:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // List all collections
    const collections = await adminDb.listCollections();
    const collectionNames = collections.map(col => col.id).sort();
    
    return NextResponse.json({
      success: true,
      collections: collectionNames,
      count: collectionNames.length,
    });
  } catch (error: any) {
    console.error('Error listing collections:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
