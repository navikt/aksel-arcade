# Feature Specification: Share Project URL

**Feature Branch**: `001-share-project-url`  
**Created**: 2025-11-20  
**Status**: Draft  
**Input**: User description: "New feature for sharing project URL. Respecting the client-side rig with no backend, we will make it possible to share a project with a URL. The user clicks a 'Share' button and sees a popover. The sharing URL is generated and shown in the popover. The user clicks on the copy URL button to copy the URL to the clipboard. The URL sharing will be a new feature in addition to the existing export/import. Details: The share button is in the header between the Import button and the Settings button. It's an icon button like the Settings button, with the icon LinkIcon. Clicking the share button will open an Aksel Darkside Popover component. In the Popover, the user will read about sharing this prototype by copying this link. And the user will see an Aksel Darkside CopyButton to copy the generated link, with the label 'Copy share link'. Showing the link will not add value since it will be extremely long. The app will start generating the share link when the user clicks the share button. If the link is not finished generated when the Popover opens, the user will see a loading state on the copy link button. If the generation takes more than 9 seconds, the user will also see a text that explains that the generation takes some time, and sorry for the wait. I know that storing the editor code hashed in the URL to share it is vulnerable because the URL length has a limit. Therefore, you must find the most effective way of compressing the code and the hash added to the URL."

## Clarifications

### Session 2025-11-21

- Q: How should the Share popover respond when the project exceeds the safe URL length limit? → A: Keep the popover open, explain the project is too large, disable the CopyButton, and provide a primary “Use Export instead” action without attempting link generation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Share current project from header (Priority: P1)

Prototype builders can open the Share popover from the header, trigger link generation, and copy the share URL without leaving their flow.

**Why this priority**: Sharing the active project snapshot is the core value of the feature and must work before any additional guidance or edge-case handling.

**Independent Test**: Start from any project, click the Share button, wait for the popover to render, confirm link generation completes, and copy the link to the clipboard.

**Acceptance Scenarios**:

1. **Given** the header shows Import, Share, and Settings buttons, **When** the user clicks the Share icon button, **Then** an Aksel Darkside Popover opens with explanatory text and a CopyButton labeled "Copy share link" in a loading state until a link is ready.
2. **Given** the popover shows the ready state, **When** the user clicks "Copy share link", **Then** the generated URL is copied to the clipboard and the user receives confirmation without exposing the raw link text.

---

### User Story 2 - Communicate slow generation (Priority: P2)

When encoding a large project takes noticeable time, the popover keeps the user informed, blocks premature copying, and apologizes if the wait exceeds 9 seconds.

**Why this priority**: Sharing must remain trustworthy even under heavy payloads; clear messaging prevents users from assuming the feature failed.

**Independent Test**: Simulate a large project snapshot, click Share, and verify the loading, >9 second apology text, and eventual completion states without manual refresh.

**Acceptance Scenarios**:

1. **Given** link generation is still running, **When** the elapsed time is under 9 seconds, **Then** the CopyButton shows a spinner/disabled state with tooltip text explaining that the link is being prepared.
2. **Given** link generation exceeds 9 seconds, **When** the user keeps the popover open, **Then** additional helper text appears apologizing for the delay while the CopyButton remains disabled until completion.

---

### User Story 3 - Open shared link to load project (Priority: P3)

Recipients can open the shared URL in Aksel Arcade and land in an editor session that automatically loads the shared project snapshot without manual import/export steps.

**Why this priority**: Sharing is incomplete unless recipients can reliably reconstruct the project from the encoded link; however, it depends on link creation working first.

**Independent Test**: Copy a generated link, open it in a fresh browser session, and verify the editor loads the shared code, metadata, and settings without additional prompts besides any standard confirmation dialog.

**Acceptance Scenarios**:

1. **Given** a recipient opens a valid share URL, **When** the app parses the encoded payload, **Then** the editor loads the shared project snapshot (code, tabs, theme, viewport) and confirms the load to the user before allowing further edits.

---

### Edge Cases

