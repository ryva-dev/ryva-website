import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, company, role, teamSize, message, formType } = body

    if (!name || !email || !company) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'allie@ryvaforge.com'

    const subject = formType === 'demo'
      ? `New demo request: ${name} from ${company}`
      : formType === 'cloud-access'
      ? `New cloud access request: ${name} from ${company}`
      : formType === 'enterprise'
      ? `New enterprise inquiry: ${name} from ${company}`
      : `New contact: ${name} from ${company}`

    const html = `
      <h2>${subject}</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Company:</strong> ${company}</p>
      ${role ? `<p><strong>Role:</strong> ${role}</p>` : ''}
      ${teamSize ? `<p><strong>Team size:</strong> ${teamSize}</p>` : ''}
      ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
      <p><strong>Form type:</strong> ${formType}</p>
    `

    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Ryva Website <notifications@ryvaforge.com>',
          to: [NOTIFICATION_EMAIL],
          reply_to: email,
          subject,
          html,
        }),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact API error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
