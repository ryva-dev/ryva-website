# Page: Login

## Purpose and user

Authenticate Representatives and authorized Ryva staff without implying product access before credential and subscription checks. Primary users are returning Representatives, Mentors/Instructors entering sandbox environments, Admin, and Support.

## Data displayed

Email/password form; approved OAuth options; password reset; verification state; security notice; support link. No product or credential details before authentication.

## Actions

Primary: Sign in.  
Secondary: Continue with approved OAuth, reset password, resend verification, contact support.

## Filters

None.

## States

- **Empty:** blank secure form with concise access requirement.
- **Loading:** controls disabled; one progress indicator; prevent double submit.
- **Error:** generic invalid credentials; specific verified-email or disabled-account recovery where safe; preserve email only.

## Permissions and responsive

Public route. Authenticated users redirect to access evaluation. Single-column mobile and desktop card; password managers and keyboard submit supported.

## Linked records and AI

Links to Certification access information, privacy, terms, security, and support. No AI.

## Acceptance criteria

- secure session established only after valid authentication;
- rate limiting and origin/CSRF controls apply;
- errors do not disclose account existence unnecessarily;
- successful login always runs credential/subscription access check;
- login, failure category, session creation, and logout are audited safely.

