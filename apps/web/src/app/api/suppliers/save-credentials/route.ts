import { NextRequest, NextResponse } from 'next/server';
import { saveSupplierCredentials } from '@/app/actions/suppliers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentUserId, supplierId, username, password } = body as {
      currentUserId?: string;
      supplierId?: string;
      username?: string;
      password?: string;
    };

    if (!currentUserId || !supplierId || !username || !password) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const result = await saveSupplierCredentials({
      currentUserId,
      supplierId,
      username,
      password,
    });

    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}


