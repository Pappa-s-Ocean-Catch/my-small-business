import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { name, email, phone, message } = body as {
      name?: unknown;
      email?: unknown;
      phone?: unknown;
      message?: unknown;
    };

    const safeName = typeof name === 'string' ? name.trim() : '';
    const safeEmail = typeof email === 'string' ? email.trim() : '';
    const safePhone = typeof phone === 'string' ? phone.trim() : '';
    const safeMessage = typeof message === 'string' ? message.trim() : '';

    // Validate required fields
    if (!safeName || !safeEmail || !safeMessage) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(safeEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (!resend || !process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return NextResponse.json(
        { success: false, error: 'Email service is not configured' },
        { status: 500 }
      );
    }

    const emailFrom = process.env.EMAIL_FROM;
    if (!emailFrom) {
      console.error('EMAIL_FROM is not configured');
      return NextResponse.json(
        { success: false, error: 'Email sender is not configured' },
        { status: 500 }
      );
    }

    const contactEmail = process.env.CONTACT_EMAIL;
    if (!contactEmail) {
      console.error('CONTACT_EMAIL is not configured');
      return NextResponse.json(
        { success: false, error: 'Contact recipient email is not configured' },
        { status: 500 }
      );
    }

    // Send email notification
    const emailSubject = `New Contact Form Submission from ${safeName}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e11d48;">New Contact Form Submission</h2>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>
          ${safePhone ? `<p><strong>Phone:</strong> ${escapeHtml(safePhone)}</p>` : ''}
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap; background-color: white; padding: 15px; border-radius: 4px; margin-top: 10px;">${escapeHtml(safeMessage)}</p>
        </div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          This email was sent from the contact form on Pappa's Ocean Catch website.
        </p>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [contactEmail],
      replyTo: safeEmail,
      subject: emailSubject,
      html: emailHtml,
    });

    if (error) {
      console.error('Error sending contact form email:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to send message. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you for your message! We will get back to you soon.',
      messageId: data?.id,
    });
  } catch (error) {
    console.error('Error processing contact form:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
