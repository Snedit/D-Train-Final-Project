```mermaid
flowchart LR
  User[User (React Web App)] -->|Uploads ZIP| API[Node/Express API]
  API --> Mongo[(MongoDB)]
  API --> Supabase[(Supabase Storage)]
  API --> Redis[(Redis Pub/Sub)]

  Redis -->|Job Offer| WorkerApp[Electron Worker App]
  WorkerApp --> Docker[Docker Engine]

  WorkerApp -->|Download ZIP| Supabase
  Docker -->|Output: model + logs| Supabase

  WorkerApp -->|Metrics| API
  API -->|Billing| Mongo
  User -->|Fetch Results| Supabase
```


Dtrain
|
+--> backend
|   |
|   +--> middlewares
|   |
|   +--> node_modules
|   |
|   +--> routes
|   |
|   +--> schemas
|   |
|   +--> utils
|   |
|   +--> .env
|   |
|   +--> .gitignore
|   |
|   +--> index.js
|   |
|   +--> package.json
|   |
|   +--> package-lock.json
|
+--> electron-worker
|   |
|   +--> assets
|   |
|   +--> dist
|   |
|   +--> jobs
|   |
|   +--> node_modules
|   |
|   +--> temp
|   |
|   +--> .gitignore
|   |
|   +--> main.js
|   |
|   +--> preload.js
|   |
|   +--> package.json
|   |
|   +--> package-lock.json
|
+--> frontend
|   |
|   +--> dist
|   |
|   +--> node_modules
|   |
|   +--> public
|   |
|   +--> src
|   |   |
|   |   +--> components
|   |   |
|   |   +--> types
|   |   |
|   |   +--> App.tsx
|   |   |
|   |   +--> index.css
|   |   |
|   |   +--> main.tsx
|   |   |
|   |   +--> vite-env.d.ts
|   |
|   +--> .gitignore
|   |
|   +--> eslint.config.js
|   |
|   +--> index.html
|   |
|   +--> package.json
|   |
|   +--> package-lock.json
|   |
|   +--> postcss.config.js
|   |
|   +--> tailwind.config.js
|   |
|   +--> tsconfig.json
|   |
|   +--> tsconfig.app.json
|   |
|   +--> tsconfig.node.json
|   |
|   +--> vite.config.ts
|
+--> worker-ui
|   |
|   +--> dist
|   |
|   +--> node_modules
|   |
|   +--> public
|   |
|   +--> src
|   |   |
|   |   +--> components
|   |   |
|   |   +--> types
|   |   |
|   |   +--> App.tsx
|   |   |
|   |   +--> index.css
|   |   |
|   |   +--> main.tsx
|   |   |
|   |   +--> vite-env.d.ts
|   |
|   +--> .gitignore
|   |
|   +--> eslint.config.js
|   |
|   +--> index.html
|   |
|   +--> package.json
|   |
|   +--> package-lock.json
|   |
|   +--> postcss.config.js
|   |
|   +--> tailwind.config.js
|   |
|   +--> tsconfig.json
|   |
|   +--> tsconfig.app.json
|   |
|   +--> tsconfig.node.json
|   |
|   +--> vite.config.ts
|   |
|   +--> README.md
|
+--> README.md
+--> sysArchitecture.md
