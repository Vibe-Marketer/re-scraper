# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.0] - 2026-01-17

### Added
- **Unified Contact Extraction** - New dual-phase scanning approach that first scans the property page for person icon boxes, then checks "View Contacts" drawer for additional data
- **Smart Contact Merging** - Automatically merges duplicate contacts and keeps the most complete information
- **Page Load Validation** - Detects when property pages fail to load and automatically retries
- **LLC Filtering** - Automatically filters out corporate entities (LLC, Inc, Corp, etc.) to focus on individual contacts
- **Enhanced Phone Validation** - Improved filtering to exclude dates, zip codes, and invalid phone patterns
- **Real-time Progress Tracking** - Visual progress bar with page/row counters and total captured count
- **Live Debug Logging** - Toggle-able debug panel showing detailed extraction information
- **Auto-Resume on Reload** - Scraping automatically continues from where it left off if the page reloads

### Changed
- Improved drawer opening/closing reliability with multiple fallback methods
- Enhanced name normalization to remove titles (CEO, President, etc.)
- Better handling of Properties tab and Table View switching
- More robust pagination detection for end-of-list scenarios

### Fixed
- Fixed issue where drawer would not close properly between contacts
- Fixed duplicate contacts appearing in exported CSV
- Fixed phone numbers being captured from date fields
- Fixed start row feature not working correctly on first page

## [3.2.0] - 2026-01-10

### Added
- Start Page and Start Row configuration options
- Job naming for exported CSV files
- Persistent state saving across browser sessions

### Changed
- Improved UI with gradient colors and modern styling
- Better error handling with consecutive error tracking

### Fixed
- Fixed pagination not working correctly after page 2
- Fixed export including invalid contact names

## [3.1.0] - 2026-01-05

### Added
- Batch limit option to cap number of properties scraped
- Copy logs button for debugging
- Wipe Memory function to clear all saved data

### Changed
- Moved to Table View for more reliable property listing
- Improved contact extraction from ownership section

### Fixed
- Fixed scraper getting stuck on property pages
- Fixed CSV export formatting issues

## [3.0.0] - 2025-12-28

### Added
- Complete rewrite with new "Titanium" engine
- Support for multiple contacts per property
- Email extraction capability
- Contact address extraction
- Draggable UI panel

### Changed
- New modern UI design with VibeCoderz branding
- Switched to MuiBox-root scanning for contact detection
- Improved reliability of "View Contacts" button detection

### Removed
- Removed deprecated legacy extraction methods

## [2.0.0] - 2025-12-15

### Added
- Initial public release
- Basic property scraping functionality
- Single contact extraction per property
- CSV export capability

---

## Release Notes

### Version 3.3.0 - Production Release

This release represents the production-ready version of the Reonomy Titanium Scraper. Key highlights:

**Reliability Improvements:**
- Dual-phase scanning ensures maximum contact capture
- Automatic retry on failed page loads
- Robust drawer handling prevents getting stuck

**Data Quality:**
- Smart deduplication across multiple sources
- Phone validation filters out false positives
- LLC filtering focuses on individual contacts

**User Experience:**
- Real-time progress visibility
- Debug logging for troubleshooting
- Auto-resume prevents data loss

For installation instructions and usage guide, see [README.md](README.md).
