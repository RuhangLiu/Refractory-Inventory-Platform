# Reference Architecture

The production design uses managed Google Cloud services and keeps public industry data separate from synthetic company operations data.

```mermaid
flowchart LR
  subgraph Sources
    FRED[FRED steel production CSV]
    SYN[Synthetic product, inventory, and transaction CSVs]
  end

  subgraph Ingestion
    UP[Versioned batch upload]
  end

  subgraph Lake["Cloud Storage data lake"]
    RAW[Raw zone]
    CUR[Curated zone]
  end

  subgraph Warehouse["BigQuery"]
    TABLES[Typed tables]
    VIEWS[Serving and quality views]
  end

  subgraph AI["BigQuery ML"]
    MODEL[ARIMA_PLUS model]
    FORECAST[Forecast serving table]
  end

  subgraph Serving
    RUN[Cloud Run inventory app]
    LOOKER[Looker Studio report]
  end

  FRED --> UP
  SYN --> UP
  UP --> RAW
  RAW --> CUR
  CUR --> TABLES
  TABLES --> VIEWS
  TABLES --> MODEL
  MODEL --> FORECAST
  VIEWS --> RUN
  FORECAST --> RUN
  VIEWS --> LOOKER
  FORECAST --> LOOKER

  IAM[IAM, budget alerts, audit logs] -. governance .-> Lake
  IAM -. governance .-> Warehouse
  IAM -. governance .-> Serving
```

## Service roles

| Service | Role | Reason selected |
| --- | --- | --- |
| Cloud Storage | Raw and curated lake zones | Low-cost object storage with inspectable evidence |
| BigQuery | Typed warehouse, quality checks, and serving views | Serverless SQL analytics at classroom scale |
| BigQuery ML | ARIMA_PLUS time-series forecast | AI runs close to governed warehouse data |
| Cloud Run | Hosted planner application and API | Supports a custom HTML/CSS/JavaScript product |
| Looker Studio | Management KPIs and forecast report | Native BigQuery connection and shareable report |
| IAM | Runtime and instructor access controls | Least-privilege application access and grading visibility |

## Security and ethics

- The company dataset is synthetic and contains no real customer or confidential commercial information.
- Public FRED data is cited by series identifier and retained unchanged in the raw zone.
- The application runtime has BigQuery Job User and Data Viewer roles only.
- The instructor receives project Viewer access.
- Recommendations are advisory. A human must acknowledge an alert and approve procurement.
