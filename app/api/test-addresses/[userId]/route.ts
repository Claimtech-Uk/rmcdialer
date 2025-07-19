import { NextRequest, NextResponse } from 'next/server';
import { replicaDb } from '@/lib/mysql';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = parseInt(params.userId);
    
    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Get user basic info
    const user = await replicaDb.user.findUnique({
      where: { id: BigInt(userId) },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        current_user_address_id: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get ALL addresses for this user
    const allAddresses = await replicaDb.userAddress.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });

    // Get current address (via relation)
    const currentAddress = await replicaDb.userAddress.findUnique({
      where: { id: user.current_user_address_id || '' }
    });

    const response = {
      user: {
        id: Number(user.id),
        name: `${user.first_name} ${user.last_name}`,
        currentAddressId: user.current_user_address_id
      },
      currentAddress: currentAddress ? {
        id: currentAddress.id,
        type: currentAddress.type,
        fullAddress: currentAddress.full_address,
        postCode: currentAddress.post_code,
        county: currentAddress.county,
        createdAt: currentAddress.created_at
      } : null,
      allAddresses: allAddresses.map(addr => ({
        id: addr.id,
        type: addr.type,
        fullAddress: addr.full_address,
        postCode: addr.post_code,
        county: addr.county,
        createdAt: addr.created_at
      })),
      summary: {
        totalAddresses: allAddresses.length,
        addressTypes: [...new Set(allAddresses.map(a => a.type))],
        hasCurrentAddress: !!currentAddress,
        hasMultipleAddresses: allAddresses.length > 1
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Test addresses error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch addresses',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 