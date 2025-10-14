# Remote Student Registration Feature - Implementation Summary

## Overview
Implemented a comprehensive remote student registration system that allows admins, lecturers, and class representatives to generate shareable links for students to self-register remotely.

## Key Features

### 1. Registration Token Management
- **Token Generation**: Secure URL-safe tokens generated using Python's `secrets` module (32 bytes)
- **Class-Specific**: Each token is tied to a specific class
- **Access Control**: 
  - Class reps can only create tokens for their assigned class
  - Lecturers can create tokens for classes they teach
  - Admins have full access to all classes
- **One Active Token Per Class**: System reuses existing active token if present

### 2. On/Off Visibility Toggle
- **Real-time Control**: Toggle switch to enable/disable registration without deleting the link
- **When Active (ON)**: Students can access registration page and register
- **When Inactive (OFF)**: Students see "Registration Closed" message with contact info
- **Instant Effect**: Changes apply immediately without needing to regenerate links

### 3. Link Sharing Features
- **Copy to Clipboard**: One-click copy button for the registration URL
- **Native Sharing**: Web Share API integration for mobile devices (WhatsApp, email, etc.)
- **Fallback Support**: Graceful degradation for browsers without Share API

### 4. Remote Registration Page
- **Public Access**: No login required - accessed via token
- **Class Locked**: Students automatically registered to the token's class
- **Same Face Capture**: Uses the same 5-photo enrollment with retake functionality
- **Validation**: Checks for duplicate student IDs
- **Error Handling**: Clear error messages for invalid submissions

## Database Schema

### RegistrationToken Model
```python
class RegistrationToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    class_id = db.Column(db.Integer, db.ForeignKey('class.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

## Routes Implemented

### Admin Routes (Login Required)
1. **`GET /admin/registration-tokens`** - List all accessible registration tokens
2. **`GET/POST /admin/registration-tokens/generate`** - Generate new registration token
3. **`POST /admin/registration-tokens/toggle/<id>`** - Toggle active status (on/off)
4. **`POST /admin/registration-tokens/delete/<id>`** - Delete a registration token

### Public Routes (Token-Based Access)
1. **`GET /register/<token>`** - Public registration page or "closed" message
2. **`POST /api/remote-register/<token>`** - API endpoint for student registration

## Templates Created

### 1. `templates/admin/registration_tokens/list.html`
- Displays all registration tokens in a table
- Shows class info, registration URL, status, creation date
- Copy and share buttons for each link
- Toggle switch for enable/disable
- Delete button with confirmation

### 2. `templates/admin/registration_tokens/generate.html`
- Class selection dropdown
- Token generation form
- Success display with URL and instructions
- Copy and share functionality

### 3. `templates/remote_registration.html`
- Public-facing registration form
- Student details input fields
- 5-photo face capture with retake functionality
- Real-time validation and error display
- Success message and form reset

### 4. `templates/registration_closed.html`
- Displayed when token is inactive
- Shows class information
- Contact instructions for students
- Creator information

## User Experience Flow

### For Admins/Lecturers/Class Reps:
1. Navigate to Dashboard → "Registration Links"
2. Click "Generate New Link"
3. Select target class (auto-selected for class reps)
4. Copy or share the generated link
5. Toggle on/off to control registration access
6. View all created links and their status
7. Delete links when no longer needed

### For Students:
1. Receive registration link from lecturer/class rep
2. Click link to open registration page
3. If registration is open:
   - Fill in student details (ID, name)
   - Capture 5 face photos with guided instructions
   - Retake any photo if needed
   - Submit registration
   - See success message
4. If registration is closed:
   - See "Registration Closed" page
   - View contact information
   - Contact lecturer/class rep to enable access

## Security Features

1. **CSRF Exemption**: Public routes use `@csrf.exempt` for accessibility
2. **Token Validation**: Every registration verifies token exists and is active
3. **Class Access Control**: Strict validation of class permissions
4. **Unique Tokens**: URL-safe random tokens prevent guessing
5. **Face Validation**: Backend validates face detection in all 5 images
6. **Duplicate Prevention**: Checks for existing student IDs

## Technical Implementation

### Token Generation
```python
@staticmethod
def generate_token():
    return secrets.token_urlsafe(32)  # 256-bit security
```

### Toggle Functionality
- AJAX POST request to `/admin/registration-tokens/toggle/<id>`
- Returns JSON with new status
- Updates UI without page reload

### Share Functionality
- Uses Web Share API when available (mobile)
- Falls back to clipboard copy on desktop
- Works across different messaging apps

### Class Locking
- Token stores `class_id` in database
- Registration endpoint uses token's class, not user input
- Prevents students from registering to wrong class

## Migration

Run the migration script to create the new table:
```bash
python migrate_registration_tokens.py
```

## Files Modified/Created

### Backend (app.py)
- Added `import secrets`
- Added `RegistrationToken` model
- Added 6 new routes for token management and remote registration
- Added access control logic for different user roles

### Frontend Templates
- `templates/admin/registration_tokens/list.html` (new)
- `templates/admin/registration_tokens/generate.html` (new)
- `templates/remote_registration.html` (new)
- `templates/registration_closed.html` (new)
- `templates/admin/dashboard.html` (modified - added registration links card)

### Migration
- `migrate_registration_tokens.py` (new)

### Documentation
- `.github/copilot-instructions.md` (updated)

## Usage Examples

### Generate Link (Class Rep)
```
1. Class rep logs in
2. Goes to Registration Links
3. Clicks "Generate New Link"
4. Class is auto-selected (their assigned class)
5. Clicks "Generate Link"
6. Shares link via WhatsApp: "Register using this link: https://..."
```

### Toggle Registration (Lecturer)
```
1. Lecturer wants to pause registration temporarily
2. Goes to Registration Links list
3. Toggles switch to OFF
4. Students now see "Registration Closed"
5. Later, toggles back to ON
6. Students can register again
```

### Student Registration
```
1. Student receives link: https://app.com/register/abc123xyz...
2. Opens link in browser
3. Fills in: Student ID, First Name, Last Name
4. Clicks "Start Camera"
5. Captures 5 photos with different angles
6. Clicks "Complete Registration"
7. Sees "Registration successful!" message
```

## Benefits

✅ **Scalability**: Hundreds of students can register without manual intervention
✅ **Flexibility**: Registration can be enabled/disabled instantly
✅ **Security**: Token-based access with class locking
✅ **User-Friendly**: Simple interface for both admins and students
✅ **Mobile-Optimized**: Share functionality works great on mobile devices
✅ **Role-Based**: Different capabilities for admins, lecturers, and class reps
✅ **Audit Trail**: Track who created each token and when
✅ **Error Prevention**: Validates faces, checks duplicates, provides clear feedback

## Future Enhancements (Optional)

- [ ] Token expiration dates
- [ ] Registration analytics (how many students used each link)
- [ ] Batch token generation for multiple classes
- [ ] QR code generation for registration links
- [ ] Email notification when students register
- [ ] Rate limiting to prevent abuse
- [ ] Custom welcome messages per class
