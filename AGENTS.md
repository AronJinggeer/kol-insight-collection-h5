# Project Rules

## Scope

This workspace is used for the H5 project itself and for related content assets generated during collaboration.

## Output Rules

- Default language is Chinese unless the task explicitly requires another language.
- Generated non-code deliverables should be placed under `outputs/YYYY-MM-DD/`.
- Image assets for social content should use clear English file names with topic-based prefixes.
- Do not modify application code unless the user explicitly asks for product changes.

## Verification

- For content-asset tasks, verify that referenced output files exist and can be opened locally.
- For code tasks, follow the project README commands first.

## Deployment Isolation

- For externally shared H5 projects, campaign pages, surveys, and admin systems, use one GitHub repo, one Render service, and one independent domain per project by default.
- Do not reuse another project's root entry, page metadata, environment variables, storage files, admin password, or public URL unless the user explicitly chooses a shared deployment.
- Before saying a project is ready to share, verify the bare domain, target route, mobile viewport, page title, and metadata do not show old project names or copy.
