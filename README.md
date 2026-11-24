# NNSS independent collector

Node22 + free Tesseract runner only. No website source, collected data, or credentials belong in this repository.

Daily trigger: 03:00 UTC / 12:00 Asia/Seoul. GitHub schedules can be delayed or dropped under load. Public repository scheduled workflows are disabled after 60 days without repository activity; verify schedule health and re-enable as needed. This is not an exact-time or perpetual scheduler guarantee.

Use only standard ubuntu-24.04 runners in a PUBLIC repository. No larger runners, artifacts, or Actions caches. Public standard runner compute is free under current GitHub policy. Keep NAVER 100/day and 1000/month limits unchanged.

Set NNSS_COLLECTOR_TOKEN only as an Actions repository secret. Manually dispatch verify-auth first, then run; confirm persisted collection history in NNSS. Partial processing must stay failed. Collection never approves publication. Existing server lease protects against overlapping runs.

Public job logs intentionally contain no collection output or private source data. Job failure is visible in Actions and GitHub notification settings. Do not publish logs or upload artifacts.

Never trigger this credential-bearing job from pull_request or pull_request_target events. Default GITHUB_TOKEN permission is read-only; checkout credentials are not persisted.

Use manual mode `resume` after an interrupted run to process existing pending sources and OCR without repeating NAVER discovery searches. Requests process five article groups at a time, with up to 80 batches. Search/sort URL variants of one board post are grouped on the server; edition and article identifiers remain distinct. Confirm final saved state and remaining count; an incomplete or partial run remains a failure.
