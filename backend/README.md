# Bernardo website backend

This small Python backend serves the site, keeps posts and tour lessons in a local SQLite database, and provides the private management page. It uses only the Python standard library.

## Start it locally

From the outputs folder:

1. Create Bernardo’s admin login: python3 backend/server.py set-admin
2. Start the site: python3 backend/server.py
3. Open http://127.0.0.1:8787/ for the site or http://127.0.0.1:8787/admin for the private space.

The public site also includes `/solitudes.html` for Bernardo’s three example solitudes and `/routes.html` for the two named route directions. The digital format is visible on the offer matrix but remains marked in development.

The password is entered locally and stored as a salted hash. There is no default account or password. Run set-admin again to change the login.

## What the private space does

- Create, edit, publish and remove blog notes.
- Record the situation, learning and next action after a tour. Open lessons stay at the top of the private list until Bernardo marks them resolved.
- Prepare a unified calendar view. The data model can merge duplicate events and report overlaps once calendar providers are connected.

## Calendar setup

No calendar provider is connected yet. The website must not collect a calendar feed URL or sign-in secret until Bernardo chooses the platforms and an OAuth/CalDAV setup is prepared for them.

Booking-platform distribution is not connected by this local backend. Marketplace links, prices, payment rules and cancellation thresholds remain operational decisions rather than invented defaults.

## Local data and hosting

The SQLite database is created at backend/data/bernardo.sqlite3 on first use. It contains the admin password hash, posts, tour lessons and later calendar records.

The included server binds to 127.0.0.1 and is for local development. Before putting the site on the public internet, host it behind HTTPS, set BERNARDO_SECURE_COOKIES=1, and use a production server and a backed-up database.

