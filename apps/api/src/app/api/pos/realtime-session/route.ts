import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
        }

        // Generate an ephemeral token for the Realtime API
        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-realtime-2.1',
                voice: 'alloy',
                instructions: 'You are an AI order assistant for Pappas Ocean Catch. Ask the user what they would like to order and collect their name and items. Use the tools provided to submit the order when complete. Never invent menu items or prices. Confirm everything with the user.',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to create realtime session:', errorText);
            return NextResponse.json(
                { error: 'Failed to create realtime session', details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Realtime session error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