- Share is requested while offline or while local storage is unavailable, so generating the link should fail gracefully with guidance to retry when connectivity returns.
- The current project is so large that even compressed payloads risk exceeding the 3,600 warning / 4,000 hard character ceiling, so the user must be warned and offered alternatives (e.g., fall back to export/import).
  - When this occurs, the Share popover must explain the project is too large, keep the CopyButton disabled, and highlight a primary "Use Export instead" action without attempting link generation.
- Clipboard permissions are denied (browser security, unsupported device); the UI must report failure and provide directions to retry or use manual copy if feasible.
- The user reopens the Share popover while a generation is already running; progress should persist without spawning duplicate requests.
- A recipient opens a link whose payload was tampered with or is corrupt; the app should reject it with a friendly error rather than loading partial code.
- Users close the popover mid-generation and reopen it shortly after; the system should resume the existing result instead of restarting indefinitely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The header must display a Share icon button (LinkIcon) positioned between Import and Settings to match existing controls.
- **FR-002**: Clicking Share must open an Aksel Darkside Popover that explains how link sharing works and contains an Aksel Darkside CopyButton labeled "Copy share link".
- **FR-003**: As soon as Share is clicked, the system must start generating a shareable URL based on the current project snapshot (code, metadata, preview settings) entirely on the client without backend calls.
- **FR-004**: The shareable URL must compress and hash the snapshot so the final query string stays within commonly supported URL length limits while allowing the app to detect tampering.
- **FR-005**: The CopyButton must display a loading/disabled state until the URL is ready, then enable copying, and revert to a retriable state if generation errors occur.
- **FR-006**: When generation exceeds 9 seconds, the popover must show additional explanatory text apologizing for the delay while continuing the background operation.
- **FR-007**: Successful copying must write the URL to the clipboard, display confirmation (e.g., toast or inline status), and keep the popover open so the user can copy again if desired.
- **FR-008**: If clipboard access fails, the UI must notify the user, offer a retry, and (when browser restrictions allow) provide a secondary action such as selecting hidden text for manual copy without exposing the full URL by default.
- **FR-009**: Generated URLs must be idempotent per snapshot so repeated clicks without further edits return the same link, preventing unnecessary variations.
- **FR-010**: Opening a share URL must automatically decode, decompress, validate the payload checksum, and load the project snapshot into the editor while warning the user that their current unsaved work will be replaced.
- **FR-011**: The feature must coexist with the existing export/import flow; Share cannot remove or alter those controls and should mention that exporting remains available for offline backups.
- **FR-012**: If the projected URL would exceed the 4,000-character limit (warning at 3,600), opening Share must show an oversize warning in the popover, disable the CopyButton, and present a primary “Use Export instead” action instead of attempting to generate a link.

### Key Entities *(include if feature involves data)*

- **Project Snapshot**: Captures the editor state at share time, including open files, code content, preview settings, theme selection, and timestamps needed for recipients to reconstruct the same view.
- **Shareable URL Payload**: A compressed, hashed string appended to the URL that represents the snapshot plus metadata (version, checksum) so the receiving client can validate and hydrate the project.
- **Share Session State**: UI state machine that tracks generation progress, elapsed time, last success/failure, and clipboard feedback for the currently open popover.

## Assumptions

- Share URLs must stay below 4,000 characters (with a warning as soon as estimates pass 3,600) to remain reliable across major browsers; exceeding this threshold triggers a user-facing warning and failure state.
- Recipients already have access to the same client-side experience (no authentication changes needed) and understand that opening the link replaces their current workspace.
- The platform remains client-only; no server storage or shortening service will be introduced for this iteration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of share link generations for projects up to 50 KB complete and enable the CopyButton within 3 seconds of clicking Share.
- **SC-002**: 99% of copy attempts succeed on the first try on browsers that grant clipboard permissions, with clear error messaging for the remaining 1%.
- **SC-003**: 100% of generated URLs remain under 4,000 characters, and any attempt to exceed the limit results in a user-facing warning (beginning at 3,600 characters) instead of producing an invalid link.
- **SC-004**: 90% of recipients confirm that opening a share link loads the exact project snapshot without needing manual import/export steps.
- **SC-005**: Whenever generation surpasses 9 seconds, the delay/apology message appears within 500 ms of the threshold in 100% of observed sessions.

