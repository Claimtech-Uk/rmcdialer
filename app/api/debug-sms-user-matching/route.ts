import { NextRequest, NextResponse } from 'next/server';
import { replicaDb } from '@/lib/mysql';
import { logger } from '@/modules/core/utils/logger.utils';

export async function GET(request: NextRequest) {
  try {
    const phoneNumber = '+447738585850'; // The failing phone number

    logger.info('🔍 DEBUG: Testing SMS user matching for phone number', { phoneNumber });

    // Test all the search strategies from SMSService
    const results = {
      phoneNumber,
      strategies: [] as any[]
    };

    // Clean phone number
    const cleanPhoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    const last10Digits = cleanPhoneNumber.slice(-10);
    const withoutCountryCode = cleanPhoneNumber.replace(/^(\+44|44|0)/, '');

    // Strategy 1: Exact match
    try {
      const user1 = await replicaDb.user.findFirst({
        where: { phone_number: phoneNumber },
        select: { id: true, first_name: true, last_name: true, phone_number: true }
      });
      results.strategies.push({
        strategy: 'exact_match',
        searchValue: phoneNumber,
        found: !!user1,
        user: user1 ? {
          id: Number(user1.id),
          firstName: user1.first_name,
          lastName: user1.last_name,
          phoneNumber: user1.phone_number
        } : null
      });
    } catch (error) {
      results.strategies.push({
        strategy: 'exact_match',
        searchValue: phoneNumber,
        error: String(error)
      });
    }

    // Strategy 2: Clean number match
    try {
      const user2 = await replicaDb.user.findFirst({
        where: { phone_number: cleanPhoneNumber },
        select: { id: true, first_name: true, last_name: true, phone_number: true }
      });
      results.strategies.push({
        strategy: 'clean_match',
        searchValue: cleanPhoneNumber,
        found: !!user2,
        user: user2 ? {
          id: Number(user2.id),
          firstName: user2.first_name,
          lastName: user2.last_name,
          phoneNumber: user2.phone_number
        } : null
      });
    } catch (error) {
      results.strategies.push({
        strategy: 'clean_match',
        searchValue: cleanPhoneNumber,
        error: String(error)
      });
    }

    // Strategy 3: Last 10 digits contains
    try {
      const user3 = await replicaDb.user.findFirst({
        where: { phone_number: { contains: last10Digits } },
        select: { id: true, first_name: true, last_name: true, phone_number: true }
      });
      results.strategies.push({
        strategy: 'last_10_digits',
        searchValue: last10Digits,
        found: !!user3,
        user: user3 ? {
          id: Number(user3.id),
          firstName: user3.first_name,
          lastName: user3.last_name,
          phoneNumber: user3.phone_number
        } : null
      });
    } catch (error) {
      results.strategies.push({
        strategy: 'last_10_digits',
        searchValue: last10Digits,
        error: String(error)
      });
    }

    // Strategy 4: Without country code
    try {
      const user4 = await replicaDb.user.findFirst({
        where: { phone_number: { contains: withoutCountryCode } },
        select: { id: true, first_name: true, last_name: true, phone_number: true }
      });
      results.strategies.push({
        strategy: 'without_country_code',
        searchValue: withoutCountryCode,
        found: !!user4,
        user: user4 ? {
          id: Number(user4.id),
          firstName: user4.first_name,
          lastName: user4.last_name,
          phoneNumber: user4.phone_number
        } : null
      });
    } catch (error) {
      results.strategies.push({
        strategy: 'without_country_code',
        searchValue: withoutCountryCode,
        error: String(error)
      });
    }

    // Also search for any users with similar phone numbers
    try {
      const similarUsers = await replicaDb.user.findMany({
        where: {
          OR: [
            { phone_number: { contains: '7738585850' } },
            { phone_number: { contains: '447738585850' } },
            { phone_number: { contains: '07738585850' } }
          ]
        },
        select: { id: true, first_name: true, last_name: true, phone_number: true },
        take: 5
      });

      results.strategies.push({
        strategy: 'similar_search',
        searchValue: 'variants of 7738585850',
        found: similarUsers.length > 0,
        users: similarUsers.map(user => ({
          id: Number(user.id),
          firstName: user.first_name,
          lastName: user.last_name,
          phoneNumber: user.phone_number
        }))
      });
    } catch (error) {
      results.strategies.push({
        strategy: 'similar_search',
        error: String(error)
      });
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalStrategies: results.strategies.length,
        foundMatches: results.strategies.filter(s => s.found).length,
        cleanPhoneNumber,
        last10Digits,
        withoutCountryCode
      }
    });

  } catch (error) {
    logger.error('Failed to debug SMS user matching:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
} 