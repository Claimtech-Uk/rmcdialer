import { NextResponse } from 'next/server';
import { replicaDb } from '@/lib/mysql';

export async function GET() {
  try {
    console.log('🔍 Inspecting user_logs table structure...');

    // Get user_logs table column information
    const userLogsColumns = await replicaDb.$queryRaw`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'myclaimscentre_resolvemyclaim' 
      AND TABLE_NAME = 'user_logs'
      ORDER BY ORDINAL_POSITION
    `;

    console.log('📋 User logs columns:', userLogsColumns);

    // Get sample data from user_logs to see the actual structure
    const sampleLogs = await replicaDb.$queryRaw`SELECT * FROM user_logs LIMIT 3`;
    
    console.log('📋 Sample user logs:', sampleLogs);

    // Convert BigInt to string for JSON serialization
    const processData = (data: any) => {
      return JSON.parse(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
    };

    return NextResponse.json({
      success: true,
      data: {
        columns: processData(userLogsColumns),
        sampleLogs: processData(sampleLogs)
      },
      timestamp: new Date(),
      message: 'User logs table inspection completed'
    });

  } catch (error: any) {
    console.error('❌ User logs inspection failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date(),
      message: 'User logs inspection failed'
    }, { status: 500 });
  }
} 