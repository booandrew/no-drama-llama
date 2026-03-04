Google Calendar Event Resource — Full Data Model

  Root Fields

  - kind (string, read-only) — resource type, always "calendar#event"
  - etag (etag, read-only) — ETag of the resource
  - id (string) — opaque event identifier (5–1024 chars, base32hex)
  - status (string) — "confirmed" | "tentative" | "cancelled"
  - htmlLink (string, read-only) — absolute link to event in Google Calendar UI
  - created (datetime, read-only) — creation timestamp (RFC3339)
  - updated (datetime, read-only) — last modification timestamp (RFC3339)
  - summary (string) — event title
  - description (string) — event description, can contain HTML
  - location (string) — geographic location, free-form text
  - colorId (string) — color ID from the colors endpoint
  - iCalUID (string) — unique identifier per RFC5545
  - sequence (integer) — iCalendar sequence number
  - transparency (string) — "opaque" (blocks time) | "transparent" (doesn't block)
  - visibility (string) — "default" | "public" | "private" | "confidential"
  - locked (boolean, read-only) — whether this is a locked event copy
  - privateCopy (boolean) — if true, event propagation is disabled
  - endTimeUnspecified (boolean) — whether end time is unspecified
  - recurringEventId (string, read-only) — ID of the parent recurring event (for instances)
  - recurrence[] (list of strings) — RRULE, EXRULE, RDATE, EXDATE lines per RFC5545
  - eventType (string) — "default" | "birthday" | "focusTime" | "fromGmail" | "outOfOffice" | "workingLocation"
  - hangoutLink (string, read-only) — link to associated Google Hangout
  - anyoneCanAddSelf (boolean, deprecated) — whether anyone can invite themselves
  - guestsCanInviteOthers (boolean, default: true) — attendees can invite others
  - guestsCanModify (boolean, default: false) — attendees can modify the event
  - guestsCanSeeOtherGuests (boolean, default: true) — attendees can see other attendees
  - attendeesOmitted (boolean) — whether attendees were omitted from representation

  ---
  creator (object, read-only)

  - id (string) — profile ID
  - email (string) — email address
  - displayName (string) — name, if available
  - self (boolean) — whether creator matches this calendar

  organizer (object)

  - id (string, read-only) — profile ID
  - email (string) — email address (RFC5322)
  - displayName (string) — name, if available
  - self (boolean, read-only) — whether organizer matches this calendar

  ---
  start (object, required)

  - dateTime (datetime) — RFC3339 timestamp (for timed events)
  - date (date) — yyyy-mm-dd (for all-day events)
  - timeZone (string) — IANA timezone, e.g. "Europe/Zurich"

  end (object, required)

  - dateTime (datetime) — RFC3339 timestamp (exclusive end)
  - date (date) — yyyy-mm-dd (for all-day events)
  - timeZone (string) — IANA timezone

  originalStartTime (object, read-only for instances)

  - dateTime (datetime) — original start for moved recurring event instance
  - date (date) — for all-day events
  - timeZone (string) — IANA timezone

  ---
  attendees[] (array)

  - email (string, required) — attendee's email (RFC5322)
  - displayName (string) — name, if available
  - id (string, read-only) — profile ID
  - self (boolean, read-only) — whether this entry matches this calendar
  - organizer (boolean, read-only) — whether attendee is the organizer
  - resource (boolean) — whether attendee is a resource (room, etc.)
  - optional (boolean, default: false) — whether attendance is optional
  - responseStatus (string) — "needsAction" | "declined" | "tentative" | "accepted"
  - comment (string) — response comment
  - additionalGuests (integer, default: 0) — number of additional guests

  ---
  reminders (object)

  - useDefault (boolean) — whether calendar's default reminders apply
  - overrides[] (array, max 5)
    - method (string, required) — "email" | "popup"
    - minutes (integer, required) — minutes before event (0–40320)

  ---
  extendedProperties (object)

  - private (object) — key-value pairs private to this calendar copy
    - (key) (string) — custom property name → value
  - shared (object) — key-value pairs shared across all attendees' copies
    - (key) (string) — custom property name → value

  ---
  conferenceData (object)

  - conferenceId (string, read-only) — conference ID
  - signature (string, read-only) — server-generated signature
  - notes (string) — additional notes, can contain HTML (max 2048 chars)
  - conferenceSolution (object, read-only)
    - name (string) — user-visible solution name
    - iconUri (string) — icon URL
    - key.type (string) — "eventHangout" | "eventNamedHangout" | "hangoutsMeet" | "addOn"
  - createRequest (object)
    - requestId (string) — client-generated unique ID
    - conferenceSolutionKey.type (string) — solution type
    - status.statusCode (string, read-only) — "pending" | "success" | "failure"
  - entryPoints[] (array)
    - entryPointType (string) — "video" | "phone" | "sip" | "more"
    - uri (string) — entry point URI (max 1300 chars)
    - label (string) — visible label (max 512 chars)
    - pin (string) — PIN (max 128 chars)
    - accessCode (string) — access code (max 128 chars)
    - meetingCode (string) — meeting code (max 128 chars)
    - passcode (string) — passcode (max 128 chars)
    - password (string) — password (max 128 chars)

  ---
  source (object)

  - title (string) — title of the source (e.g. web page title, email subject)
  - url (string) — URL of the source (HTTP or HTTPS only)

  ---
  attachments[] (array, max 25)

  - fileUrl (string, required) — URL link to the attachment
  - title (string) — attachment title
  - mimeType (string, read-only) — MIME type
  - iconLink (string) — icon URL (custom attachments only)
  - fileId (string, read-only) — Google Drive file ID

  ---
  gadget (object, deprecated)

  - type (string) — gadget type
  - title (string) — gadget title
  - link (string) — gadget URL (HTTPS only)
  - iconLink (string) — icon URL
  - width (integer) — width in pixels
  - height (integer) — height in pixels
  - display (string) — "icon" | "chip"
  - preferences.(key) (string) — custom preference key-value pairs

  ---
  Event-type-specific properties

  birthdayProperties (when eventType = "birthday")

  - contact (string, read-only) — resource name, e.g. "people/c12345"
  - type (string) — "anniversary" | "birthday" | "custom" | "other" | "self"
  - customTypeName (string, read-only) — custom type label

  outOfOfficeProperties (when eventType = "outOfOffice")

  - autoDeclineMode (string) — "declineNone" | "declineAllConflictingInvitations" | "declineOnlyNewConflictingInvitations"
  - declineMessage (string) — auto-decline response message

  focusTimeProperties (when eventType = "focusTime")

  - autoDeclineMode (string) — same as above
  - declineMessage (string) — auto-decline response message
  - chatStatus (string) — "available" | "doNotDisturb"

  workingLocationProperties (when eventType = "workingLocation")

  - type (string, required) — "homeOffice" | "officeLocation" | "customLocation"
  - homeOffice (any) — presence indicates working from home
  - customLocation
    - label (string) — optional extra label
  - officeLocation
    - buildingId (string) — building identifier
    - floorId (string) — floor identifier
    - floorSectionId (string) — floor section identifier
    - deskId (string) — desk identifier
    - label (string) — office name displayed in Calendar clients

  ---
  Constraints

  - Max 25 attachments per event
  - Max 5 reminder overrides
  - Event ID: 5–1024 characters, base32hex only
  - Attendee response status not propagated if >200 guests
  - Set conferenceDataVersion=1 request param to modify conference data
