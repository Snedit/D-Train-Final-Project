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