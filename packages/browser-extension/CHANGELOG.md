# Roadmap

## Committed

- TODO: Open Sprint task board by clicking on Iteration path
- TODO: Tooltips for metadata
- TODO: Sort items by category, not state
- TODO: Prevent separator at line start
- TODO: Bust icon cache after 24h
- TODO: Correctly 401 error as authentication error
- TODO: Refactor sync logic

## Sometime in the future

- TODO: Support custom include/exclude of item types
- TODO: Improve keyboard navigation, escape to close, row level movement
- TODO: Click filter to toggle corresponding string in query
- TODO: adjust polling rate based on network quality
- TODO: Support dark theme and handle `color-scheme: light dark;`

# Changelog

## v1.4.0

- Added: Support for all item types
- Added: Progress display during loading
- Added: Handle Sync error in status bar
- Fixed: Inaccurate state indicator colors
- Fixed: Polling started before initial sync is finished
- Added: Improved status message on options page
- Chore: Event-driven refactoring

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
