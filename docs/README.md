# API docs (OpenAPI)

This folder contains the OpenAPI specification for the backend.

Files:
- `openapi.yaml` — the canonical YAML source for the OpenAPI spec.
- `openapi.json` — generated JSON produced by `npm run gen:openapi`.

How to regenerate the JSON locally

1. From the `backend` directory install dev dependencies (if not already installed):

```powershell
npm ci
```

2. Run the generation script:

```powershell
npm run gen:openapi
```

This will read `docs/openapi.yaml` and write `docs/openapi.json`.

Viewing the docs locally

- The project includes a docs router at `routes/docs.js` which mounts Swagger UI when dev dependencies (`swagger-ui-express` and `yamljs`) are installed. Start the server (`npm start` or `npm run dev`) and visit `http://localhost:5000/api/docs` (or the base path where the app is mounted) to see the Swagger UI.

CI integration

- The GitHub Actions workflow will run the generator and upload `backend/docs/openapi.json` as an artifact. If you want to expose the generated JSON publicly, consider publishing it to GitHub Pages or a docs site in a follow-up task.

Notes

- `openapi.json` is ignored by ESLint (see `.eslintignore`) to avoid noise. Keep `openapi.yaml` as the source of truth.
