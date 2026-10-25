---
"@gendigital/sage-core": patch
---

Add two URL threat rules: CLT-URL-006 detects uploads to ephemeral file-hosting services (transfer.sh, file.io, temp.sh, bashupload.com, termbin.com, 0x0.st) commonly abused for data exfiltration, and CLT-URL-007 detects hex-encoded IP addresses in URLs, complementing CLT-URL-004's dotted-decimal coverage.
