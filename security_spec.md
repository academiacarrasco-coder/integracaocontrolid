# Security Specification - Carrasco Fit Turnstile Commands

## Data Invariants
1. A hardware command MUST have a status of 'pending', 'sent', 'success', or 'error'.
2. Only authorized employees or admins can create hardware commands.
3. Once a command is 'sent', its content (verb, endpoint, body) cannot be modified.
4. All commands must have a `createdAt` timestamp set by the request time.

## The "Dirty Dozen" Payloads (Denial Expected)
1. **Identity Spoofing**: Attempt to create a command with a manually set `admin: true` field.
2. **Identity Spoofing**: Attempt to create a command as an unauthenticated user.
3. **Identity Spoofing**: Attempt to create a command as a student (not employee/admin).
4. **State Shortcutting**: Create a command with `status: 'success'` to bypass device execution.
5. **State Shortcutting**: Update a 'pending' command directly to 'success' without ever being 'sent'.
6. **Resource Poisoning**: Injection of a 1MB string into the `endpoint` field.
7. **Resource Poisoning**: Injection of malicious document ID like `../../../etc/passwd`.
8. **Integrity Violation**: Updating the `body` of a command after it has been marked as `sent`.
9. **Integrity Violation**: Changing the `createdAt` timestamp of an existing command.
10. **Identity Integrity**: Creating a command where `recordedBy` doesn't match the actual `request.auth.uid`.
11. **Type Poisoning**: Sending `body` as a string instead of a map/object.
12. **PII Leak**: Reading all commands without being an employee/admin.

## The Test Runner (Logic Outline)
Verified using exhaustive `isEmployee()` and `isAdmin()` checks, combined with `isValidHardwareCommand()` helper ensuring schema adherence and strict status transitions.
