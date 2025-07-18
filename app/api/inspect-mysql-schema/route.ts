import { NextResponse } from 'next/server';
import { replicaDb } from '@/lib/mysql';

export async function GET() {
  try {
    console.log('🔍 Inspecting MySQL database schema...');

    // Get first few users to see actual column structure
    const users = await replicaDb.$queryRaw`SELECT * FROM users LIMIT 3`;
    
    console.log('👥 Sample users data:', users);

    // Get table column information
    const userColumns = await replicaDb.$queryRaw`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'myclaimscentre_resolvemyclaim' 
      AND TABLE_NAME = 'users'
      ORDER BY ORDINAL_POSITION
    `;

    console.log('📋 Users table columns:', userColumns);

    // Check what tables exist
    const tables = await replicaDb.$queryRaw`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'myclaimscentre_resolvemyclaim'
      ORDER BY TABLE_NAME
    `;

    console.log('🗃️ Available tables:', tables);

    // Convert BigInt to string for JSON serialization
    const processData = (data: any) => {
      return JSON.parse(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
    };

    return NextResponse.json({
      success: true,
      data: {
        sampleUsers: processData(users),
        userColumns: processData(userColumns),
        availableTables: processData(tables)
      },
      timestamp: new Date(),
      message: 'Database schema inspection completed'
    });

  } catch (error: any) {
    console.error('❌ Schema inspection failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date(),
      message: 'Schema inspection failed'
    }, { status: 500 });
  }
} 