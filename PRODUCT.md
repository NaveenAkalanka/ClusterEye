# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
The primary user is the owner, Naveen, keeping a record of their own lab infrastructure. It is a personal tool: they open it when they need to know what runs where, or when adding or changing a machine, disk, or container. Other people can sign up because the sign-up page is open, but growing an audience is not a goal.

## Product Purpose
ClusterEye is the single place to record clusters, VM/LXC nodes, disks, Docker containers, and IP addresses. Success means the owner can answer "what runs where, at what address, and using how much storage?" from the app, rather than from memory or scattered notes, and can trust the record when making a change.

## Positioning
ClusterEye keeps one linked picture of the lab. Clusters, nodes, disks, containers, and IPs are connected records rather than separate lists, so a node shows the disks it draws on and a container shows its host. A spreadsheet doesn't maintain those links, and a tool like NetBox brings more setup than a personal lab needs.

## Operating Context
- Records are entered and updated by hand. Nothing is discovered from the infrastructure.
- Saved changes sync between sessions through Firestore.
- Used on desktop and mobile browsers.

## Capabilities and Constraints
- **Pages:** Dashboard, Nodes, Clusters, Disks, Network, Docker, and Profile, behind email/password sign-in.
- **Terminology:** a "node" is a VM or LXC container, recorded with a cluster, an IP address, and disk allocations. A "container" is a Docker container hosted on a node.
- **Data rules:** a node's IP must fit its cluster's subnet, and disk allocations can't exceed a disk's capacity.
- **Ownership:** each account sees only its own records. There are no roles, teams, or shared workspaces.
- **No live data:** the app does not probe hosts or report health or availability. An IP with no record has not been checked and must not be presented as free.
- **Undecided:** whether to add live health checks later. The docs list them as possible future work, but no decision has been made, so current work should not imply live status.
- **Credentials:** node and container passwords are no longer stored. Secret storage does not exist.

## Brand Commitments
- **Name:** ClusterEye, with the logo at `public/ClusterEye.svg`.
- **Licence:** CC BY-NC-SA 4.0.
- **Copy:** Title Case is the documented convention for labels, and `uppercase` styling was deliberately removed.

## Evidence on Hand
- **Assets:** the logo above, plus the working app.
- **Absent:** there are no real product screenshots (`docs/DOCUMENTATION.md` has placeholders only), and no users, testimonials, benchmarks, or usage data. Future work must not invent them.

## Product Principles
- **A record, not a monitor.** Show what was recorded and never imply it was measured or is current.
- **Connections are the value.** Prefer showing how records relate over adding more standalone lists or totals.
- **Built for one owner.** Favour fast lookup and low-effort upkeep over team, permission, or onboarding features.
- **Keep the record trustworthy.** Prevent bad data at entry, such as out-of-subnet IPs or over-allocated disks, and be clear about what is unknown.
