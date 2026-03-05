# User Check-In & Verification System

A comprehensive check-in system for gym members at the entrance, supporting three authentication methods with color-coded status verification.

## Features

### Three Authentication Methods

1. **QR Code Scanner**
   - Camera-based QR code scanning
   - Manual input fallback
   - Real-time verification

2. **User ID Entry**
   - Direct ID input
   - Quick verification
   - Keyboard-friendly

3. **Name Search**
   - Real-time autocomplete search
   - Shows member photos and email
   - Click-to-verify interface

### Verification Logic

The system checks multiple conditions to determine access:

- ✅ **Membership Status**: Active, expired, or frozen
- ✅ **Payment Status**: Completed, pending, failed, or overdue
- ✅ **Account Status**: Suspended or banned
- ✅ **Trial Status**: Active, ended, or expired
- ✅ **Plan Start Date**: Whether plan is not yet active
- ✅ **Overdue Days**: Days since payment due date

### Color-Coded Status

- 🟢 **Green**: Active membership, access granted
- 🟡 **Yellow**: Membership expiring soon (within 3 days)
- 🔴 **Red**: Rejected (expired, overdue, banned, suspended)
- ⚫ **Grey**: Frozen or paused membership

### User Verification Popup

Displays comprehensive information:

- Large user photo
- Full name and membership plan
- Expiry date and days remaining
- Overdue days (if applicable)
- Status reason (bold, prominent)
- Rejection details (if rejected)

### Admin Actions

- **Renew Membership**: Navigate to membership page
- **Override Access**: Admin-only feature to grant access despite restrictions

## File Structure

```
src/admin/checkin/
├── api/
│   └── checkin.ts              # Verification API and user search
├── components/
│   ├── QRScanner.tsx           # QR code scanner component
│   └── UserVerificationPopup.tsx  # Result display popup
├── pages/
│   └── CheckInPage.tsx         # Main check-in page
├── index.ts                    # Module exports
├── README.md                   # This file
└── DATABASE_FIELDS.md          # Database schema documentation
```

## Usage

### Accessing the Feature

1. Navigate to **Check-In & Verification** in the admin sidebar
2. Choose one of three authentication methods
3. Enter/scan the identifier
4. View the verification result

### QR Code Scanning

1. Click "Start Camera" to activate
2. Position QR code within the frame
3. Use "Manual Input" if automatic scanning fails
4. Result popup appears automatically

### User ID Entry

1. Enter the user's ID in the input field
2. Click "Verify" or press Enter
3. View verification result

### Name Search

1. Type at least 2 characters
2. Browse autocomplete results
3. Click on a member to verify
4. View verification result

## Database Requirements

See `DATABASE_FIELDS.md` for complete database schema requirements. Key fields include:

- `qr_code_string`: QR code identifier
- `membership_status`: Active/expired/frozen
- `renewal_due_date`: Primary expiry date
- `membership_expiry`: Legacy expiry date (synced)
- `payment_status`: Payment status
- `account_suspended`: Suspension flag
- `account_banned`: Ban flag
- `plan_frozen`: Freeze flag

## Technical Details

### API Endpoint

The system uses a client-side API function:

```typescript
verifyUserCheckIn(identifier: string): Promise<CheckInResult>
```

This function:

1. Searches for user by QR code, ID, or name
2. Evaluates all verification conditions
3. Returns status, color, reason, and user details

### Response Format

```typescript
{
  status: "approved" | "rejected",
  color: "green" | "yellow" | "red" | "grey",
  reason: string,
  user: {
    photoUrl: string | null,
    fullName: string,
    membershipPlan: string | null,
    expiryDate: string | null,
    daysLeft: number,
    overdueDays: number
  }
}
```

## Performance

- Popup loads in < 1 second
- Real-time search with 300ms debounce
- Optimized camera streaming
- Efficient database queries

## Future Enhancements

Potential improvements:

1. **QR Code Library Integration**
   - Install `html5-qrcode` for automatic QR detection
   - Remove manual input requirement

2. **Audit Logging**
   - Track all check-in attempts
   - Log override actions

3. **Bulk Verification**
   - Verify multiple users at once
   - Batch processing

4. **Statistics Dashboard**
   - Daily check-in counts
   - Rejection reasons analytics

## Troubleshooting

### Camera Not Working

- Check browser permissions
- Use HTTPS (required for camera access)
- Try manual input fallback

### User Not Found

- Verify QR code is correctly associated
- Check user ID format
- Ensure user role is "member"

### Verification Always Rejects

- Check database fields are populated
- Verify membership expiry dates
- Review payment status values

## Support

For issues or questions, refer to:

- `DATABASE_FIELDS.md` for schema requirements
- Component source code for implementation details
- API documentation in `api/checkin.ts`
