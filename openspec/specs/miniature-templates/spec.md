# Miniature templates

## Purpose

Browse installed plugin templates and manage reusable user templates without bundling a catalog.

## Requirements

### Requirement: Browse all miniature templates
The system SHALL present every installed plugin miniature template and every user template on a Templates page with search and category filtering. Plugin entries SHALL be read-only in template management. Paint Vault SHALL NOT bundle or seed a miniature template catalog.

#### Scenario: Browse installed plugin catalog
- **WHEN** the user opens Templates after installing a plugin with miniature templates
- **THEN** its templates and user templates are accessible through browsing or search

#### Scenario: No plugin installed
- **WHEN** the user opens Templates in a new vault without installed plugins or user templates
- **THEN** no catalog templates are present and the user can create a user template

### Requirement: Manage user templates
The system SHALL allow creation from scratch and from an existing miniature, and allow editing and deletion of user templates. It SHALL reject user-template changes to plugin templates.

#### Scenario: Save a miniature as a template
- **WHEN** the user saves an existing miniature as a template
- **THEN** its reusable name, image, schemes, and required paints are captured independently of the source miniature

#### Scenario: Edit and delete
- **WHEN** the user edits or deletes a user template
- **THEN** the change persists without altering miniatures already created from it

#### Scenario: Protect plugin entry
- **WHEN** a mutation targets a plugin template ID
- **THEN** the API rejects it and the installed plugin template remains unchanged

### Requirement: Create a miniature from a template
The Add miniature flow SHALL offer installed plugin and user templates and copy reusable content into a new miniature.

#### Scenario: Use user template
- **WHEN** the user selects a user template and submits Add miniature
- **THEN** the new miniature receives the template name, image when selected, valid schemes, and ordered required paints

### Requirement: Preserve templates in backup
The backup format SHALL export and restore user template records without duplicating them on repeated restore. Older backups SHALL remain restorable.

#### Scenario: Restore twice
- **WHEN** a backup with user templates is restored twice
- **THEN** each template appears once with its reusable content
