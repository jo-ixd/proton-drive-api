# Proton Drive API

A self-hosted HTTP API that wraps the official [Proton Drive CLI](https://proton.me/support/drive-cli) and puts a bearer-token permission layer in front of it.

The CLI session is the whole Proton account. This service is the gate that lets a homelab agent upload, list, and download inside folders you choose, while the destructive commands stay unwired.

This repository currently holds the architecture. Implementation has not started.

Read [docs/PLAN.md](docs/PLAN.md) for the design, the threat model, the MVP routes, and the test contract.
