# Changelog

## Unreleased

- Added: Keyboard navigation (arrow key + enter)
- Improved: Color tweak

## v1.5.4

- Improved: Display indexer progress
- Improved Status bar content tweak
- Improved: Setup form usability
- Fixed: Truncate 20k+ query results
- Fixed: Disabled item type rendered as whitespace
- Fixed: Holding backspace cannot clear search query result

## v1.5.3

- Improved: Consistent visual feedback after successful copy
- Improved: List scrolling performance

## v1.5.2

- Improved: Hover tool-tips
- Fixed: Errors in User Guide

## v1.5.1

- Improved: Search algorithm tweaks
- Fixed: Closing popup during index export caused data loss

## v1.5.0

- New: Highlight keywords in title
- Improved: Derive Project from Area path
- Improved: Easier to hover on state indicator
- Improved: Comfortable highlight color
- Improved: Search algorithm tweaks
- Changed: Clicking on tag no longer selects it
- Changed: Items are ranked by relevance, except for the Resolved and Removed category
- Fixed: ID + title copy format issue

## v1.4.1

- Fixed: Premature network validation during setup

## v1.4.0

- New: Support all Work Item types
- New: Support all Work Item state colors
- New: Tool-tips for metadata
- Improved: Progress and status display
- Improved: Error messaging and handling in status bar
- Improved: Items sorting algorithm
- Changed: Clicking title will no long closes popup
- Fixed: Separator could appear at line start
- Fixed: Polling started before initial sync is finished

## v1.3.0

- Added: Link to chrome shortcuts page
- Changed: <kbd>Esc</kbd> to re-focus search box and close popup
- Changed: Cursor style tweak
- Chore: Removed unused package
- Fixed: HTML table semantics
- Fixed: Paste to Azure DevOps results in whitespace

## v1.2.0

- Added: Click icon to make a copy-friendly selection
- Added: In-app documentation
- Changed: Improved performance and reduced bandwidth usage
- Changed: Left click on link will close the popup
- Changed: Default keyboard shortcut will be <kbd>Alt</kbd>+<kbd>A</kbd>
- Fixed: Long tag caused overflow
- Fixed: Typing into search box didn't reset scroll

## v1.1.0

- Added: Highlight matched fields during search
- Added: Tags
- Changed: "Cut" state is indicated by an empty bar
- Changed: "Completed" and "Cut" items in search results are grouped and moved to bottom
- Chore: Logging clean-up

## v1.0.2

- Added: Auto sync after connecting to data source
- Changed: Text content adjustment
- Fixed: Icon was missing in extensions list
- Fixed: DB was dirty after saving config
- Fixed: Sync failed due to unassigned work item
- Fixed: Long title without whitespace caused overflow
- Removed: `Team` field in setup

## v1.0.1

- Initial release
